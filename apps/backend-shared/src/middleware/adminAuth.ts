import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * Admin secret middleware.
 *
 * Protects admin-only routes (settlement triggers, etc.) by requiring
 * a shared secret in the `x-admin-secret` header.
 *
 * The secret is read from the ADMIN_SECRET environment variable.
 */
export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const secret = req.headers['x-admin-secret'] as string | undefined;

  if (!secret || secret !== env.ADMIN_SECRET) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required.',
      },
      timestamp: new Date().toISOString(),
    });
  }

  next();
}
