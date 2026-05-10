/**
 * Jupiter Prediction Market API Types
 * Based on official API spec: https://api.jup.ag/prediction/v1
 * Price convention: 1,000,000 native units = $1.00 USD
 */

export interface EventMetadata {
  eventId: string;
  title?: string;
  subtitle?: string;
  slug?: string;
  series?: string;
  closeTime?: string; // ISO 8601
  imageUrl?: string;
  isLive?: boolean;
}

export interface MarketMetadata {
  marketId: string;
  title?: string;
  status?: string;
  result?: string;
  closeTime?: number; // Unix timestamp
  openTime?: number; // Unix timestamp
  isTeamMarket?: boolean;
  rulesPrimary?: string;
  rulesSecondary?: string;
}

export interface MarketPricing {
  buyYesPriceUsd?: number | null; // Native units (1,000,000 = $1.00)
  buyNoPriceUsd?: number | null;
  sellYesPriceUsd?: number | null;
  sellNoPriceUsd?: number | null;
  volume?: number; // Trading volume
}

export interface JupiterMarket {
  marketId: string;
  status: 'open' | 'closed' | 'cancelled' | 'settled';
  result: string | null; // "yes", "no", or null
  openTime: number; // Unix timestamp (seconds)
  closeTime: number; // Unix timestamp (seconds)
  resolveAt?: number | null;
  marketResultPubkey?: string | null;
  imageUrl?: string | null;
  // As of April 10, 2026: metadata fields moved to top level
  title?: string;
  isTeamMarket?: boolean;
  rulesPrimary?: string;
  rulesSecondary?: string;
  // Legacy metadata object (deprecated, removed after April 10, 2026)
  metadata?: MarketMetadata;
  pricing?: MarketPricing;
}

export interface JupiterEvent {
  eventId: string;
  isActive: boolean;
  isLive: boolean;
  category: string; // crypto, sports, politics, esports, culture, economics, tech
  subcategory?: string;
  tags?: string[];
  metadata?: EventMetadata;
  markets?: JupiterMarket[];
  volumeUsd?: string;
  closeCondition?: string;
  beginAt?: string | null; // Unix timestamp
  rulesPdf?: string;
}

export interface JupiterEventsResponse {
  data: JupiterEvent[];
  pagination?: {
    start: number;
    end: number;
    total: number;
    hasNext: boolean;
  };
}

export interface JupiterMarketResponse {
  market: JupiterMarket;
  orderbook?: {
    bids: OrderbookEntry[];
    asks: OrderbookEntry[];
  };
}

export interface OrderbookEntry {
  price: number;
  size: number;
}

export interface JupiterPosition {
  marketId: string;
  outcome: 'YES' | 'NO';
  contracts: number;
  averagePrice: number;
  currentValue: number;
  claimable: boolean;
}
