import { MarketSnapshotModel } from '../models/MarketSnapshot';
import { marketQualityService } from './marketQuality.service';
import type { MarketSnapshotData, ScoredMarket } from '@parlay-tokens/shared';

const SNAPSHOT_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export class MarketSnapshotService {
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  /**
   * Start the periodic snapshot scheduler.
   * Call once after DB is connected.
   */
  start(): void {
    if (this.intervalHandle) return; // already running

    console.log('📸 Snapshot scheduler started (every 15 min)');

    // Take first snapshot immediately
    this.takeSnapshot().catch(err =>
      console.error('❌ Initial snapshot failed:', err)
    );

    this.intervalHandle = setInterval(() => {
      this.takeSnapshot().catch(err =>
        console.error('❌ Snapshot failed:', err)
      );
    }, SNAPSHOT_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      console.log('📸 Snapshot scheduler stopped');
    }
  }

  /**
   * Take a snapshot of all currently scored markets.
   */
  async takeSnapshot(): Promise<number> {
    const markets = await marketQualityService.getScoredMarkets({ limit: 50 });

    if (markets.length === 0) {
      console.log('📸 No scored markets to snapshot');
      return 0;
    }

    const now = new Date();
    const docs = markets.map((m: ScoredMarket) => ({
      marketId: m.marketId,
      eventId: m.eventId,
      probability: m.currentProbability,
      buyYes: m.pricing.buyYes,
      buyNo: m.pricing.buyNo,
      volume: m.volume,
      spread: m.spread,
      notionalDepth: m.notionalDepth,
      score: m.score,
      timestamp: now,
    }));

    await MarketSnapshotModel.insertMany(docs);
    console.log(`📸 Saved ${docs.length} market snapshots`);
    return docs.length;
  }

  /**
   * Retrieve historical snapshots for a market.
   */
  async getSnapshots(
    marketId: string,
    since?: Date
  ): Promise<MarketSnapshotData[]> {
    const sinceDate = since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // default 7 days

    const snapshots = await MarketSnapshotModel.find({
      marketId,
      timestamp: { $gte: sinceDate },
    })
      .sort({ timestamp: 1 })
      .lean();

    return snapshots;
  }

  /**
   * Compute realized volatility from snapshots.
   * Returns daily volatility (annualised would be * sqrt(365)).
   * Uses standard deviation of log-returns of probability.
   */
  async computeRealizedVolatility(marketId: string): Promise<number | null> {
    // Need at least 10 data points for a meaningful estimate
    const snapshots = await MarketSnapshotModel.find({ marketId })
      .sort({ timestamp: 1 })
      .limit(500)
      .lean();

    if (snapshots.length < 10) return null;

    // Compute log-returns of probability (clamped to avoid log(0))
    const logReturns: number[] = [];
    for (let i = 1; i < snapshots.length; i++) {
      const p0 = Math.max(0.01, Math.min(0.99, snapshots[i - 1].probability));
      const p1 = Math.max(0.01, Math.min(0.99, snapshots[i].probability));
      // Logit transform to unbounded space before computing returns
      const logit0 = Math.log(p0 / (1 - p0));
      const logit1 = Math.log(p1 / (1 - p1));
      logReturns.push(logit1 - logit0);
    }

    // Standard deviation of returns
    const mean = logReturns.reduce((s, v) => s + v, 0) / logReturns.length;
    const variance =
      logReturns.reduce((s, v) => s + (v - mean) ** 2, 0) / (logReturns.length - 1);
    const stdDev = Math.sqrt(variance);

    // Scale to daily: snapshots are 15-min apart → 96 per day
    // daily_vol = stdDev * sqrt(96)
    const dailyVol = stdDev * Math.sqrt(96);

    return Math.max(0.05, Math.min(0.50, dailyVol)); // clamp 5%-50%
  }

  /**
   * Get count of snapshots for a market (useful for health checks).
   */
  async getSnapshotCount(marketId: string): Promise<number> {
    return MarketSnapshotModel.countDocuments({ marketId });
  }
}

export const marketSnapshotService = new MarketSnapshotService();
