import { FC, useState, useEffect } from 'react';
import { API_CONFIG } from '../config/api';

interface LiveOddsProps {
  events: Array<{
    eventId: string;
    marketId: string;
    title: string;
    selectedOutcome: 'YES' | 'NO';
  }>;
  principalAmount: number;
  onQuoteUpdate?: (quote: any) => void;
}

export const LiveOddsDisplay: FC<LiveOddsProps> = ({
  events,
  principalAmount,
  onQuoteUpdate,
}) => {
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (events.length < 2 || principalAmount <= 0) {
      setQuote(null);
      return;
    }

    fetchQuote();
    // Refresh quote every 30 seconds
    const interval = setInterval(fetchQuote, 30000);
    return () => clearInterval(interval);
  }, [events, principalAmount]);

  const fetchQuote = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_CONFIG.PARLAY_API_URL}/api/quote/parlay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: events.map(e => ({
            eventId: e.eventId,
            marketId: e.marketId,
            selectedOutcome: e.selectedOutcome,
          })),
          principalAmount,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setQuote(data.data);
        setLastUpdated(new Date());
        if (onQuoteUpdate) {
          onQuoteUpdate(data.data);
        }
      } else {
        const errorMsg = data.error?.message || 'Failed to fetch quote';
        setError(errorMsg);
        // Clear quote on error
        setQuote(null);
        if (onQuoteUpdate) {
          onQuoteUpdate(null);
        }
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to fetch quote';
      setError(errorMsg);
      setQuote(null);
      if (onQuoteUpdate) {
        onQuoteUpdate(null);
      }
    } finally {
      setLoading(false);
    }
  };

  if (events.length < 2) {
    return (
      <div className="callout-panel text-center text-sm muted-copy">
        Select at least 2 events to see live odds
      </div>
    );
  }

  if (loading && !quote) {
    return (
      <div className="callout-panel text-center">
        <div className="mx-auto spinner spinner--sm" />
        <p className="mt-2 text-sm muted-copy">Calculating odds...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="callout-panel callout-panel--gold">
        <div className="flex items-start gap-2 mb-2">
          <span className="accent-gold text-lg">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-semibold accent-gold mb-1">Cannot Calculate Odds</p>
            <p className="text-xs text-[var(--text-base)]">{error}</p>
            {error.includes('Invalid price') && (
              <p className="text-xs muted-copy mt-2">
                This market may not have active trading yet. Try selecting different markets with volume.
              </p>
            )}
          </div>
        </div>
        <button
          onClick={fetchQuote}
          className="back-link mt-2"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!quote) {
    return null;
  }

  const { quote: parlayQuote, validation, formattedOdds } = quote;

  return (
    <div className="space-y-4">
      {/* Main Odds Display */}
      <div className="callout-panel callout-panel--violet">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-strong)]">Live Odds</h3>
            {lastUpdated && (
              <p className="text-xs dim-copy mt-1">
                Updated {Math.floor((Date.now() - lastUpdated.getTime()) / 1000)}s ago
              </p>
            )}
          </div>
          {loading && (
            <span className="text-xs accent-violet flex items-center gap-1">
              <div className="spinner spinner--sm" />
              Updating...
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm accent-violet mb-1">Decimal Odds</p>
            <p className="text-3xl font-bold text-[var(--text-strong)]">{formattedOdds.decimal}x</p>
          </div>
          <div>
            <p className="text-sm accent-violet mb-1">American Odds</p>
            <p className="text-3xl font-bold text-[var(--text-strong)]">{formattedOdds.american}</p>
          </div>
        </div>

        <div className="callout-panel space-y-2">
          <div className="flex justify-between text-sm">
            <span className="muted-copy">Win Probability:</span>
            <span className="font-bold text-[var(--text-strong)]">{(parlayQuote.combinedProbability * 100).toFixed(2)}%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="muted-copy">Potential Payout:</span>
            <span className="font-bold accent-lime">{parlayQuote.potentialPayout.toFixed(4)} SOL</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="muted-copy">Expected Value:</span>
            <span className={`font-bold ${parlayQuote.expectedValue >= 0 ? 'accent-lime' : 'accent-gold'}`}>
              {parlayQuote.expectedValue >= 0 ? '+' : ''}{parlayQuote.expectedValue.toFixed(4)} SOL
            </span>
          </div>
        </div>
      </div>

      {/* Individual Event Odds */}
      <div className="artifact-panel">
        <h4 className="text-sm font-bold text-[var(--text-strong)] mb-3">Individual Event Odds</h4>
        <div className="space-y-2">
          {parlayQuote.events.map((event: any, index: number) => (
            <div key={event.marketId} className="callout-panel flex items-center justify-between text-sm">
              <div className="flex-1">
                <span className="dim-copy">#{index + 1}:</span>
                <span className="ml-2 font-medium text-[var(--text-base)]">{event.title.substring(0, 30)}...</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="muted-copy">{(event.impliedProbability * 100).toFixed(1)}%</span>
                <span className="font-bold accent-violet">{event.fairOdds.toFixed(2)}x</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Validation Warning */}
      {!validation.valid && (
        <div className="callout-panel callout-panel--gold">
          <p className="text-sm accent-gold">
            <span className="font-bold">⚠️ Warning:</span> {validation.reason}
          </p>
        </div>
      )}

      {/* Advanced Stats */}
      <details className="artifact-panel">
        <summary className="text-sm font-bold text-[var(--text-strong)] cursor-pointer">
          Advanced Statistics
        </summary>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="muted-copy">Fair Odds (No House Edge):</span>
            <span className="font-medium text-[var(--text-base)]">{parlayQuote.fairParlayOdds.toFixed(2)}x</span>
          </div>
          <div className="flex justify-between">
            <span className="muted-copy">House Edge:</span>
            <span className="font-medium text-[var(--text-base)]">{(parlayQuote.houseEdge * 100).toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="muted-copy">Break-Even Probability:</span>
            <span className="font-medium text-[var(--text-base)]">{(parlayQuote.breakEvenProbability * 100).toFixed(2)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="muted-copy">Fractional Odds:</span>
            <span className="font-medium text-[var(--text-base)]">{formattedOdds.fractional}</span>
          </div>
        </div>
      </details>

      {/* Refresh Button */}
      <button
        onClick={fetchQuote}
        disabled={loading}
        className="btn btn-secondary w-full"
      >
        🔄 Refresh Odds
      </button>
    </div>
  );
};
