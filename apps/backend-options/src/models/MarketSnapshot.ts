import mongoose, { Schema, Document } from 'mongoose';
import type { MarketSnapshotData } from '@parlay-tokens/shared';

export interface MarketSnapshotDocument extends Omit<MarketSnapshotData, '_id'>, Document {}

const MarketSnapshotSchema = new Schema<MarketSnapshotDocument>({
  marketId: { type: String, required: true, index: true },
  eventId: { type: String, required: true, index: true },
  probability: { type: Number, required: true, min: 0, max: 1 },
  buyYes: { type: Number, required: true },
  buyNo: { type: Number, required: true },
  volume: { type: Number, required: true },
  spread: { type: Number, required: true },
  notionalDepth: { type: Number, required: true },
  score: { type: Number, required: true },
  timestamp: { type: Date, required: true, default: Date.now },
}, {
  timestamps: false, // we manage timestamp ourselves
});

// Compound index for efficient range queries
MarketSnapshotSchema.index({ marketId: 1, timestamp: -1 });

// TTL index: auto-delete snapshots older than 90 days
MarketSnapshotSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const MarketSnapshotModel = mongoose.model<MarketSnapshotDocument>(
  'MarketSnapshot',
  MarketSnapshotSchema
);
