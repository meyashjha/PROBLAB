import { FC } from 'react';

interface ScoreBreakdownProps {
  breakdown: {
    liquidity: number;               // 0-30
    volatility: number;              // 0-20
    catalyst: number;                // 0-20
    ruleClarity: number;             // 0-15
    manipulationResistance: number;  // 0-15
  };
  score: number;
  compact?: boolean;
}

const FACTORS = [
  { key: 'liquidity' as const, label: 'Liquidity', max: 30, color: '#d8ff36', desc: 'Trading volume relative to $5K cap' },
  { key: 'volatility' as const, label: 'Vol. Opportunity', max: 20, color: '#7d45ff', desc: 'Probability near 50% = more upside for options' },
  { key: 'catalyst' as const, label: 'Catalyst', max: 20, color: '#f6c86f', desc: 'Closer resolution = more price action' },
  { key: 'ruleClarity' as const, label: 'Rule Clarity', max: 15, color: '#d4d8e2', desc: 'Structured fields: rules, close time' },
  { key: 'manipulationResistance' as const, label: 'Manip. Resist.', max: 15, color: '#ff8f68', desc: 'Spread tightness + depth ratio' },
];

export const ScoreBreakdown: FC<ScoreBreakdownProps> = ({ breakdown, score, compact }) => {
  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'} id="score-breakdown">
      {/* Total score header */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold dim-copy uppercase tracking-wider">
          Quality Score
        </span>
        <span
          className={`status-pill ${
            score >= 80
              ? 'status-pill--lime'
              : score >= 50
              ? 'status-pill--gold'
              : 'status-pill--danger'
          }`}
        >
          {score.toFixed(0)}/100
        </span>
      </div>

      {/* Factor bars */}
      {FACTORS.map(({ key, label, max, color, desc }) => {
        const value = breakdown[key];
        const pct = (value / max) * 100;

        return (
          <div key={key} className="group relative">
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span className="muted-copy font-medium">{label}</span>
              <span className="dim-copy font-mono">
                {value.toFixed(1)}/{max}
              </span>
            </div>
            <div
              className="w-full rounded-full overflow-hidden"
              style={{ height: compact ? 4 : 6, background: 'rgba(255,255,255,0.06)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${color}88, ${color})`,
                }}
              />
            </div>
            {/* Tooltip */}
            {!compact && (
              <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-20">
                <div className="callout-panel whitespace-nowrap text-xs text-[var(--text-base)] shadow-xl">
                  {desc}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
