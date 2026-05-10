import { FC, Fragment, useMemo } from 'react';
import type { OptionsChainEntry } from '@parlay-tokens/shared';

interface OptionsChainGridProps {
  chain: OptionsChainEntry[];
  currentProbability: number;
  selectedStrike?: number;
  selectedExpiry?: string;
  onCellSelect: (strike: number, expiryLabel: string) => void;
  onBuyOption?: (strike: number, expiryLabel: string, optionType: 'CALL' | 'PUT') => void;
}

export const OptionsChainGrid: FC<OptionsChainGridProps> = ({
  chain,
  currentProbability,
  selectedStrike,
  selectedExpiry,
  onCellSelect,
  onBuyOption,
}) => {
  // Extract unique strikes and expiry labels
  const strikes = useMemo(() => {
    const s = [...new Set(chain.map(c => c.strike))];
    s.sort((a, b) => a - b);
    return s;
  }, [chain]);

  const expiryLabels = useMemo(() => {
    const labels = [...new Set(chain.map(c => c.expiryLabel))];
    // Sort by days
    labels.sort((a, b) => {
      const da = parseInt(a);
      const db = parseInt(b);
      return da - db;
    });
    return labels;
  }, [chain]);

  // Build lookup map
  const lookup = useMemo(() => {
    const map = new Map<string, OptionsChainEntry>();
    for (const entry of chain) {
      map.set(`${entry.strike}-${entry.expiryLabel}`, entry);
    }
    return map;
  }, [chain]);

  const getCellColor = (delta: number, isCall: boolean): string => {
    const absDelta = Math.abs(delta);
    if (isCall) {
      if (absDelta > 0.7) return 'bg-[rgba(216,255,54,0.18)] text-[var(--lime-soft)]';
      if (absDelta > 0.4) return 'bg-[rgba(216,255,54,0.1)] text-[var(--lime)]';
      return 'text-[var(--text-muted)]';
    } else {
      if (absDelta > 0.7) return 'bg-[rgba(125,69,255,0.18)] text-[var(--violet-soft)]';
      if (absDelta > 0.4) return 'bg-[rgba(125,69,255,0.1)] text-[var(--violet)]';
      return 'text-[var(--text-muted)]';
    }
  };

  if (chain.length === 0) {
    return (
      <div className="empty-state py-8">
        No options chain data available
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Left scroll shadow */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[var(--void-1)] to-transparent pointer-events-none z-10" />
      
      <div className="overflow-x-auto" id="options-chain-grid">
        <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-[rgba(10,9,15,0.96)] backdrop-blur px-3 py-2 text-left muted-copy font-semibold border-b border-[rgba(244,245,248,0.08)]">
              Strike
            </th>
            {expiryLabels.map(label => (
              <th
                key={label}
                colSpan={2}
                className="px-2 py-2 text-center muted-copy font-semibold border-b border-[rgba(244,245,248,0.08)]"
              >
                <span className="text-[var(--text-base)]">{label}</span>
              </th>
            ))}
          </tr>
          <tr>
            <th className="sticky left-0 z-10 bg-[rgba(10,9,15,0.96)] backdrop-blur px-3 py-1 text-left dim-copy text-[10px] border-b border-[rgba(244,245,248,0.08)]">
              (probability)
            </th>
            {expiryLabels.map(label => (
              <Fragment key={`sub-${label}`}>
                <th className="px-2 py-1 text-center accent-lime text-[10px] border-b border-[rgba(244,245,248,0.08)] font-medium">
                  CALL
                </th>
                <th className="px-2 py-1 text-center accent-violet text-[10px] border-b border-[rgba(244,245,248,0.08)] font-medium">
                  PUT
                </th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {strikes.map(strike => {
            const isAtMoney = Math.abs(strike - currentProbability) < 0.05;
            return (
              <tr
                key={strike}
                className={`border-b border-[rgba(244,245,248,0.06)] ${
                  isAtMoney ? 'bg-[rgba(125,69,255,0.08)]' : 'hover:bg-white/[0.02]'
                }`}
              >
                <td className="sticky left-0 z-10 bg-[rgba(10,9,15,0.96)] backdrop-blur px-3 py-2 font-mono font-semibold whitespace-nowrap max-w-[200px] truncate">
                  <span className={isAtMoney ? 'accent-violet' : 'text-[var(--text-base)]'}>
                    {(strike * 100).toFixed(0)}%
                  </span>
                  {isAtMoney && (
                    <span
                      className="ml-1.5 text-[9px] font-normal"
                      style={{ color: 'rgba(179, 152, 255, 0.6)' }}
                    >
                      ATM
                    </span>
                  )}
                </td>
                {expiryLabels.map(label => {
                  const entry = lookup.get(`${strike}-${label}`);
                  if (!entry) {
                    return (
                      <Fragment key={`${strike}-${label}`}>
                        <td className="px-2 py-2 text-center dim-copy">—</td>
                        <td className="px-2 py-2 text-center dim-copy">—</td>
                      </Fragment>
                    );
                  }

                  const isSelected = selectedStrike === strike && selectedExpiry === label;
                  const cellBase = isSelected
                    ? 'ring-1 ring-[rgba(216,255,54,0.35)] bg-[rgba(216,255,54,0.08)]'
                    : 'cursor-pointer hover:bg-white/[0.04]';

                  return (
                    <Fragment key={`${strike}-${label}`}>
                      <td
                        className={`px-2 py-2 text-center transition-colors ${cellBase}`}
                      >
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => onCellSelect(strike, label)}
                            className={`font-mono text-xs ${getCellColor(entry.callDelta, true)} hover:opacity-80`}
                            title={`CALL Δ=${entry.callDelta.toFixed(2)} BE=${(entry.breakEvenCall * 100).toFixed(0)}%`}
                          >
                            {entry.callPremium.toFixed(3)}
                          </button>
                          {onBuyOption && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onBuyOption(strike, label, 'CALL');
                              }}
                              className="text-[10px] px-2 py-1 min-h-[32px] bg-[rgba(216,255,54,0.12)] text-[var(--lime-soft)] rounded hover:bg-[rgba(216,255,54,0.18)] transition-colors font-medium"
                            >
                              Buy
                            </button>
                          )}
                        </div>
                      </td>
                      <td
                        className={`px-2 py-2 text-center transition-colors ${cellBase}`}
                      >
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => onCellSelect(strike, label)}
                            className={`font-mono text-xs ${getCellColor(entry.putDelta, false)} hover:opacity-80`}
                            title={`PUT Δ=${entry.putDelta.toFixed(2)} BE=${(entry.breakEvenPut * 100).toFixed(0)}%`}
                          >
                            {entry.putPremium.toFixed(3)}
                          </button>
                          {onBuyOption && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onBuyOption(strike, label, 'PUT');
                              }}
                              className="text-[10px] px-2 py-1 min-h-[32px] bg-[rgba(125,69,255,0.14)] text-[var(--violet-soft)] rounded hover:bg-[rgba(125,69,255,0.22)] transition-colors font-medium"
                            >
                              Buy
                            </button>
                          )}
                        </div>
                      </td>
                    </Fragment>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      {/* Right scroll shadow */}
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--void-1)] to-transparent pointer-events-none z-10" />

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 px-2 text-[10px] dim-copy">
        <span>Premiums in SOL (per 1 SOL notional)</span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[rgba(216,255,54,0.4)]" /> High CALL Δ
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[rgba(125,69,255,0.45)]" /> High PUT Δ
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[rgba(246,200,111,0.5)]" /> ATM
        </span>
      </div>
    </div>
  );
};
