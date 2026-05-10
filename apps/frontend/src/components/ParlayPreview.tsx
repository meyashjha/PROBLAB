import { FC } from 'react';
import { getMultiplierValue, type MultiplierTier } from '@parlay-tokens/shared';
import { parseOutcomeDescription } from '../utils/outcomeParser';

interface SelectedEvent {
  eventId: string;
  marketId: string;
  title: string;
  description: string;
  selectedOutcome: 'YES' | 'NO';
}

interface ParlayPreviewProps {
  selectedEvents: SelectedEvent[];
  multiplier: MultiplierTier;
  principalAmount: number;
}

export const ParlayPreview: FC<ParlayPreviewProps> = ({
  selectedEvents,
  multiplier,
  principalAmount,
}) => {
  const multiplierValue = getMultiplierValue(multiplier);
  const potentialPayout = principalAmount * multiplierValue;

  return (
    <div className="mt-6 pt-6">
      <div className="divider-line mb-6" />
      <h3 className="text-xl font-semibold mb-3 text-[var(--text-strong)]">Preview</h3>

      {selectedEvents.length > 0 ? (
        <div className="space-y-2 mb-4">
          {selectedEvents.map((event, index) => {
            const outcomeDesc = parseOutcomeDescription(event.description, event.selectedOutcome, event.title);
            return (
              <div key={`${event.eventId}-${event.marketId}`} className="callout-panel text-sm">
                <div className="flex items-start gap-2">
                  <span className="muted-copy font-medium shrink-0">#{index + 1}:</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium accent-violet mb-1 line-clamp-2 leading-relaxed">{outcomeDesc}</div>
                    <div className="text-xs muted-copy line-clamp-1">{event.title}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm dim-copy mb-4">No events selected</p>
      )}

      <div className="callout-panel callout-panel--violet space-y-2">
        <div className="flex justify-between text-sm">
          <span className="muted-copy">Events:</span>
          <span className="font-bold text-[var(--text-strong)]">{selectedEvents.length}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="muted-copy">Multiplier:</span>
          <span className="font-bold text-[var(--text-strong)]">{multiplier}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="muted-copy">Principal:</span>
          <span className="font-bold text-[var(--text-strong)]">{principalAmount} SOL</span>
        </div>
        <div className="pt-2 mt-2">
          <div className="divider-line mb-2" />
          <div className="flex justify-between">
            <span className="font-bold text-[var(--text-strong)]">Potential Payout:</span>
            <span className="font-bold accent-lime text-lg">
              {potentialPayout.toFixed(2)} SOL
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
