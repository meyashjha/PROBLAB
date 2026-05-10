import { jupiterService } from '@parlay-tokens/backend-shared';
import { parlayService } from './parlay.service';

export class SettlementService {
  /**
   * Check and update settlement status for all active parlays
   */
  async checkSettlements(): Promise<void> {
    console.log('🔍 Checking parlay settlements...');
    
    try {
      // Get both active and lost parlays (lost parlays may have unsettled events)
      const activeParlays = await parlayService.getActiveParlays();
      const lostParlays = await parlayService.getLostParlaysWithPendingEvents();
      const allParlays = [...activeParlays, ...lostParlays];
      
      console.log(`Found ${activeParlays.length} active parlays and ${lostParlays.length} lost parlays with pending events`);

      for (const parlay of allParlays) {
        try {
          await this.checkParlaySettlement(parlay._id!.toString());
        } catch (error) {
          console.error(`Error checking parlay ${parlay._id}:`, error);
        }
      }

      console.log('✅ Settlement check completed');
    } catch (error) {
      console.error('❌ Error in settlement check:', error);
    }
  }

  /**
   * Check settlement for a specific parlay
   */
  async checkParlaySettlement(parlayId: string): Promise<void> {
    const parlay = await parlayService.getParlayById(parlayId);
    
    // Check active parlays and lost parlays (to settle remaining events)
    if (!parlay || (parlay.status !== 'active' && parlay.status !== 'lost')) {
      return;
    }

    console.log(`\n🔍 Checking parlay ${parlayId} (status: ${parlay.status}) with ${parlay.events.length} events`);

    let hasUpdate = false;
    let hasLostEvent = false;

    // Check ALL events, even if one is lost
    // This allows users to see the results of all events
    for (const event of parlay.events) {
      // Skip already settled events
      if (event.status === 'won' || event.status === 'lost' || event.status === 'cancelled') {
        console.log(`  ⏭️  Event ${event.eventId} already ${event.status}`);
        if (event.status === 'lost') {
          hasLostEvent = true;
        }
        continue;
      }

      console.log(`  🔎 Checking event ${event.eventId} (market: ${event.marketId})`);

      // Check if event has settled
      const settlement = await jupiterService.checkEventSettlement(
        event.eventId,
        event.marketId
      );

      if (settlement.settled && settlement.outcome) {
        console.log(
          `  ✅ Event ${event.eventId} settled: ${settlement.outcome} (user selected: ${event.selectedOutcome})`
        );

        await parlayService.updateEventStatus(
          parlayId,
          event.eventId,
          'active', // This will be overridden by updateEventStatus based on outcome
          settlement.outcome
        );

        hasUpdate = true;

        // Track if this event was lost, but continue checking other events
        if (event.selectedOutcome !== settlement.outcome) {
          console.log(`  ❌ User prediction WRONG`);
          hasLostEvent = true;
        } else {
          console.log(`  ✅ User prediction CORRECT!`);
        }
      } else {
        console.log(`  ⏳ Event ${event.eventId} not settled yet`);
      }
    }

    if (hasUpdate) {
      console.log(`✅ Updated parlay ${parlayId}${hasLostEvent ? ' (has lost event)' : ''}`);
    } else {
      console.log(`⏳ No updates for parlay ${parlayId}`);
    }
  }

  /**
   * Check for expired parlays (past final settlement date but not settled)
   */
  async checkExpiredParlays(): Promise<void> {
    console.log('🔍 Checking for expired parlays...');
    
    try {
      const activeParlays = await parlayService.getActiveParlays();
      const now = new Date();

      for (const parlay of activeParlays) {
        // If past final settlement date + grace period (7 days)
        const gracePeriod = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
        const expiryDate = new Date(parlay.finalSettlementDate.getTime() + gracePeriod);

        if (now > expiryDate) {
          console.log(`Parlay ${parlay._id} expired — cancelling all ${parlay.events.length} events`);
          
          // Cancel ALL events that are still active, not just the first one
          for (const event of parlay.events) {
            if (event.status === 'active') {
              await parlayService.updateEventStatus(
                parlay._id!.toString(),
                event.eventId,
                'cancelled'
              );
            }
          }
        }
      }

      console.log('✅ Expired parlay check completed');
    } catch (error) {
      console.error('❌ Error checking expired parlays:', error);
    }
  }
}

export const settlementService = new SettlementService();
