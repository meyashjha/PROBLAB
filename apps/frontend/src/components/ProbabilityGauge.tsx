import { FC } from 'react';

interface ProbabilityGaugeProps {
  probability: number; // 0-1
  size?: number;       // diameter in px
  label?: string;
}

export const ProbabilityGauge: FC<ProbabilityGaugeProps> = ({
  probability,
  size = 80,
  label,
}) => {
  const pct = Math.round(probability * 100);
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - probability);

  // Color gradient: ember -> gold -> lime
  const hue = 18 + (probability * 64);
  const color = `hsl(${hue}, 90%, 60%)`;
  const bgColor = `hsla(${hue}, 48%, 22%, 0.55)`;

  return (
    <div className="flex flex-col items-center gap-1" id="probability-gauge">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth="6"
          opacity="0.3"
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.6s ease' }}
        />
        {/* Center text */}
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill={color}
          fontSize={size * 0.22}
          fontWeight="bold"
          fontFamily="'Space Grotesk', sans-serif"
        >
          {pct}%
        </text>
      </svg>
      {label && (
        <span className="text-xs muted-copy font-medium truncate max-w-full">
          {label}
        </span>
      )}
    </div>
  );
};
