import mongoose, { Schema, Document } from 'mongoose';
import type { ProbabilityOption as IProbabilityOption } from '@parlay-tokens/shared';

export interface ProbabilityOptionDocument extends Omit<IProbabilityOption, '_id'>, Document {}

const ProbabilityOptionSchema = new Schema<ProbabilityOptionDocument>({
  walletAddress: {
    type: String,
    required: true,
    index: true,
    validate: {
      validator: (v: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v),
      message: 'Invalid Solana wallet address format',
    },
  },
  
  // Underlying event
  eventId: { type: String, required: true, index: true },
  marketId: { type: String, required: true },
  eventTitle: { type: String, required: true },
  eventDescription: { type: String, required: true },
  eventSettlementDate: { type: Date, required: true },
  
  // Option parameters
  optionType: {
    type: String,
    enum: ['CALL', 'PUT'],
    required: true,
  },
  strikePrice: { type: Number, required: true, min: 0, max: 1 },
  premium: { type: Number, required: true },
  notionalAmount: { type: Number, required: true },
  
  // Market data at creation
  initialProbability: { type: Number, required: true, min: 0, max: 1 },
  impliedVolatility: { type: Number, required: true },
  
  // Current state
  currentProbability: { type: Number, min: 0, max: 1 },
  intrinsicValue: { type: Number },
  timeValue: { type: Number },
  
  // Lifecycle
  status: {
    type: String,
    enum: ['pending_payment', 'active', 'profitable', 'unprofitable', 'expired', 'exercised', 'claimed'],
    default: 'pending_payment',
    index: true,
  },
  expirationDate: { type: Date, required: true, index: true },
  exercisedAt: { type: Date },
  claimedAt: { type: Date },
  
  // Settlement
  finalProbability: { type: Number, min: 0, max: 1 },
  payout: { type: Number },
  
  // Blockchain
  tokenMint: { type: String },
  paymentTxSignature: { type: String },
}, {
  timestamps: true,
});

// Indexes for efficient queries
ProbabilityOptionSchema.index({ status: 1, expirationDate: 1 });
ProbabilityOptionSchema.index({ eventId: 1, status: 1 });
ProbabilityOptionSchema.index({ walletAddress: 1, status: 1 });
ProbabilityOptionSchema.index({ createdAt: -1 });

export const ProbabilityOptionModel = mongoose.model<ProbabilityOptionDocument>(
  'ProbabilityOption',
  ProbabilityOptionSchema
);
