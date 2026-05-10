import { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '@parlay-tokens/shared';

/**
 * Sanitize error messages for client responses.
 * In production, never expose internal error details.
 */
function sanitizeErrorMessage(error: Error): string {
  const nodeEnv = process.env.NODE_ENV || 'development';

  if (nodeEnv === 'production') {
    return 'An unexpected error occurred';
  }

  // In development, return the message but still strip sensitive patterns
  return stripSensitiveInfo(error.message || 'An unexpected error occurred');
}

/**
 * Strip sensitive information from error messages (connection strings, keys, etc.)
 */
function stripSensitiveInfo(message: string): string {
  // Strip MongoDB connection strings
  message = message.replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, '[REDACTED_URI]');
  // Strip anything that looks like a private key or API key
  message = message.replace(/[a-zA-Z0-9]{32,}/g, (match) => {
    // Only redact long alphanumeric strings that might be secrets
    if (match.length > 40) {
      return '[REDACTED]';
    }
    return match;
  });
  return message;
}

/**
 * Log errors safely, stripping sensitive information from the output.
 */
function safeErrorLog(label: string, error: Error) {
  const safeMessage = stripSensitiveInfo(error.message || '');
  console.error(`${label}: ${safeMessage}`);
  // Only log stack in development
  if (process.env.NODE_ENV !== 'production' && error.stack) {
    console.error(stripSensitiveInfo(error.stack));
  }
}

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  safeErrorLog('Error', error);

  const response: ApiResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: sanitizeErrorMessage(error),
    },
    timestamp: new Date().toISOString(),
  };

  res.status(500).json(response);
}

export function notFoundHandler(req: Request, res: Response) {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
    timestamp: new Date().toISOString(),
  };

  res.status(404).json(response);
}
