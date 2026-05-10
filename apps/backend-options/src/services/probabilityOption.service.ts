import { ProbabilityOptionModel } from '../models/ProbabilityOption';
import { jupiterService } from '@parlay-tokens/backend-shared';
import { solanaService } from '@parlay-tokens/backend-shared';
import { marketSnapshotService } from './marketSnapshot.service';
import {
  CreateOptionInput,
  ConfirmOptionPaymentInput,
  ExerciseOptionInput,
  ProbabilityOption,
  OptionQuote,
  OptionPricingParams,
  OptionType,
  OptionsChainEntry,
  PayoffPoint,
  VolatilityMetrics,
} from '@parlay-tokens/shared';

function calculateProbabilityFromMarket(market: any): number {
  if (!market || !market.pricing) return 0.5;
  
  const buyYes = market.pricing.buyYesPriceUsd;
  const buyNo = market.pricing.buyNoPriceUsd;
  
  if (buyYes && buyNo && buyYes > 0 && buyNo > 0) {
    return buyYes / (buyYes + buyNo);
  }
  
  return 0.5;
}

/**
 * Probability Options Service
 * 
 * Implements Black-Scholes-inspired pricing for probability options
 * Adapted for bounded probability space (0-1) instead of unbounded stock prices
 */
export class ProbabilityOptionService {
  
  async calculateOptionQuote(params: OptionPricingParams): Promise<OptionQuote> {
    const {
      currentProbability,
      strikePrice,
      timeToExpiration,
      impliedVolatility,
      notionalAmount,
      optionType,
    } = params;

    const intrinsicValue = this.calculateIntrinsicValue(
      currentProbability,
      strikePrice,
      optionType,
      notionalAmount
    );

    // Calculate time value using adapted Black-Scholes
    const timeValue = this.calculateTimeValue(
      currentProbability,
      strikePrice,
      timeToExpiration,
      impliedVolatility,
      notionalAmount,
      optionType
    );

    const premium = Math.max(0, intrinsicValue + timeValue);

    const delta = this.calculateDelta(
      currentProbability,
      strikePrice,
      timeToExpiration,
      impliedVolatility,
      optionType
    );

    const theta = this.calculateTheta(
      currentProbability,
      strikePrice,
      timeToExpiration,
      impliedVolatility,
      notionalAmount,
      optionType
    );

    const vega = this.calculateVega(
      currentProbability,
      strikePrice,
      timeToExpiration,
      impliedVolatility,
      notionalAmount
    );

    // Calculate break-even probability
    const breakEvenProbability = this.calculateBreakEven(
      strikePrice,
      premium,
      notionalAmount,
      optionType
    );

    const maxProfit = optionType === 'CALL'
      ? (1 - strikePrice) * notionalAmount - premium
      : strikePrice * notionalAmount - premium;
    
    const maxLoss = premium;

    const probabilityOfProfit = this.estimateProfitProbability(
      currentProbability,
      breakEvenProbability,
      timeToExpiration,
      impliedVolatility
    );

    return {
      premium,
      intrinsicValue,
      timeValue,
      breakEvenProbability,
      maxProfit,
      maxLoss,
      probabilityOfProfit,
      delta,
      theta,
      vega,
    };
  }

  private calculateIntrinsicValue(
    currentProbability: number,
    strikePrice: number,
    optionType: OptionType,
    notionalAmount: number
  ): number {
    if (optionType === 'CALL') {
      return Math.max(0, (currentProbability - strikePrice) * notionalAmount);
    } else {
      return Math.max(0, (strikePrice - currentProbability) * notionalAmount);
    }
  }

  private calculateTimeValue(
    currentProbability: number,
    strikePrice: number,
    timeToExpiration: number,
    impliedVolatility: number,
    notionalAmount: number,
    optionType: OptionType
  ): number {
    if (timeToExpiration <= 0) return 0;

    const p = Math.max(0.01, Math.min(0.99, currentProbability));
    const k = Math.max(0.01, Math.min(0.99, strikePrice));
    const t = timeToExpiration / 365;
    const sigma = impliedVolatility;

    const logitP = Math.log(p / (1 - p));
    const logitK = Math.log(k / (1 - k));
    
    const d1 = (logitP - logitK + 0.5 * sigma * sigma * t) / (sigma * Math.sqrt(t));
    const d2 = d1 - sigma * Math.sqrt(t);

    const N_d1 = this.normalCDF(d1);
    const N_d2 = this.normalCDF(d2);

    let timeValue: number;
    if (optionType === 'CALL') {
      timeValue = notionalAmount * (p * N_d1 - k * N_d2);
    } else {
      timeValue = notionalAmount * (k * (1 - N_d2) - p * (1 - N_d1));
    }

    const volatilityPremium = notionalAmount * sigma * Math.sqrt(t) * 0.4;
    
    return Math.max(0, timeValue + volatilityPremium);
  }

  private calculateDelta(
    currentProbability: number,
    strikePrice: number,
    timeToExpiration: number,
    impliedVolatility: number,
    optionType: OptionType
  ): number {
    if (timeToExpiration <= 0) {
      if (optionType === 'CALL') {
        return currentProbability > strikePrice ? 1 : 0;
      } else {
        return currentProbability < strikePrice ? -1 : 0;
      }
    }

    const p = Math.max(0.01, Math.min(0.99, currentProbability));
    const k = Math.max(0.01, Math.min(0.99, strikePrice));
    const t = timeToExpiration / 365;
    const sigma = impliedVolatility;

    const logitP = Math.log(p / (1 - p));
    const logitK = Math.log(k / (1 - k));
    const d1 = (logitP - logitK + 0.5 * sigma * sigma * t) / (sigma * Math.sqrt(t));

    const delta = this.normalCDF(d1);
    return optionType === 'CALL' ? delta : delta - 1;
  }

  private calculateTheta(
    currentProbability: number,
    strikePrice: number,
    timeToExpiration: number,
    impliedVolatility: number,
    notionalAmount: number,
    optionType: OptionType
  ): number {
    if (timeToExpiration <= 0) return 0;

    const currentValue = this.calculateTimeValue(
      currentProbability,
      strikePrice,
      timeToExpiration,
      impliedVolatility,
      notionalAmount,
      optionType
    );

    const futureValue = this.calculateTimeValue(
      currentProbability,
      strikePrice,
      Math.max(0, timeToExpiration - 1),
      impliedVolatility,
      notionalAmount,
      optionType
    );

    return futureValue - currentValue;
  }

  private calculateVega(
    currentProbability: number,
    strikePrice: number,
    timeToExpiration: number,
    impliedVolatility: number,
    notionalAmount: number
  ): number {
    if (timeToExpiration <= 0) return 0;

    const p = Math.max(0.01, Math.min(0.99, currentProbability));
    const t = timeToExpiration / 365;
    const sigma = impliedVolatility;

    const atTheMoneyness = 1 - Math.abs(currentProbability - strikePrice);
    const vega = notionalAmount * Math.sqrt(t) * atTheMoneyness * 0.4;

    return vega;
  }

  private calculateBreakEven(
    strikePrice: number,
    premium: number,
    notionalAmount: number,
    optionType: OptionType
  ): number {
    if (optionType === 'CALL') {
      return strikePrice + (premium / notionalAmount);
    } else {
      return strikePrice - (premium / notionalAmount);
    }
  }

  private estimateProfitProbability(
    currentProbability: number,
    breakEvenProbability: number,
    timeToExpiration: number,
    impliedVolatility: number
  ): number {
    const t = timeToExpiration / 365;
    const sigma = impliedVolatility;
    
    const stdDev = sigma * Math.sqrt(t);
    const z = (breakEvenProbability - currentProbability) / stdDev;
    
    return 1 - this.normalCDF(z);
  }

  private normalCDF(x: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - p : p;
  }

  /**
   * Estimate implied volatility.
   * Uses realized volatility from snapshots when ≥10 data points exist,
   * otherwise falls back to the heuristic.
   */
  async estimateImpliedVolatility(eventId: string, marketId: string): Promise<number> {
    try {
      // Try snapshot-based realized volatility first
      const realizedVol = await marketSnapshotService.computeRealizedVolatility(marketId);
      if (realizedVol !== null) {
        return realizedVol;
      }

      // Fallback: heuristic based on market data
      const marketData = await jupiterService.getMarket(marketId);
      
      if (!marketData) {
        console.warn(`Market ${marketId} not found, using default volatility`);
        return 0.15;
      }
      
      const baseVolatility = 0.15;
      
      const daysToSettlement = marketData.closeTime
        ? Math.max(1, (marketData.closeTime * 1000 - Date.now()) / (1000 * 60 * 60 * 24))
        : 30;
      
      const timeAdjustment = Math.min(1, daysToSettlement / 30);
      const probability = calculateProbabilityFromMarket(marketData);
      const uncertaintyAdjustment = 1 - Math.abs(probability - 0.5) * 2;
      
      const impliedVolatility = baseVolatility * timeAdjustment * (0.5 + 0.5 * uncertaintyAdjustment);
      
      return Math.max(0.05, Math.min(0.50, impliedVolatility));
    } catch (error) {
      console.error('Error estimating volatility:', error);
      return 0.15;
    }
  }

  /**
   * Create a new probability option
   */
  async createOption(input: CreateOptionInput): Promise<ProbabilityOption> {
    // Validate inputs
    if (input.strikePrice < 0 || input.strikePrice > 1) {
      throw new Error('Strike price must be between 0 and 1');
    }

    if (input.notionalAmount < 0.1) {
      throw new Error('Minimum notional amount is 0.1 SOL');
    }

    // Get current market data
    const marketData = await jupiterService.getMarket(input.marketId);
    
    if (!marketData) {
      throw new Error('Market not found');
    }
    
    const currentProbability = calculateProbabilityFromMarket(marketData);

    // Estimate implied volatility
    const impliedVolatility = await this.estimateImpliedVolatility(
      input.eventId,
      input.marketId
    );

    // Calculate time to expiration
    const expirationDate = new Date(input.expirationDate);
    const timeToExpiration = Math.max(0, 
      (expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    if (timeToExpiration <= 0) {
      throw new Error('Expiration date must be in the future');
    }

    // Calculate option quote
    const quote = await this.calculateOptionQuote({
      currentProbability,
      strikePrice: input.strikePrice,
      timeToExpiration,
      impliedVolatility,
      notionalAmount: input.notionalAmount,
      optionType: input.optionType,
    });

    // Determine initial status based on whether payment is provided
    let status: 'pending_payment' | 'active' = 'pending_payment';
    let tokenMint: string | undefined;
    let paymentTxSignature: string | undefined;

    // If payment signature provided, verify and activate immediately
    if (input.txSignature) {
      // Verify payment on Solana
      const verification = await solanaService.verifyPayment(
        input.txSignature,
        quote.premium,
        input.walletAddress
      );

      if (!verification.verified) {
        throw new Error('Payment verification failed');
      }

      // Create SPL token for this option
      const { mintAddress } = await solanaService.createParlayToken(
        input.walletAddress
      );

      status = 'active';
      tokenMint = mintAddress;
      paymentTxSignature = input.txSignature;
    }

    // Create option document
    const option = new ProbabilityOptionModel({
      walletAddress: input.walletAddress,
      eventId: input.eventId,
      marketId: input.marketId,
      eventTitle: input.eventTitle,
      eventDescription: input.eventDescription,
      eventSettlementDate: new Date(input.eventSettlementDate),
      optionType: input.optionType,
      strikePrice: input.strikePrice,
      premium: quote.premium,
      notionalAmount: input.notionalAmount,
      initialProbability: currentProbability,
      impliedVolatility,
      currentProbability,
      intrinsicValue: quote.intrinsicValue,
      timeValue: quote.timeValue,
      status,
      expirationDate,
      tokenMint,
      paymentTxSignature,
    });

    await option.save();
    return option.toObject();
  }

  /**
   * Confirm payment and activate option
   */
  async confirmPayment(input: ConfirmOptionPaymentInput): Promise<ProbabilityOption> {
    const option = await ProbabilityOptionModel.findById(input.optionId);
    
    if (!option) {
      throw new Error('Option not found');
    }

    if (option.status !== 'pending_payment') {
      throw new Error('Option payment already confirmed');
    }

    // Verify payment on Solana
    const verification = await solanaService.verifyPayment(
      input.txSignature,
      option.premium,
      option.walletAddress
    );

    if (!verification.verified) {
      throw new Error('Payment verification failed');
    }

    // Create SPL token for this option
    const { mintAddress } = await solanaService.createParlayToken(
      option.walletAddress
    );

    // Update option
    option.status = 'active';
    option.paymentTxSignature = input.txSignature;
    option.tokenMint = mintAddress;
    await option.save();

    return option.toObject();
  }

  /**
   * Update option with current market data
   */
  async updateOptionValue(optionId: string): Promise<ProbabilityOption> {
    const option = await ProbabilityOptionModel.findById(optionId);
    
    if (!option) {
      throw new Error('Option not found');
    }

    // Get current market data
    const marketData = await jupiterService.getMarket(option.marketId);
    
    if (!marketData) {
      throw new Error('Market not found');
    }
    
    const currentProbability = calculateProbabilityFromMarket(marketData);

    // Calculate time to expiration
    const timeToExpiration = Math.max(0,
      (option.expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    // Calculate current intrinsic value
    const intrinsicValue = this.calculateIntrinsicValue(
      currentProbability,
      option.strikePrice,
      option.optionType,
      option.notionalAmount
    );

    // Calculate current time value
    const timeValue = timeToExpiration > 0
      ? this.calculateTimeValue(
          currentProbability,
          option.strikePrice,
          timeToExpiration,
          option.impliedVolatility,
          option.notionalAmount,
          option.optionType
        )
      : 0;

    // Update option
    option.currentProbability = currentProbability;
    option.intrinsicValue = intrinsicValue;
    option.timeValue = timeValue;

    // Update status based on profitability
    if (option.status === 'active') {
      if (intrinsicValue > 0) {
        option.status = 'profitable';
      } else {
        option.status = 'unprofitable';
      }
    }

    await option.save();
    return option.toObject();
  }

  /**
   * Exercise option (atomic — prevents double-payout race condition)
   */
  async exerciseOption(input: ExerciseOptionInput): Promise<{ signature: string; payout: number }> {
    // Step 1: Update to latest market data first
    await this.updateOptionValue(input.optionId);
    
    // Step 2: Atomically lock the option for exercising.
    // findOneAndUpdate ensures only ONE concurrent request can succeed.
    const option = await ProbabilityOptionModel.findOneAndUpdate(
      {
        _id: input.optionId,
        walletAddress: input.walletAddress,
        status: { $in: ['active', 'profitable'] },
        exercisedAt: null,
      },
      {
        $set: {
          status: 'exercised',
          exercisedAt: new Date(),
        },
      },
      { new: false } // Return document BEFORE update to read intrinsicValue
    );

    if (!option) {
      // Provide a specific error message
      const existing = await ProbabilityOptionModel.findById(input.optionId);
      if (!existing) throw new Error('Option not found');
      if (existing.walletAddress !== input.walletAddress) throw new Error('Unauthorized');
      if (existing.exercisedAt) throw new Error('Option already exercised');
      throw new Error('Option cannot be exercised');
    }

    // Step 3: Calculate payout
    const intrinsicValue = option.intrinsicValue || 0;
    
    if (intrinsicValue <= 0) {
      // Rollback — option is not in the money
      await ProbabilityOptionModel.updateOne(
        { _id: input.optionId },
        { $set: { status: option.status, exercisedAt: null } }
      );
      throw new Error('Option is not in the money');
    }

    const payout = intrinsicValue;

    // Step 4: Send payout — option is already locked as 'exercised'
    try {
      const signature = await solanaService.sendPayout(
        input.walletAddress,
        payout
      );

      // Step 5: Save final payout data
      await ProbabilityOptionModel.updateOne(
        { _id: input.optionId },
        {
          $set: {
            finalProbability: option.currentProbability,
            payout,
          },
        }
      );

      return { signature, payout };
    } catch (error) {
      // Payout failed — rollback the exercise so user can retry
      console.error(`Payout failed for option ${input.optionId}, rolling back exercise:`, error);
      await ProbabilityOptionModel.updateOne(
        { _id: input.optionId },
        { $set: { status: option.status, exercisedAt: null } }
      );
      throw new Error('Payout transaction failed. Please try again.');
    }
  }

  /**
   * Get option by ID
   */
  async getOptionById(optionId: string): Promise<ProbabilityOption | null> {
    const option = await ProbabilityOptionModel.findById(optionId);
    return option ? option.toObject() : null;
  }

  /**
   * Get options by wallet address
   */
  async getOptionsByWallet(walletAddress: string): Promise<ProbabilityOption[]> {
    const options = await ProbabilityOptionModel.find({ walletAddress })
      .sort({ createdAt: -1 })
      .lean();
    return options;
  }

  /**
   * Get active options for settlement checking
   */
  async getActiveOptions(): Promise<ProbabilityOption[]> {
    const options = await ProbabilityOptionModel.find({
      status: { $in: ['active', 'profitable', 'unprofitable'] }
    }).lean();
    return options;
  }

  /**
   * Check and settle expired options
   */
  async settleExpiredOptions(): Promise<void> {
    const now = new Date();
    const expiredOptions = await ProbabilityOptionModel.find({
      status: { $in: ['active', 'profitable', 'unprofitable'] },
      expirationDate: { $lte: now }
    });

    for (const option of expiredOptions) {
      try {
        // Update with final market data
        const marketData = await jupiterService.getMarket(option.marketId);
        
        if (!marketData) {
          console.error(`Market ${option.marketId} not found for option ${option._id}`);
          continue;
        }
        
        const finalProbability = calculateProbabilityFromMarket(marketData);

        // Calculate final intrinsic value
        const intrinsicValue = this.calculateIntrinsicValue(
          finalProbability,
          option.strikePrice,
          option.optionType,
          option.notionalAmount
        );

        option.status = 'expired';
        option.finalProbability = finalProbability;
        option.intrinsicValue = intrinsicValue;
        option.timeValue = 0;
        
        await option.save();
        
        console.log(`✅ Settled expired option ${option._id}: ${option.optionType} @ ${option.strikePrice}, final value: ${intrinsicValue}`);
      } catch (error) {
        console.error(`❌ Error settling option ${option._id}:`, error);
      }
    }
  }

  /**
   * Get option statistics
   */
  async getStats(walletAddress?: string) {
    const query = walletAddress ? { walletAddress } : {};
    
    const [total, active, profitable, exercised, expired] = await Promise.all([
      ProbabilityOptionModel.countDocuments(query),
      ProbabilityOptionModel.countDocuments({ ...query, status: 'active' }),
      ProbabilityOptionModel.countDocuments({ ...query, status: 'profitable' }),
      ProbabilityOptionModel.countDocuments({ ...query, status: 'exercised' }),
      ProbabilityOptionModel.countDocuments({ ...query, status: 'expired' }),
    ]);

    // Calculate total premium paid and payouts received
    const options = await ProbabilityOptionModel.find(query).lean();
    const totalPremiumPaid = options.reduce((sum, opt) => sum + opt.premium, 0);
    const totalPayouts = options
      .filter(opt => opt.payout)
      .reduce((sum, opt) => sum + (opt.payout || 0), 0);

    return {
      total,
      active,
      profitable,
      exercised,
      expired,
      totalPremiumPaid,
      totalPayouts,
      netProfit: totalPayouts - totalPremiumPaid,
      profitRate: total > 0 ? (exercised / total) * 100 : 0,
    };
  }
  // ─── Options Chain & Payoff ────────────────────────────────────────

  /**
   * Generate a strike × expiry options chain grid for a market.
   */
  async generateOptionsChain(
    eventId: string,
    marketId: string
  ): Promise<{
    chain: OptionsChainEntry[];
    currentProbability: number;
    daysToExpiry: number;
    impliedVolatility: number;
  }> {
    const marketData = await jupiterService.getMarket(marketId);
    if (!marketData) throw new Error('Market not found');

    const currentProbability = calculateProbabilityFromMarket(marketData);
    const daysToExpiry = Math.max(0,
      (marketData.closeTime * 1000 - Date.now()) / (1000 * 60 * 60 * 24)
    );
    const impliedVolatility = await this.estimateImpliedVolatility(eventId, marketId);

    const strikes = [0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90];
    const expiryBuckets = [
      { days: 2, label: '2d' },
      { days: 7, label: '7d' },
      { days: 14, label: '14d' },
      { days: 30, label: '30d' },
    ].filter(b => b.days <= daysToExpiry); // don't show buckets past close

    // If no buckets fit, use remaining days
    if (expiryBuckets.length === 0 && daysToExpiry >= 1) {
      expiryBuckets.push({ days: Math.floor(daysToExpiry), label: `${Math.floor(daysToExpiry)}d` });
    }

    const chain: OptionsChainEntry[] = [];
    const notional = 1; // normalize to 1 SOL

    for (const strike of strikes) {
      for (const bucket of expiryBuckets) {
        const callQuote = await this.calculateOptionQuote({
          currentProbability,
          strikePrice: strike,
          timeToExpiration: bucket.days,
          impliedVolatility,
          notionalAmount: notional,
          optionType: 'CALL',
        });

        const putQuote = await this.calculateOptionQuote({
          currentProbability,
          strikePrice: strike,
          timeToExpiration: bucket.days,
          impliedVolatility,
          notionalAmount: notional,
          optionType: 'PUT',
        });

        chain.push({
          strike,
          expiryDays: bucket.days,
          expiryLabel: bucket.label,
          callPremium: Math.round(callQuote.premium * 10000) / 10000,
          putPremium: Math.round(putQuote.premium * 10000) / 10000,
          callDelta: Math.round(callQuote.delta * 1000) / 1000,
          putDelta: Math.round(putQuote.delta * 1000) / 1000,
          breakEvenCall: Math.round(callQuote.breakEvenProbability * 1000) / 1000,
          breakEvenPut: Math.round(putQuote.breakEvenProbability * 1000) / 1000,
        });
      }
    }

    return { chain, currentProbability, daysToExpiry, impliedVolatility };
  }

  /**
   * Generate payoff curve for a specific option configuration.
   * Returns 51 points across the probability axis.
   */
  generatePayoffCurve(
    strike: number,
    premium: number,
    notional: number,
    optionType: OptionType
  ): PayoffPoint[] {
    const points: PayoffPoint[] = [];
    for (let i = 0; i <= 50; i++) {
      const prob = i / 50; // 0, 0.02, 0.04, …, 1.0
      let pnl: number;
      if (optionType === 'CALL') {
        const intrinsic = Math.max(0, (prob - strike) * notional);
        pnl = intrinsic - premium;
      } else {
        const intrinsic = Math.max(0, (strike - prob) * notional);
        pnl = intrinsic - premium;
      }
      points.push({
        probability: Math.round(prob * 1000) / 1000,
        pnl: Math.round(pnl * 10000) / 10000,
      });
    }
    return points;
  }
}

export const probabilityOptionService = new ProbabilityOptionService();
