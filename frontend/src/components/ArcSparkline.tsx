'use client';

interface ArcSparklineProps {
  labels: string[];
  width?: number;
  height?: number;
  showLabels?: boolean;
  className?: string;
}

const LABEL_COLORS: Record<string, string> = {
  joy: '#10b981',
  triumph: '#059669',
  peace: '#34d399',
  hope: '#6ee7b7',
  'turning point': '#fbbf24',
  calm: '#94a3b8',
  neutral: '#64748b',
  despair: '#ef4444',
  tension: '#f97316',
  struggle: '#f59e0b',
  conflict: '#dc2626',
  dread: '#991b1b',
};

const LABEL_VALUES: Record<string, number> = {
  triumph: 1.0,
  joy: 0.85,
  peace: 0.75,
  hope: 0.6,
  'turning point': 0.4,
  calm: 0.3,
  neutral: 0.2,
  struggle: -0.3,
  tension: -0.5,
  conflict: -0.65,
  dread: -0.8,
  despair: -1.0,
};

export default function ArcSparkline({
  labels,
  width = 200,
  height = 60,
  showLabels = false,
  className = '',
}: ArcSparklineProps) {
  if (!labels || labels.length === 0) return null;

  const padding = { top: 8, bottom: showLabels ? 20 : 8, left: 8, right: 8 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const points = labels.map((label, i) => {
    const x = padding.left + (i / (labels.length - 1)) * chartW;
    const val = LABEL_VALUES[label] ?? 0;
    const y = padding.top + ((1 - (val + 1) / 2) * chartH);
    return { x, y, label, color: LABEL_COLORS[label] ?? '#64748b' };
  });

  // Build smooth path
  const pathD = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ');

  // Gradient fill area
  const areaD =
    pathD +
    ` L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={`arc-grad-${labels.join('')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Fill area */}
      <path
        d={areaD}
        fill={`url(#arc-grad-${labels.join('')})`}
      />

      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: 'drop-shadow(0 0 3px var(--accent))' }}
      />

      {/* Dots */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={3}
          fill={p.color}
          stroke="var(--bg)"
          strokeWidth="1.5"
        />
      ))}

      {/* Labels */}
      {showLabels &&
        points
          .filter((_, i) => i === 0 || i === Math.floor(labels.length / 2) || i === labels.length - 1)
          .map((p, i) => (
            <text
              key={i}
              x={p.x}
              y={height - 2}
              fontSize="8"
              fill="var(--text-muted)"
              textAnchor="middle"
              fontFamily="Inter, sans-serif"
            >
              {p.label}
            </text>
          ))}
    </svg>
  );
}
