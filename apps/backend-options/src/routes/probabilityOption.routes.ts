import { Router } from 'express';
import { probabilityOptionService } from '../services/probabilityOption.service';
import {
  CreateOptionSchema,
  ConfirmOptionPaymentSchema,
  ExerciseOptionSchema,
  type ApiResponse,
  type OptionPricingParams,
} from '@parlay-tokens/shared';
import { walletAuth, adminAuth } from '@parlay-tokens/backend-shared';

const router = Router();

/** Sanitize error messages for client responses */
function safeErrorMessage(fallback: string): string {
  return process.env.NODE_ENV === 'production' ? fallback : fallback;
}

// ──────────────────────────────────────────────────────────────────
// IMPORTANT: Route order matters!
// Specific paths (quote, stats, wallet, settle-expired, volatility)
// MUST come before wildcard /:id
// Otherwise GET /api/options/stats is matched by /:id with id="stats"
// ──────────────────────────────────────────────────────────────────

/**
 * POST /api/options/quote
 * Get option pricing quote
 * Public: read-only pricing data
 */
router.post('/quote', async (req, res) => {
  try {
    const params: OptionPricingParams = req.body;
    
    // Validate params
    if (!params.currentProbability || !params.strikePrice || !params.timeToExpiration) {
      throw new Error('Missing required pricing parameters');
    }

    const quote = await probabilityOptionService.calculateOptionQuote(params);

    const response: ApiResponse = {
      success: true,
      data: quote,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error: any) {
    console.error('Quote error:', error.message);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'QUOTE_ERROR',
        message: safeErrorMessage('Failed to calculate quote'),
      },
      timestamp: new Date().toISOString(),
    };

    res.status(400).json(response);
  }
});

/**
 * POST /api/options/settle-expired
 * Manually trigger settlement of expired options
 * Protected: admin-only
 */
router.post('/settle-expired', adminAuth, async (req, res) => {
  try {
    await probabilityOptionService.settleExpiredOptions();

    const response: ApiResponse = {
      success: true,
      data: { message: 'Expired options settled' },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error: any) {
    console.error('Settle error:', error.message);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'SETTLE_ERROR',
        message: safeErrorMessage('Failed to settle expired options'),
      },
      timestamp: new Date().toISOString(),
    };

    res.status(500).json(response);
  }
});

/**
 * GET /api/options/stats/:address?
 * Get option statistics
 * Public: read-only
 */
router.get('/stats/:address?', async (req, res) => {
  try {
    const stats = await probabilityOptionService.getStats(req.params.address);

    const response: ApiResponse = {
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error: any) {
    console.error('Get stats error:', error.message);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'GET_STATS_ERROR',
        message: safeErrorMessage('Failed to get stats'),
      },
      timestamp: new Date().toISOString(),
    };

    res.status(500).json(response);
  }
});

/**
 * GET /api/options/wallet/:address
 * Get options by wallet address
 * Public: read-only
 */
router.get('/wallet/:address', async (req, res) => {
  try {
    const options = await probabilityOptionService.getOptionsByWallet(req.params.address);

    const response: ApiResponse = {
      success: true,
      data: options,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error: any) {
    console.error('Get options error:', error.message);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'GET_OPTIONS_ERROR',
        message: safeErrorMessage('Failed to get options'),
      },
      timestamp: new Date().toISOString(),
    };

    res.status(500).json(response);
  }
});

/**
 * GET /api/options/volatility/:eventId/:marketId
 * Get implied volatility estimate for an event
 * Public: read-only
 */
router.get('/volatility/:eventId/:marketId', async (req, res) => {
  try {
    const { eventId, marketId } = req.params;
    const impliedVolatility = await probabilityOptionService.estimateImpliedVolatility(
      eventId,
      marketId
    );

    const response: ApiResponse = {
      success: true,
      data: { impliedVolatility },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error: any) {
    console.error('Volatility error:', error.message);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'VOLATILITY_ERROR',
        message: safeErrorMessage('Failed to estimate volatility'),
      },
      timestamp: new Date().toISOString(),
    };

    res.status(500).json(response);
  }
});

/**
 * POST /api/options
 * Create a new probability option
 * Protected: requires wallet signature
 */
router.post('/', walletAuth, async (req, res) => {
  try {
    const input = CreateOptionSchema.parse(req.body);
    const option = await probabilityOptionService.createOption(input);

    const response: ApiResponse = {
      success: true,
      data: option,
      timestamp: new Date().toISOString(),
    };

    res.status(201).json(response);
  } catch (error: any) {
    console.error('Create option error:', error.message);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'CREATE_OPTION_ERROR',
        message: safeErrorMessage('Failed to create option'),
      },
      timestamp: new Date().toISOString(),
    };

    res.status(400).json(response);
  }
});

/**
 * POST /api/options/:id/confirm-payment
 * Confirm payment and activate option
 * Protected: requires wallet signature
 */
router.post('/:id/confirm-payment', walletAuth, async (req, res) => {
  try {
    const input = ConfirmOptionPaymentSchema.parse({
      optionId: req.params.id,
      txSignature: req.body.txSignature,
    });

    const option = await probabilityOptionService.confirmPayment(input);

    const response: ApiResponse = {
      success: true,
      data: option,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error: any) {
    console.error('Confirm payment error:', error.message);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'CONFIRM_PAYMENT_ERROR',
        message: safeErrorMessage('Failed to confirm payment'),
      },
      timestamp: new Date().toISOString(),
    };

    res.status(400).json(response);
  }
});

/**
 * POST /api/options/:id/exercise
 * Exercise option (claim profit)
 * Protected: requires wallet signature (must match option owner)
 */
router.post('/:id/exercise', walletAuth, async (req, res) => {
  try {
    const input = ExerciseOptionSchema.parse({
      optionId: req.params.id,
      walletAddress: req.body.walletAddress,
    });

    const result = await probabilityOptionService.exerciseOption(input);

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error: any) {
    console.error('Exercise option error:', error.message);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'EXERCISE_OPTION_ERROR',
        message: safeErrorMessage('Failed to exercise option'),
      },
      timestamp: new Date().toISOString(),
    };

    res.status(400).json(response);
  }
});

/**
 * PUT /api/options/:id/update-value
 * Update option with current market data
 * Public: read-only market data refresh
 */
router.put('/:id/update-value', async (req, res) => {
  try {
    const option = await probabilityOptionService.updateOptionValue(req.params.id);

    const response: ApiResponse = {
      success: true,
      data: option,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error: any) {
    console.error('Update value error:', error.message);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'UPDATE_VALUE_ERROR',
        message: safeErrorMessage('Failed to update option value'),
      },
      timestamp: new Date().toISOString(),
    };

    res.status(500).json(response);
  }
});

/**
 * GET /api/options/:id
 * Get option by ID
 * Public: read-only
 * MUST be LAST — catches all unmatched /:id patterns
 */
router.get('/:id', async (req, res) => {
  try {
    const option = await probabilityOptionService.getOptionById(req.params.id);

    if (!option) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Option not found',
        },
        timestamp: new Date().toISOString(),
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: option,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error: any) {
    console.error('Get option error:', error.message);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'GET_OPTION_ERROR',
        message: safeErrorMessage('Failed to get option'),
      },
      timestamp: new Date().toISOString(),
    };

    res.status(500).json(response);
  }
});

export default router;
