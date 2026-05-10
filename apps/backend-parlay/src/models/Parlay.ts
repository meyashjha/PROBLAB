import mongoose, { Schema, Document } from 'mongoose';
import type { Parlay as IParlayType, PredictionEvent } from '@parlay-tokens/shared';

export interface ParlayDocument extends Omit<IParlayType, '_id'>, Document {}

const PredictionEventSchema = new Schema<PredictionEvent>({
  eventId: { type: String, required: true },
  marketId: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  settlementDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ['active', 'won', 'lost', 'cancelled'],
    default: 'active',
  },
  selectedOutcome: {
    type: String,
    enum: ['YES', 'NO'],
    required: true,
  },
  actualOutcome: {
    type: String,
    enum: ['YES', 'NO'],
  },
  currentOdds: {
    yes: Number,
    no: Number,
  },
}, { _id: false });

const ParlaySchema = new Schema<ParlayDocument>({
  walletAddress: {
    type: String,
    required: true,
    index: true,
    validate: {
      validator: (v: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v),
      message: 'Invalid Solana wallet address format',
    },
  },
  events: [PredictionEventSchema],
  // DEPRECATED: multiplier field kept for backwards compatibility with existing parlays
  // New parlays use quoteData.offeredOdds instead
  multiplier: {
    type: String,
    enum: ['3x', '5x', '10x'],
  },
  principalAmount: { type: Number, required: true },
  potentialPayout: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending_payment', 'active', 'won', 'lost', 'expired', 'claimed'],
    default: 'active', // New parlays start as active (payment required upfront)
    index: true,
  },
  tokenMint: { type: String },
  paymentTxSignature: { type: String, required: true }, // Required: payment must be verified
  finalSettlementDate: { type: Date, required: true },
  settledAt: { type: Date },
  claimedAt: { type: Date },
  // Payment deadline for legacy pending_payment parlays
  paymentDeadline: { type: Date },
  // Quote engine data
  quoteData: {
    combinedProbability: Number,
    fairOdds: Number,
    offeredOdds: Number,
    houseEdge: Number,
    expectedValue: Number,
    calculatedAt: Date,
  },
}, {
  timestamps: true,
});

// Indexes for efficient queries
ParlaySchema.index({ status: 1, finalSettlementDate: 1 });
ParlaySchema.index({ 'events.eventId': 1 });
ParlaySchema.index({ createdAt: -1 });

export const ParlayModel = mongoose.model<ParlayDocument>('Parlay', ParlaySchema);
