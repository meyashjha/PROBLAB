/**
 * Migration Script: Handle Existing Pending Payment Parlays
 * 
 * This script handles existing pending_payment parlays after the payment logic fix.
 * It sets payment deadlines for pending parlays and expires those with settled events.
 * 
 * Run this ONCE before deploying the new payment logic:
 * npx ts-node scripts/migrate-pending-parlays.ts
 */

import mongoose from 'mongoose';
import { ParlayModel } from '../src/models/Parlay';
import { connectDatabase } from '@parlay-tokens/backend-shared';

async function migratePendingParlays() {
  try {
    console.log('🔄 Starting migration of pending payment parlays...');
    
    await connectDatabase();
    console.log('✅ Connected to database');

    // Find all pending_payment parlays
    const pendingParlays = await ParlayModel.find({ status: 'pending_payment' });
    console.log(`📊 Found ${pendingParlays.length} pending payment parlays`);

    let expiredCount = 0;
    let deadlineSetCount = 0;

    for (const parlay of pendingParlays) {
      // Check if any events have already settled
      const hasSettledEvents = parlay.events.some(e => e.status !== 'active');
      
      if (hasSettledEvents) {
        // Mark as expired (user tried to exploit timing)
        parlay.status = 'expired';
        await parlay.save();
        expiredCount++;
        console.log(`⏰ Expired parlay ${parlay._id} (has settled events)`);
      } else {
        // Give user 24 hours to pay
        parlay.paymentDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await parlay.save();
        deadlineSetCount++;
        console.log(`⏱️  Set 24h deadline for parlay ${parlay._id}`);
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   Total pending parlays: ${pendingParlays.length}`);
    console.log(`   Expired (had settled events): ${expiredCount}`);
    console.log(`   Given 24h deadline: ${deadlineSetCount}`);
    console.log('\n✅ Migration completed successfully');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migratePendingParlays();
