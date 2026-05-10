import cron from 'node-cron';
import { settlementService } from '../services/settlement.service';
import { parlayService } from '../services/parlay.service';

/**
 * Schedule settlement checks
 * Runs every 5 minutes
 */
export function startSettlementJob() {
  console.log('📅 Starting settlement job (every 5 minutes)');

  cron.schedule('*/5 * * * *', async () => {
    console.log('⏰ Running settlement check...');
    try {
      await settlementService.checkSettlements();
    } catch (error) {
      console.error('❌ Settlement job error:', error);
    }
  });
}

/**
 * Schedule expired parlay checks
 * Runs once daily at midnight
 */
export function startExpiredParlayJob() {
  console.log('📅 Starting expired parlay job (daily at midnight)');

  cron.schedule('0 0 * * *', async () => {
    console.log('⏰ Running expired parlay check...');
    try {
      await settlementService.checkExpiredParlays();
    } catch (error) {
      console.error('❌ Expired parlay job error:', error);
    }
  });
}

/**
 * Schedule pending payment expiration checks
 * Runs every 5 minutes to prevent timing exploits
 * 
 * This job expires pending_payment parlays that:
 * 1. Have passed their payment deadline
 * 2. Have events that have already started settling
 */
export function startExpirePendingJob() {
  console.log('📅 Starting expire pending payment job (every 5 minutes)');

  cron.schedule('*/5 * * * *', async () => {
    console.log('⏰ Running expire pending payment check...');
    try {
      const expiredCount = await parlayService.expirePendingParlays();
      if (expiredCount > 0) {
        console.log(`⏰ Expired ${expiredCount} pending payment parlays`);
      }
    } catch (error) {
      console.error('❌ Expire pending payment job error:', error);
    }
  });
}
