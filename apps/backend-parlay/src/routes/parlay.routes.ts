import { Router } from 'express';
import { parlayService } from '../services/parlay.service';
import { CreateParlaySchema, ConfirmPaymentSchema, ClaimParlaySchema } from '@parlay-tokens/shared';
import type { ApiResponse } from '@parlay-tokens/shared';
import { walletAuth, adminAuth } from '@parlay-tokens/backend-shared';

const router = Router();

/** Sanitize error messages for client responses */
function safeErrorMessage(fallback: string): string {
  return process.env.NODE_ENV === 'production' ? fallback : fallback;
}

// ──────────────────────────────────────────────────────────────────
// IMPORTANT: Route order matters!
// Specific paths (stats, wallet) MUST come before wildcard /:id
// Otherwise GET /api/parlays/stats is matched by /:id with id="stats"
// ──────────────────────────────────────────────────────────────────

/**
 * GET /api/parlays/stats/:address?
 * Get parlay statistics
 * Public: read-only
 */
router.get('/stats/:address?', async (req, res) => {
  try {
    const stats = await parlayService.getStats(req.params.address);

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
 * GET /api/parlays/wallet/:address
 * Get parlays by wallet address
 * Public: read-only
 */
router.get('/wallet/:address', async (req, res) => {
  try {
    const parlays = await parlayService.getParlaysByWallet(req.params.address);

    const response: ApiResponse = {
      success: true,
      data: parlays,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error: any) {
    console.error('Get parlays error:', error.message);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'GET_PARLAYS_ERROR',
        message: safeErrorMessage('Failed to get parlays'),
      },
      timestamp: new Date().toISOString(),
    };

    res.status(500).json(response);
  }
});

/**
 * POST /api/parlays
 * Create a new parlay with immediate payment verification
 * Protected: requires wallet signature
 * 
 * SECURITY: Payment must be verified BEFORE parlay creation
 * Body must include txSignature for payment verification
 */
router.post('/', walletAuth, async (req, res) => {
  try {
    // Validate that txSignature is provided
    if (!req.body.txSignature) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'MISSING_PAYMENT',
          message: 'Payment transaction signature is required. Please complete payment before creating parlay.',
        },
        timestamp: new Date().toISOString(),
      };
      return res.status(400).json(response);
    }

    const input = CreateParlaySchema.parse(req.body);
    
    // Create parlay with payment verification
    const parlay = await parlayService.createParlay({
      ...input,
      txSignature: req.body.txSignature,
    });

    const response: ApiResponse = {
      success: true,
      data: parlay,
      timestamp: new Date().toISOString(),
    };

    res.status(201).json(response);
  } catch (error: any) {
    console.error('Create parlay error:', error.message);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'CREATE_PARLAY_ERROR',
        message: error.message || safeErrorMessage('Failed to create parlay'),
      },
      timestamp: new Date().toISOString(),
    };

    res.status(400).json(response);
  }
});

/**
 * POST /api/parlays/:id/confirm-payment
 * Confirm payment and activate parlay (LEGACY ENDPOINT)
 * Protected: requires wallet signature
 * 
 * This endpoint is kept for backwards compatibility with existing pending_payment parlays
 * New parlays should include txSignature in the POST /api/parlays request
 * 
 * SECURITY: Checks payment deadline and event settlement status to prevent exploits
 */
router.post('/:id/confirm-payment', walletAuth, async (req, res) => {
  try {
    const input = ConfirmPaymentSchema.parse({
      parlayId: req.params.id,
      txSignature: req.body.txSignature,
    });

    const parlay = await parlayService.confirmPayment(input);

    const response: ApiResponse = {
      success: true,
      data: parlay,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error: any) {
    console.error('Confirm payment error:', error.message);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'CONFIRM_PAYMENT_ERROR',
        message: error.message || safeErrorMessage('Failed to confirm payment'),
      },
      timestamp: new Date().toISOString(),
    };

    res.status(400).json(response);
  }
});

/**
 * POST /api/parlays/:id/claim
 * Claim winning parlay
 * Protected: requires wallet signature (must match parlay owner)
 */
router.post('/:id/claim', walletAuth, async (req, res) => {
  try {
    const input = ClaimParlaySchema.parse({
      parlayId: req.params.id,
      walletAddress: req.body.walletAddress,
    });

    const result = await parlayService.claimParlay(input);

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error: any) {
    console.error('Claim parlay error:', error.message);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'CLAIM_PARLAY_ERROR',
        message: safeErrorMessage('Failed to claim parlay'),
      },
      timestamp: new Date().toISOString(),
    };

    res.status(400).json(response);
  }
});

/**
 * POST /api/parlays/:id/check-settlement
 * Manually trigger settlement check for a specific parlay
 * Protected: admin-only
 */
router.post('/:id/check-settlement', adminAuth, async (req, res) => {
  try {
    const { settlementService } = await import('../services/settlement.service');
    await settlementService.checkParlaySettlement(req.params.id);

    const response: ApiResponse = {
      success: true,
      data: { message: 'Settlement check completed' },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error: any) {
    console.error('Check settlement error:', error.message);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'CHECK_SETTLEMENT_ERROR',
        message: safeErrorMessage('Failed to check settlement'),
      },
      timestamp: new Date().toISOString(),
    };

    res.status(500).json(response);
  }
});

/**
 * GET /api/parlays/:id
 * Get parlay by ID
 * Public: read-only
 * MUST be LAST — catches all unmatched /:id patterns
 */
router.get('/:id', async (req, res) => {
  try {
    const parlay = await parlayService.getParlayById(req.params.id);

    if (!parlay) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Parlay not found',
        },
        timestamp: new Date().toISOString(),
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: parlay,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error: any) {
    console.error('Get parlay error:', error.message);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'GET_PARLAY_ERROR',
        message: safeErrorMessage('Failed to get parlay'),
      },
      timestamp: new Date().toISOString(),
    };

    res.status(500).json(response);
  }
});

export default router;
