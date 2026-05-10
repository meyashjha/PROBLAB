import { z } from 'zod';

export const MultiplierTier = z.enum(['3x', '5x', '10x']);
export type MultiplierTier = z.infer<typeof MultiplierTier>;

export const ParlayStatus = z.enum([
  'pending_payment',
  'active',
  'won',
  'lost',
  'expired',
  'claimed'
]);
export type ParlayStatus = z.infer<typeof ParlayStatus>;

export const OutcomeType = z.enum(['YES', 'NO']);
export type OutcomeType = z.infer<typeof OutcomeType>;

export const EventStatus = z.enum(['active', 'won', 'lost', 'cancelled']);
export type EventStatus = z.infer<typeof EventStatus>;

export interface PredictionEvent {
  eventId: string;
  marketId: string;
  title: string;
  description: string;
  settlementDate: Date;
  status: EventStatus;
  selectedOutcome: OutcomeType;
  actualOutcome?: OutcomeType;
  currentOdds?: {
    yes: number;
    no: number;
  };
}

export interface Parlay {
  _id?: string;
  userId?: string; // Deprecated — use walletAddress. Kept optional for backwards compat with existing records.
  walletAddress: string;
  events: PredictionEvent[];
  multiplier: MultiplierTier;
  principalAmount: number; // in SOL
  potentialPayout: number; // in SOL
  status: ParlayStatus;
  tokenMint?: string; // SPL token mint address
  paymentTxSignature?: string;
  createdAt: Date;
  updatedAt: Date;
  settledAt?: Date;
  claimedAt?: Date;
  finalSettlementDate: Date; // Latest settlement date among all events
  quoteData?: {
    combinedProbability: number;
    fairOdds: number;
    offeredOdds: number;
    houseEdge: number;
    expectedValue: number;
    calculatedAt: Date;
  };
}

export const CreateParlaySchema = z.object({
  walletAddress: z.string().min(32),
  events: z.array(z.object({
    eventId: z.string(),
    marketId: z.string(),
    title: z.string(),
    description: z.string(),
    settlementDate: z.string().or(z.date()),
    selectedOutcome: OutcomeType,
  })).min(2),
  multiplier: MultiplierTier.optional(), // Optional - legacy field for backwards compatibility
  principalAmount: z.number().positive().min(1),
});

export type CreateParlayInput = z.infer<typeof CreateParlaySchema>;

export const ConfirmPaymentSchema = z.object({
  parlayId: z.string(),
  txSignature: z.string(),
});

export type ConfirmPaymentInput = z.infer<typeof ConfirmPaymentSchema>;

export const ClaimParlaySchema = z.object({
  parlayId: z.string(),
  walletAddress: z.string(),
});

export type ClaimParlayInput = z.infer<typeof ClaimParlaySchema>;

export interface MultiplierRule {
  tier: MultiplierTier;
  multiplier: number;
  minEvents: number;
}

export const MULTIPLIER_RULES: MultiplierRule[] = [
  { tier: '3x', multiplier: 3, minEvents: 3 },
  { tier: '5x', multiplier: 5, minEvents: 5 },
  { tier: '10x', multiplier: 10, minEvents: 10 },
];

export function getMultiplierValue(tier: MultiplierTier): number {
  return MULTIPLIER_RULES.find(r => r.tier === tier)?.multiplier || 3;
}

export function getMinEventsForMultiplier(tier: MultiplierTier): number {
  return MULTIPLIER_RULES.find(r => r.tier === tier)?.minEvents || 3;
}

export function validateParlayRules(events: number, tier: MultiplierTier): boolean {
  const minEvents = getMinEventsForMultiplier(tier);
  return events >= minEvents;
}
