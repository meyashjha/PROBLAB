import { z } from 'zod';

/**
 * Probability Options (PFOs) - Second-order derivatives on prediction markets
 * 
 * Instead of betting on the final outcome, traders bet on probability movements.
 * This enables speculation on "volatility of belief" and hedging strategies.
 */

export const OptionType = z.enum(['CALL', 'PUT']);
export type OptionType = z.infer<typeof OptionType>;

export const OptionStatus = z.enum([
  'pending_payment',
  'active',
  'profitable',      // In the money
  'unprofitable',    // Out of the money
  'expired',
  'exercised',
  'claimed'
]);
export type OptionStatus = z.infer<typeof OptionStatus>;

/**
 * Strike Price: The probability threshold for the option
 * - CALL: Profits if market probability goes ABOVE strike
 * - PUT: Profits if market probability goes BELOW strike
 */
export interface ProbabilityOption {
  _id?: string;
  userId?: string; // Deprecated — use walletAddress. Kept optional for backwards compat.
  walletAddress: string;
  
  // Underlying event
  eventId: string;
  marketId: string;
  eventTitle: string;
  eventDescription: string;
  eventSettlementDate: Date;
  
  // Option parameters
  optionType: OptionType;           // CALL or PUT
  strikePrice: number;              // Probability threshold (0-1)
  premium: number;                  // Cost to buy option (in SOL)
  notionalAmount: number;           // Size of position (in SOL)
  
  // Market data at creation
  initialProbability: number;       // Market probability when option created
  impliedVolatility: number;        // Estimated probability volatility
  
  // Current state
  currentProbability?: number;      // Latest market probability
  intrinsicValue?: number;          // Current profit if exercised
  timeValue?: number;               // Remaining time value
  
  // Lifecycle
  status: OptionStatus;
  expirationDate: Date;             // When option expires
  exercisedAt?: Date;
  claimedAt?: Date;
  
  // Settlement
  finalProbability?: number;        // Probability at expiration
  payout?: number;                  // Final payout amount
  
  // Blockchain
  tokenMint?: string;
  paymentTxSignature?: string;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Option pricing model parameters
 */
export interface OptionPricingParams {
  currentProbability: number;       // Current market probability (0-1)
  strikePrice: number;              // Strike probability (0-1)
  timeToExpiration: number;         // Days until expiration
  impliedVolatility: number;        // Probability volatility estimate
  notionalAmount: number;           // Position size
  optionType: OptionType;
}

/**
 * Option quote with pricing breakdown
 */
export interface OptionQuote {
  premium: number;                  // Cost to buy option
  intrinsicValue: number;           // Immediate profit if exercised
  timeValue: number;                // Value from remaining time
  breakEvenProbability: number;     // Probability needed to break even
  maxProfit: number;                // Maximum possible profit
  maxLoss: number;                  // Maximum possible loss (premium)
  probabilityOfProfit: number;      // Estimated chance of profit
  delta: number;                    // Sensitivity to probability change
  theta: number;                    // Time decay per day
  vega: number;                     // Sensitivity to volatility
}

/**
 * Create option input
 */
export const CreateOptionSchema = z.object({
  walletAddress: z.string().min(32),
  eventId: z.string(),
  marketId: z.string(),
  eventTitle: z.string(),
  eventDescription: z.string(),
  eventSettlementDate: z.string().or(z.date()),
  optionType: OptionType,
  strikePrice: z.number().min(0).max(1),
  notionalAmount: z.number().positive().min(0.1),
  expirationDate: z.string().or(z.date()),
  txSignature: z.string().optional(), // Payment transaction signature (optional for backwards compatibility)
});

export type CreateOptionInput = z.infer<typeof CreateOptionSchema>;

/**
 * Confirm payment input
 */
export const ConfirmOptionPaymentSchema = z.object({
  optionId: z.string(),
  txSignature: z.string(),
});

export type ConfirmOptionPaymentInput = z.infer<typeof ConfirmOptionPaymentSchema>;

/**
 * Exercise option input
 */
export const ExerciseOptionSchema = z.object({
  optionId: z.string(),
  walletAddress: z.string(),
});

export type ExerciseOptionInput = z.infer<typeof ExerciseOptionSchema>;

/**
 * Option strategy templates
 */
export interface OptionStrategy {
  name: string;
  description: string;
  marketView: string;
  options: Array<{
    type: OptionType;
    strikeOffset: number;  // Offset from current probability
    notionalRatio: number; // Ratio of total capital
  }>;
}

export const OPTION_STRATEGIES: OptionStrategy[] = [
  {
    name: 'Bullish Call',
    description: 'Bet on increasing confidence',
    marketView: 'Expect probability to rise significantly',
    options: [
      { type: 'CALL', strikeOffset: 0.10, notionalRatio: 1.0 }
    ]
  },
  {
    name: 'Bearish Put',
    description: 'Bet on decreasing confidence',
    marketView: 'Expect probability to fall significantly',
    options: [
      { type: 'PUT', strikeOffset: -0.10, notionalRatio: 1.0 }
    ]
  },
  {
    name: 'Long Straddle',
    description: 'Bet on high volatility (any direction)',
    marketView: 'Expect large probability movement in either direction',
    options: [
      { type: 'CALL', strikeOffset: 0, notionalRatio: 0.5 },
      { type: 'PUT', strikeOffset: 0, notionalRatio: 0.5 }
    ]
  },
  {
    name: 'Bull Call Spread',
    description: 'Moderate bullish bet with limited risk',
    marketView: 'Expect moderate probability increase',
    options: [
      { type: 'CALL', strikeOffset: 0.05, notionalRatio: 1.0 },
      { type: 'CALL', strikeOffset: 0.15, notionalRatio: -1.0 } // Sell higher strike
    ]
  },
  {
    name: 'Iron Condor',
    description: 'Bet on low volatility (range-bound)',
    marketView: 'Expect probability to stay within range',
    options: [
      { type: 'PUT', strikeOffset: -0.15, notionalRatio: -1.0 },
      { type: 'PUT', strikeOffset: -0.05, notionalRatio: 1.0 },
      { type: 'CALL', strikeOffset: 0.05, notionalRatio: 1.0 },
      { type: 'CALL', strikeOffset: 0.15, notionalRatio: -1.0 }
    ]
  }
];

/**
 * Historical probability snapshot for volatility calculation
 */
export interface ProbabilitySnapshot {
  eventId: string;
  marketId: string;
  probability: number;
  timestamp: Date;
  volume?: number;
}

/**
 * Volatility metrics
 */
export interface VolatilityMetrics {
  historicalVolatility: number;     // Realized volatility from past data
  impliedVolatility: number;        // Forward-looking volatility estimate
  volatilityTrend: 'increasing' | 'decreasing' | 'stable';
  confidenceInterval: {
    lower: number;
    upper: number;
  };
}

// ─── Market Quality & Scoring ────────────────────────────────────────

/**
 * A market that passed quality filters and has been scored.
 * Score weights are starting guesses – tune after observing real data.
 */
export interface ScoredMarket {
  eventId: string;
  marketId: string;
  eventTitle: string;
  marketTitle: string;
  category: string;
  currentProbability: number;
  daysToExpiry: number;
  volume: number;                    // USD
  spread: number;                    // 0-1 fraction
  notionalDepth: number;             // USD notional from orderbook
  hasRulesPrimary: boolean;
  hasRulesSecondary: boolean;
  hasExplicitClose: boolean;
  rulesPrimary: string;
  score: number;                     // 0-100 composite
  scoreBreakdown: {
    liquidity: number;               // 0-30
    volatility: number;              // 0-20
    catalyst: number;                // 0-20
    ruleClarity: number;             // 0-15
    manipulationResistance: number;  // 0-15
  };
  pricing: {
    buyYes: number;
    buyNo: number;
    sellYes: number;
    sellNo: number;
  };
  imageUrl?: string;
}

/**
 * One cell in the strike × expiry options chain grid
 */
export interface OptionsChainEntry {
  strike: number;                    // 0-1
  expiryDays: number;
  expiryLabel: string;               // "2d", "7d", "14d", "30d"
  callPremium: number;
  putPremium: number;
  callDelta: number;
  putDelta: number;
  breakEvenCall: number;
  breakEvenPut: number;
}

/**
 * Persisted probability snapshot for volatility analysis
 */
export interface MarketSnapshotData {
  _id?: string;
  marketId: string;
  eventId: string;
  probability: number;
  buyYes: number;
  buyNo: number;
  volume: number;
  spread: number;
  notionalDepth: number;
  score: number;
  timestamp: Date;
}

/**
 * Single point on a payoff curve
 */
export interface PayoffPoint {
  probability: number;               // x-axis: 0 to 1
  pnl: number;                       // y-axis: profit/loss in SOL
}
