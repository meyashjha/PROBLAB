import { jupiterService } from '@parlay-tokens/backend-shared';

/**
 * Quote Engine for calculating fair, probability-based odds for parlays
 * Uses Jupiter Prediction API market prices to derive implied probabilities
 */

export interface MarketOdds {
  marketId: string;
  eventId: string;
  title: string;
  selectedOutcome: 'YES' | 'NO';
  impliedProbability: number; // 0-1 (e.g., 0.65 = 65%)
  fairOdds: number; // Decimal odds (e.g., 1.54)
  marketPrice: number; // Raw price from Jupiter (in micro USD)
}

export interface ParlayQuote {
  events: MarketOdds[];
  combinedProbability: number; // Product of all probabilities
  fairParlayOdds: number; // 1 / combinedProbability
  houseEdge: number; // Percentage (e.g., 0.05 = 5%)
  offeredOdds: number; // Fair odds adjusted for house edge
  principalAmount: number;
  potentialPayout: number; // principalAmount * offeredOdds
  expectedValue: number; // EV for the bettor
  breakEvenProbability: number; // Probability needed to break even
}

export class QuoteService {
  // House edge: percentage taken by the house (5% default)
  private readonly HOUSE_EDGE = 0.05;
  
  // Minimum odds to prevent extremely unlikely parlays
  private readonly MIN_ODDS = 1.01;
  
  // Maximum odds to limit exposure
  private readonly MAX_ODDS = 1000;

  /**
   * Convert Jupiter market price to implied probability
   * Jupiter prices are in micro USD (1,000,000 = $1.00)
   * Price represents the cost to buy a contract that pays $1 if correct
   */
  private priceToImpliedProbability(price: number): number {
    // Price in dollars (e.g., 650000 micro USD = $0.65)
    const priceInDollars = price / 1_000_000;
    
    // Implied probability is the price (since payout is $1)
    // Clamp between 0.01 and 0.99 to avoid edge cases
    return Math.max(0.01, Math.min(0.99, priceInDollars));
  }

  /**
   * Calculate fair decimal odds from probability
   * Odds = 1 / probability
   */
  private probabilityToOdds(probability: number): number {
    if (probability <= 0 || probability >= 1) {
      throw new Error('Probability must be between 0 and 1');
    }
    return 1 / probability;
  }

  /**
   * Get market odds for a single event
   */
  async getMarketOdds(
    eventId: string,
    marketId: string,
    selectedOutcome: 'YES' | 'NO'
  ): Promise<MarketOdds> {
    // Fetch market data from Jupiter
    const market = await jupiterService.getMarket(marketId);
    
    if (!market) {
      throw new Error(`Market ${marketId} not found`);
    }

    if (!market.pricing) {
      throw new Error(`Market ${marketId} has no pricing data`);
    }

    // Get the price for the selected outcome
    let price: number | null | undefined;
    
    if (selectedOutcome === 'YES') {
      price = market.pricing.buyYesPriceUsd;
    } else {
      // For NO, try to get buyNoPriceUsd first
      price = market.pricing.buyNoPriceUsd;
      
      // If NO price is not available, calculate it from YES price
      // NO price = 1,000,000 - YES price (since they must sum to $1.00)
      if ((!price || price <= 0) && market.pricing.buyYesPriceUsd && market.pricing.buyYesPriceUsd > 0) {
        price = 1_000_000 - market.pricing.buyYesPriceUsd;
        console.log(`Calculated NO price from YES price: ${price} (YES was ${market.pricing.buyYesPriceUsd})`);
      }
    }

    if (!price || price <= 0) {
      console.error(`Market ${marketId} pricing:`, JSON.stringify(market.pricing));
      throw new Error(`Invalid price for ${selectedOutcome} on market ${marketId}. YES: ${market.pricing.buyYesPriceUsd}, NO: ${market.pricing.buyNoPriceUsd}`);
    }

    // Calculate implied probability and fair odds
    const impliedProbability = this.priceToImpliedProbability(price);
    const fairOdds = this.probabilityToOdds(impliedProbability);

    return {
      marketId,
      eventId,
      title: market.title || market.metadata?.title || 'Unknown Market',
      selectedOutcome,
      impliedProbability,
      fairOdds,
      marketPrice: price,
    };
  }

  /**
   * Calculate parlay quote from multiple events
   * Uses independent probability multiplication
   */
  async calculateParlayQuote(
    events: Array<{
      eventId: string;
      marketId: string;
      selectedOutcome: 'YES' | 'NO';
    }>,
    principalAmount: number
  ): Promise<ParlayQuote> {
    if (events.length < 2) {
      throw new Error('Parlay must have at least 2 events');
    }

    if (principalAmount <= 0) {
      throw new Error('Principal amount must be positive');
    }

    // Fetch odds for all events
    const marketOdds = await Promise.all(
      events.map(e => this.getMarketOdds(e.eventId, e.marketId, e.selectedOutcome))
    );

    // Calculate combined probability (product of all probabilities)
    // P(A and B and C) = P(A) * P(B) * P(C) for independent events
    const combinedProbability = marketOdds.reduce(
      (product, odds) => product * odds.impliedProbability,
      1
    );

    // Fair parlay odds (before house edge)
    const fairParlayOdds = this.probabilityToOdds(combinedProbability);

    // Apply house edge to get offered odds
    // Offered odds = Fair odds * (1 - house edge)
    let offeredOdds = fairParlayOdds * (1 - this.HOUSE_EDGE);

    // Clamp odds to reasonable range
    offeredOdds = Math.max(this.MIN_ODDS, Math.min(this.MAX_ODDS, offeredOdds));

    // Calculate potential payout
    const potentialPayout = principalAmount * offeredOdds;

    // Calculate expected value for the bettor
    // EV = (probability of winning * payout) - (probability of losing * stake)
    const expectedValue = (combinedProbability * potentialPayout) - principalAmount;

    // Break-even probability (probability needed to have EV = 0)
    const breakEvenProbability = 1 / offeredOdds;

    return {
      events: marketOdds,
      combinedProbability,
      fairParlayOdds,
      houseEdge: this.HOUSE_EDGE,
      offeredOdds,
      principalAmount,
      potentialPayout,
      expectedValue,
      breakEvenProbability,
    };
  }

  /**
   * Get recommended parlay size based on odds
   * Kelly Criterion: f = (bp - q) / b
   * where b = odds - 1, p = probability, q = 1 - p
   */
  getRecommendedStake(
    combinedProbability: number,
    offeredOdds: number,
    bankroll: number
  ): number {
    const b = offeredOdds - 1; // Net odds
    const p = combinedProbability;
    const q = 1 - p;

    // Kelly fraction
    const kellyFraction = (b * p - q) / b;

    // Use fractional Kelly (25% of full Kelly for safety)
    const fractionalKelly = Math.max(0, kellyFraction * 0.25);

    // Recommended stake
    const recommendedStake = bankroll * fractionalKelly;

    // Cap at 5% of bankroll for safety
    return Math.min(recommendedStake, bankroll * 0.05);
  }

  /**
   * Calculate house profit margin
   */
  calculateHouseMargin(quote: ParlayQuote): number {
    // House margin = 1 - (fair odds / offered odds)
    return 1 - (quote.fairParlayOdds / quote.offeredOdds);
  }

  /**
   * Validate if parlay is within acceptable risk parameters
   */
  validateParlay(quote: ParlayQuote): {
    valid: boolean;
    reason?: string;
  } {
    // Check if odds are too low (too likely to win)
    if (quote.offeredOdds < this.MIN_ODDS) {
      return {
        valid: false,
        reason: `Odds too low (${quote.offeredOdds.toFixed(2)}). Minimum is ${this.MIN_ODDS}`,
      };
    }

    // Check if odds are too high (too unlikely to win)
    if (quote.offeredOdds > this.MAX_ODDS) {
      return {
        valid: false,
        reason: `Odds too high (${quote.offeredOdds.toFixed(2)}). Maximum is ${this.MAX_ODDS}`,
      };
    }

    // Check if combined probability is reasonable
    if (quote.combinedProbability < 0.001) {
      return {
        valid: false,
        reason: 'Parlay is too unlikely (less than 0.1% chance)',
      };
    }

    return { valid: true };
  }

  /**
   * Format odds for display
   */
  formatOdds(odds: number): {
    decimal: string;
    american: string;
    fractional: string;
    impliedProbability: string;
  } {
    // Decimal odds (e.g., 2.50)
    const decimal = odds.toFixed(2);

    // American odds
    let american: string;
    if (odds >= 2.0) {
      american = `+${((odds - 1) * 100).toFixed(0)}`;
    } else {
      american = `-${(100 / (odds - 1)).toFixed(0)}`;
    }

    // Fractional odds (e.g., 3/2)
    const numerator = Math.round((odds - 1) * 100);
    const denominator = 100;
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(numerator, denominator);
    const fractional = `${numerator / divisor}/${denominator / divisor}`;

    // Implied probability
    const impliedProbability = `${((1 / odds) * 100).toFixed(1)}%`;

    return {
      decimal,
      american,
      fractional,
      impliedProbability,
    };
  }
}

export const quoteService = new QuoteService();
