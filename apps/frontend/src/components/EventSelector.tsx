import { FC, useState } from 'react';
import { format } from 'date-fns';
import type { JupiterEvent } from '@parlay-tokens/shared';

interface SelectedEvent {
  eventId: string;
  marketId: string;
  title: string;
  description: string;
  settlementDate: Date;
  selectedOutcome: 'YES' | 'NO';
}

interface EventSelectorProps {
  events: JupiterEvent[];
  selectedEvents: SelectedEvent[];
  onSelectEvent: (events: SelectedEvent[]) => void;
  loading: boolean;
}

export const EventSelector: FC<EventSelectorProps> = ({
  events,
  selectedEvents,
  onSelectEvent,
  loading,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const filteredEvents = events.filter((event) => {
    const title = event.metadata?.title || '';
    const subtitle = event.metadata?.subtitle || '';
    const searchLower = searchQuery.toLowerCase();
    
    return title.toLowerCase().includes(searchLower) ||
           subtitle.toLowerCase().includes(searchLower);
  });

  const toggleExpanded = (eventId: string) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedEvents(newExpanded);
  };

  const handleSelectMarket = (event: JupiterEvent, market: any, outcome: 'YES' | 'NO') => {
    const eventId = event.eventId || event.metadata?.eventId || '';
    const marketId = market.marketId || market.metadata?.marketId || '';
    
    // Check if this specific market is already selected
    const existingIndex = selectedEvents.findIndex(
      (e) => e.eventId === eventId && e.marketId === marketId
    );

    if (existingIndex >= 0) {
      // If same outcome, remove it; if different outcome, update it
      if (selectedEvents[existingIndex].selectedOutcome === outcome) {
        onSelectEvent(selectedEvents.filter((_, i) => i !== existingIndex));
      } else {
        const updated = [...selectedEvents];
        updated[existingIndex] = { ...updated[existingIndex], selectedOutcome: outcome };
        onSelectEvent(updated);
      }
    } else {
      // Add new selection
      // Use ONLY the market title from metadata
      const marketTitle = market.metadata?.title || market.title || 'Untitled Market';
      
      const newEvent: SelectedEvent = {
        eventId: eventId,
        marketId: marketId,
        title: marketTitle,  // Just the market title (e.g., "Sean Strickland")
        description: market.metadata?.rulesPrimary || market.rulesPrimary || '',
        settlementDate: new Date(market.closeTime * 1000),
        selectedOutcome: outcome,
      };
      onSelectEvent([...selectedEvents, newEvent]);
    }
  };

  const getMarketSelection = (eventId: string, marketId: string): 'YES' | 'NO' | null => {
    const selection = selectedEvents.find(
      (e) => e.eventId === eventId && e.marketId === marketId
    );
    return selection ? selection.selectedOutcome : null;
  };

  const getEventSlug = (event: JupiterEvent): string => {
    return event.eventId || event.metadata?.eventId || '';
  };

  const formatPrice = (price: number): string => {
    return `${(price / 10_000).toFixed(1)}`;
  };

  if (loading) {
    return (
      <div className="artifact-panel loading-state">
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="artifact-panel animate-pulse">
              <div className="h-6 bg-white/5 rounded w-3/4 mb-3" />
              <div className="h-4 bg-white/5 rounded w-1/2 mb-2" />
              <div className="h-4 bg-white/5 rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="artifact-panel">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-[var(--text-strong)]">Select Events</h2>
        <span className="text-sm muted-copy">
          {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} available
        </span>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search events..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="input mb-4"
      />

      {/* Selected Count */}
      <div className="callout-panel callout-panel--violet mb-4">
        <p className="text-sm font-medium text-[var(--text-strong)]">
          Selected: {selectedEvents.length} market{selectedEvents.length !== 1 ? 's' : ''}
          {selectedEvents.length >= 2 && (
            <span className="ml-2 accent-lime">✓ Ready to create parlay</span>
          )}
        </p>
      </div>

      {/* Events List */}
      <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2">
        {filteredEvents.length === 0 ? (
          <p className="empty-state py-8">No events found</p>
        ) : (
          filteredEvents.map((event) => {
            const eventId = event.eventId || event.metadata?.eventId || '';
            const title = event.metadata?.title || 'Untitled Event';
            const subtitle = event.metadata?.subtitle || '';
            const slug = getEventSlug(event);
            const jupiterUrl = `https://jup.ag/prediction/${slug}`;
            const markets = event.markets || [];
            const isExpanded = expandedEvents.has(eventId);
            const hasSelections = selectedEvents.some((e) => e.eventId === eventId);

            return (
              <div
                key={eventId}
                className={`artifact-panel artifact-panel--interactive transition-all ${
                  hasSelections 
                    ? 'artifact-panel--highlight' 
                    : ''
                }`}
              >
                {/* Event Header */}
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-xl flex-1 text-[var(--text-strong)]">{title}</h3>
                    <a
                      href={jupiterUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 btn btn-secondary px-4 py-2 text-[10px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span>View on Jupiter</span>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                  
                  {subtitle && (
                    <p className="text-sm muted-copy mb-3">{subtitle}</p>
                  )}

                  <div className="flex items-center gap-4 text-xs dim-copy mb-3">
                    {event.category && (
                      <span className="status-pill status-pill--chrome capitalize">
                        {event.category}
                      </span>
                    )}
                    {event.isLive && (
                      <span className="status-pill status-pill--lime">
                        <span className="w-2 h-2 bg-[var(--lime)] rounded-full animate-pulse"></span>
                        Live
                      </span>
                    )}
                    <span>{markets.length} market{markets.length !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Toggle Markets Button */}
                  {markets.length > 0 && (
                    <button
                      onClick={() => toggleExpanded(eventId)}
                      className="back-link"
                    >
                      {isExpanded ? '▼' : '▶'} {isExpanded ? 'Hide' : 'Show'} Markets
                    </button>
                  )}
                </div>

                {/* Markets List */}
                {isExpanded && markets.length > 0 && (
                  <div className="mt-2 space-y-3 p-4">
                    <div className="divider-line" />
                    {markets.map((market: any, idx: number) => {
                      const marketId = market.marketId || market.metadata?.marketId || '';
                      const marketTitle = market.metadata?.title || market.title || 'Untitled Market';
                      const closeTime = market.closeTime ? new Date(market.closeTime * 1000) : null;
                      const selection = getMarketSelection(eventId, marketId);
                      const pricing = market.pricing || {};
                      
                      const volume = pricing.volume || 0;
                      const volumeFormatted = volume > 0 ? `${(volume / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 0 })} vol` : '';
                      
                      const yesPrice = pricing.buyYesPriceUsd || 0;
                      const noPrice = pricing.buyNoPriceUsd || 0;
                      const yesPercent = yesPrice > 0 ? Math.round((yesPrice / 1_000_000) * 100) : 0;
                      // A market has valid pricing if it has at least one price (YES or NO)
                      const hasValidPricing = yesPrice > 0 || noPrice > 0;

                      return (
                        <div
                          key={marketId}
                          className={`callout-panel ${
                            selection 
                              ? 'callout-panel--violet' 
                              : ''
                          } ${!hasValidPricing ? 'opacity-50' : ''}`}
                        >
                          {!hasValidPricing && (
                            <div className="mb-2 status-pill status-pill--gold">
                              ⚠️ No active pricing - market may not be tradeable
                            </div>
                          )}
                          <div className="mb-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-lg text-[var(--text-strong)] mb-1 line-clamp-2 leading-relaxed">{marketTitle}</h4>
                                <p className="text-sm muted-copy line-clamp-1">
                                  Market: {marketTitle}
                                </p>
                              </div>
                              {volumeFormatted && (
                                <span className="text-xs dim-copy whitespace-nowrap">
                                  {volumeFormatted}
                                </span>
                              )}
                            </div>
                            {closeTime && (
                              <p className="text-xs dim-copy mt-1">
                                Settles: {format(closeTime, 'MMM d, yyyy h:mm a')}
                              </p>
                            )}
                          </div>

                          {/* Pricing Info */}
                          {(pricing.buyYesPriceUsd || pricing.buyNoPriceUsd) && (
                            <div className="callout-panel mb-3 flex items-center gap-3 text-xs">
                              {pricing.buyYesPriceUsd && (
                                <div className="flex items-center gap-1">
                                  <span className="font-medium accent-lime">{yesPercent}%</span>
                                  <span className="dim-copy">Yes {formatPrice(pricing.buyYesPriceUsd)}¢</span>
                                </div>
                              )}
                              {pricing.buyNoPriceUsd && (
                                <div className="flex items-center gap-1">
                                  <span className="font-medium accent-violet">{100 - yesPercent}%</span>
                                  <span className="dim-copy">No {formatPrice(pricing.buyNoPriceUsd)}¢</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* YES/NO Buttons */}
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleSelectMarket(event, market, 'YES')}
                              className={`flex-1 py-4 px-5 rounded-lg font-medium text-sm transition-all min-h-[44px] ${
                                selection === 'YES'
                                  ? 'bg-[rgba(216,255,54,0.16)] text-[var(--lime-soft)] shadow-lg shadow-[rgba(216,255,54,0.12)] scale-105 border border-[rgba(216,255,54,0.22)]'
                                  : 'bg-[rgba(255,255,255,0.03)] text-[var(--text-base)] hover:bg-[rgba(255,255,255,0.06)] border border-[rgba(244,245,248,0.08)]'
                              }`}
                            >
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-xs font-semibold opacity-90">YES</span>
                                <span className="font-bold line-clamp-2 leading-relaxed">{marketTitle}</span>
                                {pricing.buyYesPriceUsd && (
                                  <span className="text-xs opacity-75">{yesPercent}% chance</span>
                                )}
                              </div>
                            </button>
                            <button
                              onClick={() => handleSelectMarket(event, market, 'NO')}
                              className={`flex-1 py-4 px-5 rounded-lg font-medium text-sm transition-all min-h-[44px] ${
                                selection === 'NO'
                                  ? 'bg-[rgba(125,69,255,0.16)] text-[var(--violet-soft)] shadow-lg shadow-[rgba(125,69,255,0.14)] scale-105 border border-[rgba(125,69,255,0.22)]'
                                  : 'bg-[rgba(255,255,255,0.03)] text-[var(--text-base)] hover:bg-[rgba(255,255,255,0.06)] border border-[rgba(244,245,248,0.08)]'
                              }`}
                            >
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-xs font-semibold opacity-90">NO</span>
                                <span className="font-bold line-clamp-2 leading-relaxed">NOT {marketTitle}</span>
                                {pricing.buyNoPriceUsd && (
                                  <span className="text-xs opacity-75">{100 - yesPercent}% chance</span>
                                )}
                              </div>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
