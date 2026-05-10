import { Router } from 'express';
import { jupiterService } from '@parlay-tokens/backend-shared';
import { marketQualityService } from '../services/marketQuality.service';
import { marketSnapshotService } from '../services/marketSnapshot.service';
import { probabilityOptionService } from '../services/probabilityOption.service';
import type { ApiResponse } from '@parlay-tokens/shared';

const router: Router = Router();

router.get('/scored', async (req, res) => {
  try {
    const category = req.query.category as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

    const markets = await marketQualityService.getScoredMarkets({ category, limit });

    const response: ApiResponse = {
      success: true,
      data: { markets, total: markets.length },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'SCORED_MARKETS_ERROR',
        message: error.message || 'Failed to fetch scored markets',
      },
      timestamp: new Date().toISOString(),
    };

    res.status(500).json(response);
  }
});

router.get('/chain/:marketId', async (req, res) => {
  try {
    const { marketId } = req.params;
    const eventId = req.query.eventId as string || '';

    const result = await probabilityOptionService.generateOptionsChain(eventId, marketId);

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'OPTIONS_CHAIN_ERROR',
        message: error.message || 'Failed to generate options chain',
      },
      timestamp: new Date().toISOString(),
    };

    res.status(500).json(response);
  }
});

router.get('/snapshots/:marketId', async (req, res) => {
  try {
    const { marketId } = req.params;
    const since = req.query.since
      ? new Date(req.query.since as string)
      : undefined;

    const snapshots = await marketSnapshotService.getSnapshots(marketId, since);

    const response: ApiResponse = {
      success: true,
      data: { snapshots, total: snapshots.length },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'SNAPSHOTS_ERROR',
        message: error.message || 'Failed to fetch snapshots',
      },
      timestamp: new Date().toISOString(),
    };

    res.status(500).json(response);
  }
});

router.get('/payoff/:marketId', async (req, res) => {
  try {
    const strike = parseFloat(req.query.strike as string) || 0.5;
    const expiry = parseInt(req.query.expiry as string) || 7;
    const optionType = (req.query.optionType as string || 'CALL') as 'CALL' | 'PUT';
    const notional = parseFloat(req.query.notional as string) || 1;
    const eventId = req.query.eventId as string || '';
    const { marketId } = req.params;

    const marketData = await jupiterService.getMarket(marketId);
    if (!marketData) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Market not found' },
        timestamp: new Date().toISOString(),
      });
    }

    const buyYes = marketData.pricing?.buyYesPriceUsd ?? 0;
    const buyNo = marketData.pricing?.buyNoPriceUsd ?? 0;
    const currentProbability = buyYes > 0 || buyNo > 0
      ? buyYes / (buyYes + buyNo)
      : 0.5;

    const iv = await probabilityOptionService.estimateImpliedVolatility(eventId, marketId);

    const quote = await probabilityOptionService.calculateOptionQuote({
      currentProbability,
      strikePrice: strike,
      timeToExpiration: expiry,
      impliedVolatility: iv,
      notionalAmount: notional,
      optionType,
    });

    const payoffPoints = probabilityOptionService.generatePayoffCurve(
      strike, quote.premium, notional, optionType
    );

    const response: ApiResponse = {
      success: true,
      data: {
        payoffPoints,
        premium: quote.premium,
        breakEven: quote.breakEvenProbability,
        maxProfit: quote.maxProfit,
        maxLoss: quote.maxLoss,
        currentProbability,
      },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'PAYOFF_ERROR',
        message: error.message || 'Failed to generate payoff data',
      },
      timestamp: new Date().toISOString(),
    };

    res.status(500).json(response);
  }
});

router.get('/events', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const result = await jupiterService.getEvents(page, limit);
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'GET_EVENTS_ERROR', message: error.message || 'Failed to fetch events' },
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/events/all', async (req, res) => {
  try {
    const category = req.query.category as string | undefined;
    const filter = req.query.filter as 'new' | 'live' | 'trending' | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 200;
    const events = await jupiterService.getAllEvents({ category, filter, limit });
    res.json({ success: true, data: { events, total: events.length }, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'GET_ALL_EVENTS_ERROR', message: error.message || 'Failed to fetch all events' },
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/events/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_QUERY', message: 'Search query is required' },
        timestamp: new Date().toISOString(),
      });
    }
    const events = await jupiterService.searchEvents(query);
    res.json({ success: true, data: { events }, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SEARCH_EVENTS_ERROR', message: error.message || 'Failed to search events' },
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/markets/:marketId', async (req, res) => {
  try {
    const market = await jupiterService.getMarket(req.params.marketId);
    if (!market) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Market not found' },
        timestamp: new Date().toISOString(),
      });
    }
    res.json({ success: true, data: market, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'GET_MARKET_ERROR', message: error.message || 'Failed to fetch market' },
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/markets/:marketId/orderbook', async (req, res) => {
  try {
    const orderbook = await jupiterService.getMarketOrderbook(req.params.marketId);
    if (!orderbook) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Orderbook not found' },
        timestamp: new Date().toISOString(),
      });
    }
    res.json({ success: true, data: orderbook, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'GET_ORDERBOOK_ERROR', message: error.message || 'Failed to fetch orderbook' },
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
