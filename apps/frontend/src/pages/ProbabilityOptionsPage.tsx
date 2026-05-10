import { FC, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ApiService } from '../services/api.service';
import { ProbabilityGauge } from '../components/ProbabilityGauge';
import { ScoreBreakdown } from '../components/ScoreBreakdown';
import { OptionsChainGrid } from '../components/OptionsChainGrid';
import { PayoffChart } from '../components/PayoffChart';
import type {
  ScoredMarket,
  OptionsChainEntry,
  PayoffPoint,
} from '@parlay-tokens/shared';

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'sports', label: 'Sports' },
  { value: 'politics', label: 'Politics' },
  { value: 'economics', label: 'Economics' },
  { value: 'tech', label: 'Tech' },
  { value: 'culture', label: 'Culture' },
  { value: 'esports', label: 'Esports' },
];

const SORT_OPTIONS = [
  { value: 'score', label: 'Quality Score' },
  { value: 'volume', label: 'Volume' },
  { value: 'expiry', label: 'Days to Expiry' },
  { value: 'probability', label: 'Probability' },
];

export const ProbabilityOptionsPage: FC = () => {
  const navigate = useNavigate();

  // ─── State ──────────────────────────────────────────────────────
  const [markets, setMarkets] = useState<ScoredMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState('score');

  // Selected market + chain
  const [selectedMarket, setSelectedMarket] = useState<ScoredMarket | null>(null);
  const [chain, setChain] = useState<OptionsChainEntry[]>([]);
  const [chainMeta, setChainMeta] = useState<{
    currentProbability: number;
    daysToExpiry: number;
    impliedVolatility: number;
  } | null>(null);
  const [loadingChain, setLoadingChain] = useState(false);

  // Payoff
  const [selectedStrike, setSelectedStrike] = useState<number | undefined>();
  const [selectedExpiry, setSelectedExpiry] = useState<string | undefined>();
  const [payoffData, setPayoffData] = useState<{
    payoffPoints: PayoffPoint[];
    premium: number;
    breakEven: number;
    maxProfit: number;
    maxLoss: number;
    currentProbability: number;
  } | null>(null);
  const [optionType, setOptionType] = useState<'CALL' | 'PUT'>('CALL');
  const [loadingPayoff, setLoadingPayoff] = useState(false);

  // Expanded score card
  const [expandedScore, setExpandedScore] = useState<string | null>(null);

  // ─── Load markets ───────────────────────────────────────────────
  useEffect(() => {
    loadMarkets();
  }, [category]);

  const loadMarkets = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getScoredMarkets(category, 30);
      if (response.success && response.data) {
        setMarkets(response.data.markets || []);
      }
    } catch (error) {
      console.error('Error loading scored markets:', error);
      toast.error('Failed to load markets');
    } finally {
      setLoading(false);
    }
  };

  // ─── Helper function to format volume ──────────────────────────
  const formatVolume = (volume: number): string => {
    if (volume < 1) return '<1';
    if (volume >= 1e12) return `${(volume / 1e12).toFixed(1)}T`;
    if (volume >= 1e9) return `${(volume / 1e9).toFixed(1)}B`;
    if (volume >= 1e6) return `${(volume / 1e6).toFixed(1)}M`;
    if (volume >= 1e3) return `${(volume / 1e3).toFixed(1)}K`;
    return `${volume.toFixed(0)}`;
  };

  // ─── Sort markets ──────────────────────────────────────────────
  const sortedMarkets = [...markets].sort((a, b) => {
    switch (sortBy) {
      case 'volume': return b.volume - a.volume;
      case 'expiry': return a.daysToExpiry - b.daysToExpiry;
      case 'probability': return Math.abs(b.currentProbability - 0.5) - Math.abs(a.currentProbability - 0.5);
      default: return b.score - a.score;
    }
  });



  // ─── Load options chain ────────────────────────────────────────
  const loadChain = useCallback(async (market: ScoredMarket) => {
    try {
      setLoadingChain(true);
      setSelectedMarket(market);
      setPayoffData(null);
      setSelectedStrike(undefined);
      setSelectedExpiry(undefined);

      const response = await ApiService.getOptionsChain(market.marketId, market.eventId);
      if (response.success && response.data) {
        setChain(response.data.chain);
        setChainMeta({
          currentProbability: response.data.currentProbability,
          daysToExpiry: response.data.daysToExpiry,
          impliedVolatility: response.data.impliedVolatility,
        });
      }
    } catch (error) {
      console.error('Error loading options chain:', error);
      toast.error('Failed to load options chain');
    } finally {
      setLoadingChain(false);
    }
  }, []);

  // ─── Load payoff ───────────────────────────────────────────────
  const loadPayoff = useCallback(async (strike: number, expiryLabel: string) => {
    if (!selectedMarket) return;
    try {
      setLoadingPayoff(true);
      setSelectedStrike(strike);
      setSelectedExpiry(expiryLabel);

      const expiryDays = parseInt(expiryLabel);
      const response = await ApiService.getPayoffData(
        selectedMarket.marketId,
        strike,
        expiryDays,
        optionType,
        1, // 1 SOL notional
        selectedMarket.eventId
      );

      if (response.success && response.data) {
        setPayoffData(response.data);
      }
    } catch (error) {
      console.error('Error loading payoff:', error);
    } finally {
      setLoadingPayoff(false);
    }
  }, [selectedMarket, optionType]);

  // Reload payoff when option type changes
  useEffect(() => {
    if (selectedStrike !== undefined && selectedExpiry) {
      loadPayoff(selectedStrike, selectedExpiry);
    }
  }, [optionType]);

  // ─── Buy option handler ────────────────────────────────────────
  const handleBuyOption = useCallback((strike: number, expiryLabel: string, optionType: 'CALL' | 'PUT') => {
    if (!selectedMarket || !chainMeta) {
      toast.error('Please select a market first');
      return;
    }

    const expiryDays = parseInt(expiryLabel);
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + expiryDays);

    // Navigate to create option page with pre-filled data
    navigate('/create-option', {
      state: {
        marketId: selectedMarket.marketId,
        eventId: selectedMarket.eventId,
        eventTitle: selectedMarket.eventTitle,
        marketTitle: selectedMarket.marketTitle,
        eventDescription: selectedMarket.eventDescription || selectedMarket.marketTitle,
        eventSettlementDate: new Date(Date.now() + chainMeta.daysToExpiry * 24 * 60 * 60 * 1000).toISOString(),
        strike,
        expiryDays,
        optionType,
        premium: 0, // Will be calculated on create page
        currentProbability: chainMeta.currentProbability,
        impliedVolatility: chainMeta.impliedVolatility,
        daysToExpiry: chainMeta.daysToExpiry,
      }
    });
  }, [selectedMarket, chainMeta, navigate]);

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div className="theme-page">
      {/* Header */}
      <div className="page-shell pb-0">
        <div className="artifact-panel">
          <div className="flex items-center gap-3 mb-2">
            <div className="brand-icon !w-10 !h-10">
              <span className="brand-icon__core !w-4 !h-4" />
            </div>
            <div>

              <h1 className="section-title text-[2.6rem]">
                Probability Options
              </h1>
            </div>
          </div>
          <p className="text-sm max-w-2xl muted-copy">
            Curated prediction markets filtered for quality. Only markets with ≥2 day resolution, 
            meaningful volume, tight spreads, and clear settlement rules make it here.
          </p>
        </div>
      </div>

      <div className="page-shell pt-6">
        {/* ─── Controls ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Category tabs */}
          <div className="segment-bar">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`segment-button ${
                  category === cat.value
                    ? 'segment-button--active'
                    : ''
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="input appearance-none !w-auto !min-w-[12rem] !py-3 text-xs pr-10"
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Count badge */}
          <span className="text-xs dim-copy ml-auto">
            {markets.length} markets passed filters
          </span>
        </div>

        {/* ─── Markets Grid ─────────────────────────────────────── */}
        {loading ? (
          <div className="loading-state py-20">
            <div className="space-y-4 max-w-md mx-auto">
              {[1, 2, 3].map(i => (
                <div key={i} className="artifact-panel animate-pulse">
                  <div className="flex gap-4">
                    <div className="w-16 h-16 bg-white/5 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-5 bg-white/5 rounded w-3/4" />
                      <div className="h-4 bg-white/5 rounded w-1/2" />
                      <div className="flex gap-2">
                        <div className="h-6 bg-white/5 rounded w-16" />
                        <div className="h-6 bg-white/5 rounded w-16" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <span className="mt-6 block text-sm">Filtering & scoring markets...</span>
          </div>
        ) : sortedMarkets.length === 0 ? (
          <div className="artifact-panel empty-state py-20">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-[var(--text-strong)] text-lg font-semibold mb-2">
              No markets passed the quality filters
            </p>
            <p className="dim-copy text-sm mb-4">
              Try a different category or check back later.
            </p>
            
            {/* Debug info - show filter criteria */}
            <details className="mt-6 max-w-md mx-auto text-left">
              <summary className="cursor-pointer text-xs dim-copy hover:text-[var(--text-base)] font-medium mb-2">
                🔍 Show filter criteria
              </summary>
              <div className="callout-panel text-xs muted-copy space-y-2">
                <div className="flex justify-between">
                  <span>Minimum days to expiry:</span>
                  <span className="font-mono text-[var(--text-base)]">≥2 days</span>
                </div>
                <div className="flex justify-between">
                  <span>Minimum volume:</span>
                  <span className="font-mono text-[var(--text-base)]">≥$100</span>
                </div>
                <div className="flex justify-between">
                  <span>Maximum spread:</span>
                  <span className="font-mono text-[var(--text-base)]">≤20%</span>
                </div>
                <div className="flex justify-between">
                  <span>Minimum notional depth:</span>
                  <span className="font-mono text-[var(--text-base)]">≥$50</span>
                </div>
                <div className="flex justify-between">
                  <span>Minimum quality score:</span>
                  <span className="font-mono text-[var(--text-base)]">≥30/100</span>
                </div>
                <div className="pt-2 mt-2">
                  <div className="divider-line mb-2" />
                  <p className="dim-copy text-[10px]">
                    These filters ensure markets have sufficient liquidity, clear settlement dates, 
                    and reasonable trading conditions for options.
                  </p>
                </div>
              </div>
            </details>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
            {sortedMarkets.map(market => {
              const isSelected = selectedMarket?.marketId === market.marketId;
              const isScoreExpanded = expandedScore === market.marketId;
              const jupiterUrl = `https://jup.ag/prediction/${market.eventId}`;

              return (
                <div
                  key={market.marketId}
                  className={`artifact-panel artifact-panel--interactive group relative transition-all duration-200 flex flex-col min-h-[280px] ${
                    isSelected
                      ? 'artifact-panel--highlight'
                      : ''
                  }`}
                  style={{ overflow: 'visible' }}
                >
                  {/* Score badge */}
                  <div className="absolute top-3 right-3 z-10">
                    <span
                      className={`status-pill ${
                        market.score >= 80
                          ? 'status-pill--lime'
                          : market.score >= 50
                          ? 'status-pill--gold'
                          : 'status-pill--danger'
                      }`}
                    >
                      {market.score.toFixed(0)}
                    </span>
                  </div>

                  {/* Main card content */}
                  <div className="flex-1 flex flex-col p-4">
                    {/* Header with fixed height */}
                    <div className="flex gap-3 min-h-[80px]">
                      {/* Gauge */}
                      <ProbabilityGauge probability={market.currentProbability} size={64} />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-[var(--text-strong)] leading-tight line-clamp-2 mb-1">
                          {market.eventTitle}
                        </h3>
                        <p className="text-xs dim-copy line-clamp-1 mb-1">
                          {market.marketTitle}
                        </p>

                        {/* Jupiter link - always visible with icon */}
                        <a
                          href={jupiterUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--accent-lime)] transition-colors font-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span>View on Jupiter</span>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    </div>

                    {/* Chips */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      <span className="status-pill status-pill--chrome !px-2 !py-1 !text-[10px]">
                        📅 {market.daysToExpiry.toFixed(0)}d
                      </span>
                      <span className="status-pill status-pill--chrome !px-2 !py-1 !text-[10px]">
                        💰 ${formatVolume(market.volume)}
                      </span>
                      <span className="status-pill status-pill--chrome !px-2 !py-1 !text-[10px]">
                        📏 {(market.spread * 100).toFixed(1)}%
                      </span>
                      <span className="status-pill status-pill--violet !px-2 !py-1 !text-[10px] capitalize">
                        {market.category}
                      </span>
                    </div>

                    {/* Score breakdown */}
                    {isScoreExpanded && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <ScoreBreakdown
                          breakdown={market.scoreBreakdown}
                          score={market.score}
                          compact
                        />
                      </div>
                    )}

                    {/* Spacer to push button to bottom */}
                    <div className="flex-1" />

                    {/* Bottom actions */}
                    <div className="mt-auto pt-3 flex items-center justify-between gap-2">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setExpandedScore(isScoreExpanded ? null : market.marketId);
                        }}
                        className="back-link text-[10px]"
                      >
                        {isScoreExpanded ? '▼ Hide score' : '▶ Show score breakdown'}
                      </button>
                      
                      <button
                        onClick={() => loadChain(market)}
                        className="btn btn-primary px-4 py-2 text-xs"
                      >
                        View Chain
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Options Chain (when market selected) ──────────────── */}
        {selectedMarket && (
          <div className="space-y-6">
            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="divider-line flex-1" />
              <span className="text-xs dim-copy font-medium">OPTIONS CHAIN</span>
              <div className="divider-line flex-1" />
            </div>

            {/* Market header */}
            <div className="artifact-panel">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-[var(--text-strong)] mb-1">
                    {selectedMarket.eventTitle}
                  </h2>
                  <p className="text-sm dim-copy">{selectedMarket.marketTitle}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedMarket(null);
                    setChain([]);
                    setChainMeta(null);
                    setPayoffData(null);
                  }}
                  className="btn btn-secondary px-4 py-2 text-[10px]"
                >
                  ✕ Close
                </button>
              </div>

              {/* Meta stats */}
              {chainMeta && (
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="value-box value-box--violet text-center">
                    <div className="text-[10px] dim-copy uppercase tracking-wider mb-1">Current Prob.</div>
                    <div className="text-xl font-bold accent-violet">
                      {(chainMeta.currentProbability * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="value-box text-center">
                    <div className="text-[10px] dim-copy uppercase tracking-wider mb-1">Days to Expiry</div>
                    <div className="text-xl font-bold text-[var(--text-strong)]">
                      {chainMeta.daysToExpiry.toFixed(1)}
                    </div>
                  </div>
                  <div className="value-box value-box--gold text-center">
                    <div className="text-[10px] dim-copy uppercase tracking-wider mb-1">Implied Vol.</div>
                    <div className="text-xl font-bold accent-gold">
                      {(chainMeta.impliedVolatility * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              )}

              {/* Chain grid */}
              {loadingChain ? (
                <div className="loading-state py-10">
                  <div className="mx-auto spinner" />
                  <span className="mt-2 block text-sm">Building options chain...</span>
                </div>
              ) : (
                <OptionsChainGrid
                  chain={chain}
                  currentProbability={chainMeta?.currentProbability ?? 0.5}
                  selectedStrike={selectedStrike}
                  selectedExpiry={selectedExpiry}
                  onCellSelect={(strike, expiry) => loadPayoff(strike, expiry)}
                  onBuyOption={handleBuyOption}
                />
              )}

              {/* Hint */}
              {!loadingChain && chain.length > 0 && !payoffData && (
                <p className="text-[10px] dim-copy text-center mt-3">
                  Click premium to view payoff chart • Click "Buy" button to create option
                </p>
              )}
            </div>

            {/* ─── Payoff chart ───────────────────────────────────── */}
            {(payoffData || loadingPayoff) && (
              <div className="artifact-panel">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-strong)]">
                      Payoff: {selectedStrike !== undefined ? `${(selectedStrike * 100).toFixed(0)}%` : '—'} strike, {selectedExpiry || '—'} expiry
                    </h3>
                    <p className="text-xs dim-copy mt-0.5">
                      Shows P&L per 1 SOL notional at different probability outcomes
                    </p>
                  </div>

                  {/* Option type toggle */}
                  <div className="segment-bar">
                    <button
                      onClick={() => setOptionType('CALL')}
                      className={`segment-button ${
                        optionType === 'CALL'
                          ? 'segment-button--active'
                          : ''
                      }`}
                    >
                      📈 CALL
                    </button>
                    <button
                      onClick={() => setOptionType('PUT')}
                      className={`segment-button ${
                        optionType === 'PUT'
                          ? 'segment-button--active'
                          : ''
                      }`}
                    >
                      📉 PUT
                    </button>
                  </div>
                </div>

                {loadingPayoff ? (
                  <div className="loading-state py-10">
                    <div className="mx-auto spinner" />
                  </div>
                ) : payoffData ? (
                  <PayoffChart
                    points={payoffData.payoffPoints}
                    currentProbability={payoffData.currentProbability}
                    breakEven={payoffData.breakEven}
                    maxProfit={payoffData.maxProfit}
                    maxLoss={payoffData.maxLoss}
                    strike={selectedStrike ?? 0.5}
                    optionType={optionType}
                    premium={payoffData.premium}
                  />
                ) : null}
              </div>
            )}

            {/* ─── Educational section ────────────────────────────── */}
            <div className="callout-panel callout-panel--violet">
              <h3 className="text-sm font-bold text-[var(--text-strong)] mb-3 flex items-center gap-2">
                <span>📖</span> How to Read This
              </h3>
              <div className="grid md:grid-cols-3 gap-4 text-xs muted-copy">
                <div>
                  <div className="font-semibold text-[var(--text-strong)] mb-1">Strike Prices</div>
                  <p>Each row is a probability threshold. A 70% CALL profits if the market's confidence rises above 70%.</p>
                </div>
                <div>
                  <div className="font-semibold text-[var(--text-strong)] mb-1">Expiry Buckets</div>
                  <p>Columns show different time horizons. Longer expiries cost more (more time value) but give the market longer to move.</p>
                </div>
                <div>
                  <div className="font-semibold text-[var(--text-strong)] mb-1">Payoff Chart</div>
                  <p>Shows your profit/loss at every possible outcome. Max loss is always the premium paid. Payoff is asymmetric by design.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
