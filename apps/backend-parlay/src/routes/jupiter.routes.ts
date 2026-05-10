import { Router } from 'express';
import { jupiterService } from '@parlay-tokens/backend-shared';
import type { ApiResponse } from '@parlay-tokens/shared';

const router: Router = Router();

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
