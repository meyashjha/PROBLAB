import { Request, Response, NextFunction } from 'express';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

// Extend Express Request to include authenticated wallet address
declare global {
  namespace Express {
    interface Request {
      walletAddress?: string;
    }
  }
}

/** Maximum age of a signed message before it's considered expired (5 minutes) */
const MAX_MESSAGE_AGE_MS = 5 * 60 * 1000;

/**
 * Wallet signature verification middleware.
 *
 * Expects three headers on every protected request:
 *   x-wallet-address   – Base58-encoded Solana public key
 *   x-wallet-signature – Base58-encoded Ed25519 signature
 *   x-wallet-message   – The UTF-8 message that was signed
 *
 * The message must contain a Unix-ms timestamp that is within
 * MAX_MESSAGE_AGE_MS of the current server time (replay protection).
 *
 * On success, sets `req.walletAddress` for downstream handlers.
 */
export function walletAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const walletAddress = req.headers['x-wallet-address'] as string | undefined;
    const signature = req.headers['x-wallet-signature'] as string | undefined;
    const message = req.headers['x-wallet-message'] as string | undefined;

    if (!walletAddress || !signature || !message) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Wallet signature required. Provide x-wallet-address, x-wallet-signature, and x-wallet-message headers.',
        },
        timestamp: new Date().toISOString(),
      });
    }

    // ── Replay protection ──────────────────────────────────────────
    // Message format: "ParlayTokens:<timestamp_ms>:<action>"
    const parts = message.split(':');
    if (parts.length < 2) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_MESSAGE',
          message: 'Invalid signed message format.',
        },
        timestamp: new Date().toISOString(),
      });
    }

    const timestamp = parseInt(parts[1], 10);
    if (isNaN(timestamp)) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_MESSAGE',
          message: 'Invalid timestamp in signed message.',
        },
        timestamp: new Date().toISOString(),
      });
    }

    const age = Date.now() - timestamp;
    if (age > MAX_MESSAGE_AGE_MS || age < -MAX_MESSAGE_AGE_MS) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'EXPIRED_SIGNATURE',
          message: 'Signed message has expired. Please sign a new message.',
        },
        timestamp: new Date().toISOString(),
      });
    }

    // ── Signature verification ─────────────────────────────────────
    const publicKeyBytes = bs58.decode(walletAddress);
    const signatureBytes = bs58.decode(signature);
    const messageBytes = new TextEncoder().encode(message);

    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes
    );

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_SIGNATURE',
          message: 'Wallet signature verification failed.',
        },
        timestamp: new Date().toISOString(),
      });
    }

    // ── Wallet address consistency check ───────────────────────────
    // If the request body contains a walletAddress, it must match the signer
    const bodyWallet = req.body?.walletAddress;
    if (bodyWallet && bodyWallet !== walletAddress) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'WALLET_MISMATCH',
          message: 'Signed wallet address does not match request body.',
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Attach verified wallet address to request
    req.walletAddress = walletAddress;
    next();
  } catch (error) {
    console.error('Wallet auth error:', error);
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed.',
      },
      timestamp: new Date().toISOString(),
    });
  }
}
