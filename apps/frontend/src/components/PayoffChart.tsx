import { FC, useMemo } from 'react';
import type { PayoffPoint } from '@parlay-tokens/shared';

interface PayoffChartProps {
  points: PayoffPoint[];
  currentProbability: number;
  breakEven: number;
  maxProfit: number;
  maxLoss: number;
  strike: number;
  optionType: 'CALL' | 'PUT';
  premium: number;
}

const W = 600;
const H = 280;
const PAD = { top: 30, right: 30, bottom: 40, left: 60 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

export const PayoffChart: FC<PayoffChartProps> = ({
  points,
  currentProbability,
  breakEven,
  maxProfit,
  maxLoss,
  strike,
  optionType,
  premium,
}) => {
  const { path, zeroY, xScale, yScale, yMin, yMax } = useMemo(() => {
    const pnls = points.map(p => p.pnl);
    const yMin = Math.min(...pnls, -premium * 1.2);
    const yMax = Math.max(...pnls, premium * 1.2);
    const yRange = yMax - yMin || 1;

    const xScale = (x: number) => PAD.left + x * PLOT_W;
    const yScale = (y: number) => PAD.top + PLOT_H - ((y - yMin) / yRange) * PLOT_H;
    const zeroY = yScale(0);

    // Build SVG path
    const pathParts = points.map((p, i) => {
      const x = xScale(p.probability);
      const y = yScale(p.pnl);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return { path: pathParts.join(' '), zeroY, xScale, yScale, yMin, yMax };
  }, [points, premium]);

  // Gradient fill
  const fillPath = useMemo(() => {
    if (points.length === 0) return '';
    const first = xScale(points[0].probability);
    const last = xScale(points[points.length - 1].probability);
    return `${path} L${last.toFixed(1)},${zeroY.toFixed(1)} L${first.toFixed(1)},${zeroY.toFixed(1)} Z`;
  }, [path, zeroY, points]);

  // X-axis ticks
  const xTicks = [0, 0.25, 0.5, 0.75, 1.0];
  // Y-axis ticks (5 evenly spaced)
  const yRange = yMax - yMin || 1;
  const yTicks = Array.from({ length: 5 }, (_, i) => yMin + (yRange * i) / 4);

  const isCall = optionType === 'CALL';

  return (
    <div className="w-full" id="payoff-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ maxHeight: 300, fontFamily: "'Space Grotesk', sans-serif" }}
      >
        <defs>
          {/* Profit gradient fill */}
          <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isCall ? '#d8ff36' : '#7d45ff'} stopOpacity="0.3" />
            <stop offset="100%" stopColor={isCall ? '#d8ff36' : '#7d45ff'} stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={isCall ? '#d8ff36' : '#7d45ff'} stopOpacity="0.4" />
            <stop offset="50%" stopColor={isCall ? '#d8ff36' : '#7d45ff'} />
            <stop offset="100%" stopColor={isCall ? '#d8ff36' : '#7d45ff'} stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <line
            key={`ygrid-${i}`}
            x1={PAD.left}
            y1={yScale(tick)}
            x2={W - PAD.right}
            y2={yScale(tick)}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
        ))}

        {/* Zero line */}
        <line
          x1={PAD.left}
          y1={zeroY}
          x2={W - PAD.right}
          y2={zeroY}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1"
          strokeDasharray="4,3"
        />

        {/* Fill under curve */}
        <path d={fillPath} fill="url(#profitGrad)" />

        {/* Main line */}
        <path
          d={path}
          fill="none"
          stroke="url(#lineGrad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Strike line */}
        <line
          x1={xScale(strike)}
          y1={PAD.top}
          x2={xScale(strike)}
          y2={H - PAD.bottom}
          stroke="#7d45ff"
          strokeWidth="1"
          strokeDasharray="3,3"
          opacity="0.6"
        />
        <text
          x={xScale(strike)}
          y={PAD.top - 6}
          textAnchor="middle"
          fill="#b398ff"
          fontSize="9"
          fontWeight="600"
        >
          Strike {(strike * 100).toFixed(0)}%
        </text>

        {/* Current probability marker */}
        <line
          x1={xScale(currentProbability)}
          y1={PAD.top}
          x2={xScale(currentProbability)}
          y2={H - PAD.bottom}
          stroke="#f6c86f"
          strokeWidth="1.5"
          strokeDasharray="4,2"
          opacity="0.7"
        />
        <circle
          cx={xScale(currentProbability)}
          cy={yScale(-premium)}
          r="4"
          fill="#f6c86f"
          stroke="#14111d"
          strokeWidth="2"
        />
        <text
          x={xScale(currentProbability) + 6}
          y={PAD.top + 14}
          fill="#f6c86f"
          fontSize="9"
          fontWeight="600"
        >
          Now {(currentProbability * 100).toFixed(0)}%
        </text>

        {/* Break-even marker */}
        {breakEven >= 0 && breakEven <= 1 && (
          <>
            <circle
              cx={xScale(breakEven)}
              cy={zeroY}
              r="4"
              fill="none"
              stroke="#d4d8e2"
              strokeWidth="2"
            />
            <text
              x={xScale(breakEven)}
              y={zeroY + 14}
              textAnchor="middle"
              fill="#d4d8e2"
              fontSize="8"
              fontWeight="500"
            >
              BE {(breakEven * 100).toFixed(0)}%
            </text>
          </>
        )}

        {/* X-axis labels */}
        {xTicks.map(tick => (
          <text
            key={`x-${tick}`}
            x={xScale(tick)}
            y={H - PAD.bottom + 18}
            textAnchor="middle"
            fill="rgba(215,208,222,0.55)"
            fontSize="9"
          >
            {(tick * 100).toFixed(0)}%
          </text>
        ))}

        {/* Y-axis labels */}
        {yTicks.map((tick, i) => (
          <text
            key={`y-${i}`}
            x={PAD.left - 8}
            y={yScale(tick) + 3}
            textAnchor="end"
            fill="rgba(215,208,222,0.55)"
            fontSize="9"
          >
            {tick >= 0 ? '+' : ''}{tick.toFixed(3)}
          </text>
        ))}

        {/* Axis labels */}
        <text
          x={W / 2}
          y={H - 4}
          textAnchor="middle"
          fill="rgba(167,158,175,0.8)"
          fontSize="10"
        >
          Probability at Expiry
        </text>
        <text
          x={12}
          y={H / 2}
          textAnchor="middle"
          fill="rgba(167,158,175,0.8)"
          fontSize="10"
          transform={`rotate(-90, 12, ${H / 2})`}
        >
          P&L (SOL)
        </text>

        {/* Profit / Loss zone labels */}
        <text
          x={W - PAD.right - 4}
          y={yScale(maxProfit / 2)}
          textAnchor="end"
          fill="rgba(216,255,54,0.55)"
          fontSize="8"
        >
          PROFIT ZONE
        </text>
        <text
          x={PAD.left + 4}
          y={yScale(-premium / 2)}
          textAnchor="start"
          fill="rgba(125,69,255,0.55)"
          fontSize="8"
        >
          LOSS ZONE
        </text>
      </svg>

      {/* Summary stats below chart */}
      <div className="grid grid-cols-4 gap-2 mt-2 text-xs">
        <div className="value-box text-center">
          <div className="dim-copy mb-0.5">Premium</div>
          <div className="text-[var(--text-strong)] font-mono font-semibold">{premium.toFixed(4)}</div>
        </div>
        <div className="value-box value-box--violet text-center">
          <div className="dim-copy mb-0.5">Break-Even</div>
          <div className="accent-violet font-mono font-semibold">{(breakEven * 100).toFixed(1)}%</div>
        </div>
        <div className="value-box value-box--lime text-center">
          <div className="dim-copy mb-0.5">Max Profit</div>
          <div className="accent-lime font-mono font-semibold">+{maxProfit.toFixed(4)}</div>
        </div>
        <div className="value-box value-box--gold text-center">
          <div className="dim-copy mb-0.5">Max Loss</div>
          <div className="accent-gold font-mono font-semibold">-{maxLoss.toFixed(4)}</div>
        </div>
      </div>
    </div>
  );
};
