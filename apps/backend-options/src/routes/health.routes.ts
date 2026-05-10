import { Router } from 'express';
import mongoose from 'mongoose';
import { solanaService, jupiterService } from '@parlay-tokens/backend-shared';
import type { HealthCheckResponse } from '@parlay-tokens/shared';

const router = Router();

router.get('/', async (req, res) => {
  const services = {
    database: false,
    solana: false,
    jupiter: false,
  };

  try {
    const isConnected = mongoose.connection.readyState === 1;
    
    if (isConnected && mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
      services.database = true;
    }
  } catch (error) {
    console.error('Database health check failed:', error);
  }

  try {
    const balance = await solanaService.getBackendBalance();
    services.solana = balance >= 0;
  } catch (error) {
    console.error('Solana health check failed:', error);
  }

  try {
    await jupiterService.getEvents(1, 1);
    services.jupiter = true;
  } catch (error) {
    console.error('Jupiter health check failed:', error);
  }

  const allHealthy = Object.values(services).every(s => s);
  const someHealthy = Object.values(services).some(s => s);

  const response: HealthCheckResponse = {
    status: allHealthy ? 'healthy' : someHealthy ? 'degraded' : 'unhealthy',
    services,
    timestamp: new Date().toISOString(),
  };

  const statusCode = allHealthy ? 200 : someHealthy ? 200 : 503;
  res.status(statusCode).json(response);
});

router.get('/backend-wallet', async (req, res) => {
  try {
    const address = solanaService.getBackendWalletAddress();
    const balance = await solanaService.getBackendBalance();

    res.json({
      success: true,
      data: {
        address,
        balance,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'WALLET_INFO_ERROR',
        message: error.message || 'Failed to get wallet info',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
