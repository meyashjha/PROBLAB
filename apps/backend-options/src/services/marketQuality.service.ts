import { jupiterService } from '@parlay-tokens/backend-shared';
import type {
  JupiterEvent,
  JupiterMarket,
  ScoredMarket,
} from '@parlay-tokens/shared';

const FILTER = {
  MIN_DAYS_TO_EXPIRY: 2,
  MIN_EVENT_VOLUME_USD: 100,
  MAX_SPREAD: 0.15,
} as const;

const WEIGHT = {
  LIQUIDITY: 0.30,
  VOLATILITY_OPP: 0.20,
  CATALYST: 0.20,
  RULE_CLARITY: 0.15,
  MANIP_RESISTANCE: 0.15,
} as const;

const VOLUME_CAP_USD = 50_000;
const CATALYST_WINDOW_DAYS = 30;
const PRICE_UNIT = 1_000_000;

function computeSpread(market: JupiterMarket): number {
  const buyYes = market.pricing?.buyYesPriceUsd ?? 0;
  const buyNo = market.pricing?.buyNoPriceUsd ?? 0;
  if (buyYes <= 0 && buyNo <= 0) return 1;
  return Math.abs(buyYes + buyNo - PRICE_UNIT) / PRICE_UNIT;
}

function computeProbability(market: JupiterMarket): number {
  const buyYes = market.pricing?.buyYesPriceUsd ?? 0;
  const buyNo = market.pricing?.buyNoPriceUsd ?? 0;
  if (buyYes <= 0 && buyNo <= 0) return 0.5;
  return buyYes / (buyYes + buyNo);
}

function daysUntil(unixSeconds: number): number {
  return Math.max(0, (unixSeconds * 1000 - Date.now()) / (1000 * 60 * 60 * 24));
}

function getTitle(event: JupiterEvent): string {
  return event.metadata?.title || event.eventId;
}

function getMarketTitle(market: JupiterMarket): string {
  return market.title || market.metadata?.title || market.marketId;
}

function parseEventVolume(event: JupiterEvent): number {
  const raw = (event as any).volumeUsd;
  if (raw == null) return 0;
  const parsed = parseFloat(String(raw));
  return isNaN(parsed) ? 0 : parsed;
}

export class MarketQualityService {
  private cache: { markets: ScoredMarket[]; ts: number } | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  async getScoredMarkets(options?: {
    category?: string;
    limit?: number;
  }): Promise<ScoredMarket[]> {
    if (this.cache && Date.now() - this.cache.ts < this.CACHE_TTL_MS) {
      return this.applyClientFilters(this.cache.markets, options);
    }

    const events = await jupiterService.getAllEvents({
      sortBy: 'volume',
      sortDirection: 'desc',
      limit: 200,
    });

    console.log(`📊 Fetched ${events.length} events (sorted by volume desc), flattening…`);

    // Log a few sample event volumes to understand the data
    for (const event of events.slice(0, 5)) {
      const evVol = parseEventVolume(event);
      const mktVols = (event.markets || []).map(m => m.pricing?.volume ?? 0);
      console.log(`   📋 Event "${(event.metadata?.title || event.eventId).slice(0, 40)}" volumeUsd="${(event as any).volumeUsd}" → $${evVol.toFixed(2)} | market pricing.volume=[${mktVols.slice(0, 3).join(', ')}]`);
    }

    // Flatten to (event, market) pairs, carrying event volume
    const pairs: { event: JupiterEvent; market: JupiterMarket; eventVolumeUsd: number }[] = [];
    for (const event of events) {
      if (!event.markets || event.markets.length === 0) continue;
      const evVol = parseEventVolume(event);
      for (const market of event.markets) {
        pairs.push({ event, market, eventVolumeUsd: evVol });
      }
    }

    console.log(`📊 ${pairs.length} total event×market pairs to evaluate`);

    const rejected = {
      notOpen: 0,
      tooSoon: 0,
      lowVolume: 0,
      wideSpread: 0,
      noRules: 0,
      noPricing: 0,
      error: 0,
    };

    const scored: ScoredMarket[] = [];
    for (const { event, market, eventVolumeUsd } of pairs) {
      try {
        const result = this.filterAndScore(event, market, eventVolumeUsd, rejected);
        if (result) scored.push(result);
      } catch (err) {
        rejected.error++;
        console.warn(`⚠️ Failed to score market ${market.marketId}:`, err);
      }
    }

    scored.sort((a, b) => b.score - a.score);
    this.cache = { markets: scored, ts: Date.now() };

    console.log(`📊 Market quality: ${pairs.length} total → ${scored.length} passed filters`);
    console.log(`   Rejected: notOpen=${rejected.notOpen} tooSoon=${rejected.tooSoon} lowVolume=${rejected.lowVolume} wideSpread=${rejected.wideSpread} noRules=${rejected.noRules} noPricing=${rejected.noPricing} error=${rejected.error}`);

    return this.applyClientFilters(scored, options);
  }

  invalidateCache(): void {
    this.cache = null;
  }

  private applyClientFilters(
    markets: ScoredMarket[],
    options?: { category?: string; limit?: number }
  ): ScoredMarket[] {
    let result = markets;
    if (options?.category && options.category !== 'all') {
      result = result.filter(m => m.category === options.category);
    }
    if (options?.limit) {
      result = result.slice(0, options.limit);
    }
    return result;
  }

  private filterAndScore(
    event: JupiterEvent,
    market: JupiterMarket,
    eventVolumeUsd: number,
    rejected: Record<string, number>
  ): ScoredMarket | null {
    if (market.status !== 'open') { rejected.notOpen++; return null; }

    const buyYes = market.pricing?.buyYesPriceUsd;
    const buyNo = market.pricing?.buyNoPriceUsd;
    if (buyYes == null && buyNo == null) { rejected.noPricing++; return null; }

    const days = daysUntil(market.closeTime);
    if (days < FILTER.MIN_DAYS_TO_EXPIRY) { rejected.tooSoon++; return null; }

    if (eventVolumeUsd < FILTER.MIN_EVENT_VOLUME_USD) { rejected.lowVolume++; return null; }

    const spread = computeSpread(market);
    if (spread > FILTER.MAX_SPREAD) { rejected.wideSpread++; return null; }

    const rulesPrimary = market.rulesPrimary || market.metadata?.rulesPrimary || '';
    if (!rulesPrimary.trim()) { rejected.noRules++; return null; }

    const prob = computeProbability(market);
    const rulesSecondary = market.rulesSecondary || market.metadata?.rulesSecondary || '';
    const hasRulesPrimary = rulesPrimary.trim().length > 0;
    const hasRulesSecondary = rulesSecondary.trim().length > 0;
    const hasExplicitClose = market.closeTime > 0;

    const volForScoring = eventVolumeUsd;

    const liquidity = Math.min(1, volForScoring / VOLUME_CAP_USD) * (WEIGHT.LIQUIDITY * 100);
    const volatility = (1 - 2 * Math.abs(prob - 0.5)) * (WEIGHT.VOLATILITY_OPP * 100);
    const catalyst = Math.max(0, 1 - days / CATALYST_WINDOW_DAYS) * (WEIGHT.CATALYST * 100);

    const fieldCount =
      (hasRulesPrimary ? 1 : 0) +
      (hasRulesSecondary ? 1 : 0) +
      (hasExplicitClose ? 1 : 0);
    const ruleClarity = (fieldCount / 3) * (WEIGHT.RULE_CLARITY * 100);

    const spreadTightness = Math.max(0, 1 - spread / FILTER.MAX_SPREAD);
    const volumeStrength = Math.min(1, volForScoring / 10000);
    const manipulationResistance =
      (spreadTightness * 0.6 + volumeStrength * 0.4) * (WEIGHT.MANIP_RESISTANCE * 100);

    const score = liquidity + volatility + catalyst + ruleClarity + manipulationResistance;

    return {
      eventId: event.eventId,
      marketId: market.marketId,
      eventTitle: getTitle(event),
      marketTitle: getMarketTitle(market),
      category: event.category || 'other',
      currentProbability: prob,
      daysToExpiry: Math.round(days * 10) / 10,
      volume: Math.round(volForScoring * 100) / 100,
      spread: Math.round(spread * 10000) / 10000,
      notionalDepth: 0,
      hasRulesPrimary,
      hasRulesSecondary,
      hasExplicitClose,
      rulesPrimary,
      score: Math.round(score * 10) / 10,
      scoreBreakdown: {
        liquidity: Math.round(liquidity * 10) / 10,
        volatility: Math.round(volatility * 10) / 10,
        catalyst: Math.round(catalyst * 10) / 10,
        ruleClarity: Math.round(ruleClarity * 10) / 10,
        manipulationResistance: Math.round(manipulationResistance * 10) / 10,
      },
      pricing: {
        buyYes: market.pricing?.buyYesPriceUsd ?? 0,
        buyNo: market.pricing?.buyNoPriceUsd ?? 0,
        sellYes: market.pricing?.sellYesPriceUsd ?? 0,
        sellNo: market.pricing?.sellNoPriceUsd ?? 0,
      },
      imageUrl: market.imageUrl || event.metadata?.imageUrl || undefined,
    };
  }
}

export const marketQualityService = new MarketQualityService();
