import { Router } from 'express';
import { quoteService } from '../services/quote.service';
import type { ApiResponse } from '@parlay-tokens/shared';
import { z } from 'zod';

const router: Router = Router();

/**
 * POST /api/quote/parlay
 * Get a quote for a parlay based on current market prices
 */
router.post('/parlay', async (req, res) => {
  try {
    const schema = z.object({
      events: z.array(z.object({
        eventId: z.string(),
        marketId: z.string(),
        selectedOutcome: z.enum(['YES', 'NO']),
      })).min(2),
      principalAmount: z.number().positive(),
    });

    const input = schema.parse(req.body);

    const quote = await quoteService.calculateParlayQuote(
      input.events,
      input.principalAmount
    );

    // Validate the parlay
    const validation = quoteService.validateParlay(quote);

    const response: ApiResponse = {
      success: true,
      data: {
        quote,
        validation,
        formattedOdds: quoteService.formatOdds(quote.offeredOdds),
      },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'QUOTE_ERROR',
        message: error.message || 'Failed to calculate quote',
      },
      timestamp: new Date().toISOString(),
    };

    res.status(400).json(response);
  }
});

/**
 * GET /api/quote/market/:marketId
 * Get odds for a single market
 */
router.get('/market/:marketId', async (req, res) => {
  try {
    const { marketId } = req.params;
    const { eventId, outcome } = req.query;

    if (!eventId || !outcome) {
      throw new Error('eventId and outcome query parameters are required');
    }

    if (outcome !== 'YES' && outcome !== 'NO') {
      throw new Error('outcome must be YES or NO');
    }

    const odds = await quoteService.getMarketOdds(
      eventId as string,
      marketId,
      outcome as 'YES' | 'NO'
    );

    const response: ApiResponse = {
      success: true,
      data: {
        odds,
        formattedOdds: quoteService.formatOdds(odds.fairOdds),
      },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'MARKET_ODDS_ERROR',
        message: error.message || 'Failed to get market odds',
      },
      timestamp: new Date().toISOString(),
    };

    res.status(400).json(response);
  }
});

/**
 * POST /api/quote/recommended-stake
 * Get recommended stake size using Kelly Criterion
 */
router.post('/recommended-stake', async (req, res) => {
  try {
    const schema = z.object({
      combinedProbability: z.number().min(0).max(1),
      offeredOdds: z.number().positive(),
      bankroll: z.number().positive(),
    });

    const input = schema.parse(req.body);

    const recommendedStake = quoteService.getRecommendedStake(
      input.combinedProbability,
      input.offeredOdds,
      input.bankroll
    );

    const response: ApiResponse = {
      success: true,
      data: {
        recommendedStake,
        percentageOfBankroll: (recommendedStake / input.bankroll) * 100,
      },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'STAKE_CALCULATION_ERROR',
        message: error.message || 'Failed to calculate recommended stake',
      },
      timestamp: new Date().toISOString(),
    };

    res.status(400).json(response);
  }
});

export default router;
