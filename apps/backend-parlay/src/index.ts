import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { connectDatabase, env, errorHandler, notFoundHandler } from '@parlay-tokens/backend-shared';
import { startSettlementJob, startExpiredParlayJob, startExpirePendingJob } from './jobs/settlement.job';

// Routes
import parlayRoutes from './routes/parlay.routes';
import quoteRoutes from './routes/quote.routes';
import healthRoutes from './routes/health.routes';
import jupiterRoutes from './routes/jupiter.routes';

const app = express();

// ─── Security Middleware ────────────────────────────────────────────

// Request body size limit (prevent DoS via large payloads)
app.use(express.json({ limit: '1mb' }));

// CORS configuration
// For devnet: Allow all origins for testing
// For production: Restrict to specific domains
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGINS?.split(',') || ['https://yourdomain.com'])
    : '*',
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Rate limiting - different limits for different endpoint types
const createRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per window for create operations
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const readRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute for read operations (generous for dev)
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const adminRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute for admin operations
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many admin requests. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Routes with Rate Limiting ──────────────────────────────────────

// Health check - no rate limit (needed for monitoring)
app.use('/api/health', healthRoutes);

// Read operations - moderate rate limit
app.use('/api/jupiter', readRateLimiter, jupiterRoutes);
app.use('/api/quote', readRateLimiter, quoteRoutes);

// Parlay routes - apply read rate limiter (individual routes handle write protection)
app.use('/api/parlays', readRateLimiter, parlayRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
async function start() {
  try {
    console.log('🔄 Starting Parlay Service...');
    console.log('🔄 Connecting to MongoDB...');
    await connectDatabase();
    
    // Start background jobs
    startSettlementJob();
    startExpiredParlayJob();
    startExpirePendingJob(); // NEW: Expire pending payment parlays to prevent timing exploits
    
    app.listen(env.PORT, () => {
      console.log(`🚀 Parlay Service running on port ${env.PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    console.error('Error details:', error);
    process.exit(1);
  }
}

start();
