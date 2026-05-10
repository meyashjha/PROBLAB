import { ParlayModel } from '../models/Parlay';
import { jupiterService } from '@parlay-tokens/backend-shared';
import { solanaService } from '@parlay-tokens/backend-shared';
import { quoteService } from './quote.service';
import {
  CreateParlayInput,
  ConfirmPaymentInput,
  ClaimParlayInput,
  getMultiplierValue,
  validateParlayRules,
  type Parlay,
} from '@parlay-tokens/shared';

export class ParlayService {
  /**
   * Create a new parlay with immediate payment verification
   * SECURITY: Payment must be verified BEFORE parlay creation to prevent timing exploits
   */
  async createParlay(input: CreateParlayInput & { txSignature: string }): Promise<Parlay> {
    // Validate minimum events
    if (input.events.length < 2) {
      throw new Error('Parlay must have at least 2 events');
    }

    // Validate minimum principal amount
    if (input.principalAmount < 1) {
      throw new Error('Minimum principal amount is 1 SOL');
    }

    // Validate payment signature is provided
    if (!input.txSignature) {
      throw new Error('Payment transaction signature is required');
    }

    // Calculate quote using the quote engine
    const quote = await quoteService.calculateParlayQuote(
      input.events.map((e: any) => ({
        eventId: e.eventId,
        marketId: e.marketId,
        selectedOutcome: e.selectedOutcome,
      })),
      input.principalAmount
    );

    // Validate the parlay
    const validation = quoteService.validateParlay(quote);
    if (!validation.valid) {
      throw new Error(validation.reason || 'Invalid parlay');
    }

    // CRITICAL: Verify payment BEFORE creating parlay
    // This prevents users from creating parlays and only paying if events go in their favor
    const verification = await solanaService.verifyPayment(
      input.txSignature,
      input.principalAmount,
      input.walletAddress
    );

    if (!verification.verified) {
      throw new Error('Payment verification failed. Please ensure the transaction is confirmed.');
    }

    // Check for duplicate parlay with same transaction signature (idempotency)
    const existingParlay = await ParlayModel.findOne({ paymentTxSignature: input.txSignature });
    if (existingParlay) {
      console.log(`Duplicate parlay creation attempt with tx ${input.txSignature}`);
      return existingParlay.toObject();
    }

    // Create SPL token for this parlay
    const { mintAddress, signature } = await solanaService.createParlayToken(
      input.walletAddress
    );

    // Calculate potential payout from quote
    const potentialPayout = quote.potentialPayout;

    // Find the latest settlement date
    const settlementDates = input.events.map((e: any) => 
      new Date(e.settlementDate)
    );
    const finalSettlementDate = new Date(Math.max(...settlementDates.map((d: any) => d.getTime())));

    // Create parlay document with quote data
    // Status is 'active' immediately since payment is already verified
    const parlay = new ParlayModel({
      walletAddress: input.walletAddress,
      events: input.events.map((e: any) => ({
        ...e,
        settlementDate: new Date(e.settlementDate),
        status: 'active',
      })),
      // multiplier field omitted (legacy field, not used in calculations)
      principalAmount: input.principalAmount,
      potentialPayout,
      status: 'active', // Active immediately (payment already verified)
      paymentTxSignature: input.txSignature,
      tokenMint: mintAddress,
      finalSettlementDate,
      // Store quote data for reference
      quoteData: {
        combinedProbability: quote.combinedProbability,
        fairOdds: quote.fairParlayOdds,
        offeredOdds: quote.offeredOdds,
        houseEdge: quote.houseEdge,
        expectedValue: quote.expectedValue,
        calculatedAt: new Date(),
      },
    });

    await parlay.save();
    console.log(`✅ Parlay created: ${parlay._id} | Payment: ${input.txSignature} | Token: ${mintAddress}`);
    return parlay.toObject();
  }

  /**
   * Confirm payment and activate parlay (LEGACY METHOD)
   * This method is kept for backwards compatibility with existing pending_payment parlays
   * New parlays should use createParlay with txSignature instead
   * 
   * SECURITY: Checks payment deadline to prevent timing exploits
   */
  async confirmPayment(input: ConfirmPaymentInput): Promise<Parlay> {
    const parlay = await ParlayModel.findById(input.parlayId);
    
    if (!parlay) {
      throw new Error('Parlay not found');
    }

    if (parlay.status !== 'pending_payment') {
      throw new Error('Parlay payment already confirmed or parlay is not in pending_payment status');
    }

    // Check payment deadline (if set)
    if (parlay.paymentDeadline && new Date() > parlay.paymentDeadline) {
      // Mark as expired
      parlay.status = 'expired';
      await parlay.save();
      throw new Error('Payment deadline has expired. Please create a new parlay.');
    }

    // Check if any events have already settled (timing exploit detection)
    const hasSettledEvents = parlay.events.some((e: any) => e.status !== 'active');
    if (hasSettledEvents) {
      // Mark as expired to prevent exploit
      parlay.status = 'expired';
      await parlay.save();
      throw new Error('Cannot pay for parlay after events have started settling. Please create a new parlay.');
    }

    // Verify payment on Solana
    const verification = await solanaService.verifyPayment(
      input.txSignature,
      parlay.principalAmount,
      parlay.walletAddress
    );

    if (!verification.verified) {
      throw new Error('Payment verification failed');
    }

    // Create SPL token for this parlay
    const { mintAddress, signature } = await solanaService.createParlayToken(
      parlay.walletAddress
    );

    // Update parlay
    parlay.status = 'active';
    parlay.paymentTxSignature = input.txSignature;
    parlay.tokenMint = mintAddress;
    await parlay.save();

    console.log(`✅ Legacy parlay payment confirmed: ${parlay._id} | Payment: ${input.txSignature}`);
    return parlay.toObject();
  }

  /**
   * Expire pending payment parlays that have passed their deadline
   * Should be run periodically by a cron job
   */
  async expirePendingParlays(): Promise<number> {
    const result = await ParlayModel.updateMany(
      {
        status: 'pending_payment',
        $or: [
          { paymentDeadline: { $lt: new Date() } }, // Deadline passed
          { 'events.status': { $ne: 'active' } }, // Events already settling
        ],
      },
      {
        $set: { status: 'expired' },
      }
    );

    console.log(`Expired ${result.modifiedCount} pending payment parlays`);
    return result.modifiedCount;
  }

  /**
   * Get parlay by ID
   */
  async getParlayById(parlayId: string): Promise<Parlay | null> {
    const parlay = await ParlayModel.findById(parlayId);
    return parlay ? parlay.toObject() : null;
  }

  /**
   * Get parlays by wallet address
   */
  async getParlaysByWallet(walletAddress: string): Promise<Parlay[]> {
    const parlays = await ParlayModel.find({ walletAddress })
      .sort({ createdAt: -1 })
      .lean();
    return parlays;
  }

  /**
   * Get active parlays that need settlement checking
   */
  async getActiveParlays(): Promise<Parlay[]> {
    const parlays = await ParlayModel.find({ status: 'active' }).lean();
    return parlays;
  }

  /**
   * Get lost parlays that still have pending events
   */
  async getLostParlaysWithPendingEvents(): Promise<Parlay[]> {
    const parlays = await ParlayModel.find({ 
      status: 'lost',
      'events.status': 'active' // Has at least one active event
    }).lean();
    return parlays;
  }

  /**
   * Update parlay event status (atomic — safe for concurrent settlement checks)
   */
  async updateEventStatus(
    parlayId: string,
    eventId: string,
    status: 'active' | 'won' | 'lost' | 'cancelled',
    actualOutcome?: 'YES' | 'NO'
  ): Promise<void> {
    // Step 1: Atomically update the specific event using positional operator
    // This prevents lost updates when two events from the same parlay settle concurrently
    let eventStatus = status;
    const updateFields: Record<string, any> = {};

    if (actualOutcome) {
      // Need to read the event to determine win/loss
      const parlay = await ParlayModel.findById(parlayId);
      if (!parlay) throw new Error('Parlay not found');
      const event = parlay.events.find((e: any) => e.eventId === eventId);
      if (!event) throw new Error('Event not found in parlay');

      eventStatus = event.selectedOutcome === actualOutcome ? 'won' : 'lost';
      console.log(`Event ${eventId}: Selected ${event.selectedOutcome}, Actual ${actualOutcome} → ${eventStatus}`);

      updateFields['events.$.actualOutcome'] = actualOutcome;
    }

    updateFields['events.$.status'] = eventStatus;

    const result = await ParlayModel.updateOne(
      { _id: parlayId, 'events.eventId': eventId },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      throw new Error('Parlay or event not found');
    }

    // Step 2: Re-read the parlay to evaluate overall status
    // This is safe because parlay-level status transitions are idempotent
    const parlay = await ParlayModel.findById(parlayId);
    if (!parlay) return;

    const hasLostEvent = parlay.events.some((e: any) => e.status === 'lost');

    // If ANY event is lost, mark parlay as lost
    if (hasLostEvent && parlay.status === 'active') {
      console.log(`❌ Parlay ${parlayId} LOST (has at least one lost event)`);
      await ParlayModel.updateOne(
        { _id: parlayId, status: 'active' },
        { $set: { status: 'lost', settledAt: new Date() } }
      );
      return;
    }

    // Check if all events are settled
    const allSettled = parlay.events.every((e: any) =>
      e.status === 'won' || e.status === 'lost' || e.status === 'cancelled'
    );

    if (allSettled && parlay.status === 'active') {
      const allWon = parlay.events.every((e: any) => e.status === 'won');
      const newStatus = allWon ? 'won' : 'lost';
      console.log(allWon
        ? `🎉 Parlay ${parlayId} WON! All events correct!`
        : `❌ Parlay ${parlayId} LOST`);

      await ParlayModel.updateOne(
        { _id: parlayId, status: 'active' },
        { $set: { status: newStatus, settledAt: new Date() } }
      );
    }
  }

  /**
   * Claim winning parlay (atomic — prevents double-payout race condition)
   */
  async claimParlay(input: ClaimParlayInput): Promise<{ signature: string }> {
    // Step 1: Atomically lock the parlay for claiming.
    // findOneAndUpdate with conditions ensures only ONE request can succeed.
    // If two requests arrive simultaneously, the second will get null.
    const parlay = await ParlayModel.findOneAndUpdate(
      {
        _id: input.parlayId,
        status: 'won',
        claimedAt: null,
        walletAddress: input.walletAddress,
      },
      {
        $set: {
          status: 'claimed',
          claimedAt: new Date(),
        },
      },
      { new: false } // Return the document BEFORE the update so we can read potentialPayout
    );

    if (!parlay) {
      // Could be: not found, wrong wallet, already claimed, or not in won status
      // Check which case for a better error message
      const existing = await ParlayModel.findById(input.parlayId);
      if (!existing) throw new Error('Parlay not found');
      if (existing.walletAddress !== input.walletAddress) throw new Error('Unauthorized');
      if (existing.claimedAt) throw new Error('Parlay already claimed');
      throw new Error('Parlay is not in won status');
    }

    // Step 2: Verify user has the token
    if (!parlay.tokenMint) {
      // Rollback the status change
      await ParlayModel.updateOne(
        { _id: input.parlayId },
        { $set: { status: 'won', claimedAt: null } }
      );
      throw new Error('Token mint not found');
    }

    const hasToken = await solanaService.userHasToken(
      parlay.tokenMint,
      input.walletAddress
    );

    if (!hasToken) {
      // Rollback the status change
      await ParlayModel.updateOne(
        { _id: input.parlayId },
        { $set: { status: 'won', claimedAt: null } }
      );
      throw new Error('User does not have the parlay token');
    }

    // Step 3: Send payout — parlay is already locked as 'claimed'
    try {
      const signature = await solanaService.sendPayout(
        input.walletAddress,
        parlay.potentialPayout
      );
      return { signature };
    } catch (error) {
      // Payout failed — rollback the claim so user can retry
      console.error(`Payout failed for parlay ${input.parlayId}, rolling back claim:`, error);
      await ParlayModel.updateOne(
        { _id: input.parlayId },
        { $set: { status: 'won', claimedAt: null } }
      );
      throw new Error('Payout transaction failed. Please try again.');
    }
  }

  /**
   * Get parlay statistics
   */
  async getStats(walletAddress?: string) {
    const query = walletAddress ? { walletAddress } : {};
    
    const [total, active, won, lost, claimed] = await Promise.all([
      ParlayModel.countDocuments(query),
      ParlayModel.countDocuments({ ...query, status: 'active' }),
      ParlayModel.countDocuments({ ...query, status: 'won' }),
      ParlayModel.countDocuments({ ...query, status: 'lost' }),
      ParlayModel.countDocuments({ ...query, status: 'claimed' }),
    ]);

    return {
      total,
      active,
      won,
      lost,
      claimed,
      winRate: total > 0 ? ((won + claimed) / total) * 100 : 0,
    };
  }
}

export const parlayService = new ParlayService();
