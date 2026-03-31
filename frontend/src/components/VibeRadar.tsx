'use client';

import React, { useEffect, useRef } from 'react';

// ── Dimension config ───────────────────────────────────────────────────────────

export const VIBE_DIMENSIONS = [
  { key: 'lighting',     label: 'Lighting',   color: '#60a5fa' },  // blue
  { key: 'pacing',       label: 'Pacing',     color: '#2dd4bf' },  // teal
  { key: 'setting_type', label: 'Setting',    color: '#a78bfa' },  // purple
  { key: 'temperature',  label: 'Temp',       color: '#fb923c' },  // coral
  { key: 'texture',      label: 'Texture',    color: '#fbbf24' },  // amber
  { key: 'era_feel',     label: 'Era',        color: '#4ade80' },  // green
] as const;

interface VibeRadarProps {
  /** 6-element array [lighting, pacing, setting_type, temperature, texture, era_feel] */
  vector: number[];
  /** Optional second polygon (e.g. query vector overlay) */
  compareVector?: number[];
  size?: number;
  showLabels?: boolean;
  animated?: boolean;
  className?: string;
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

function polarToXY(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function buildPolygonPoints(vector: number[], cx: number, cy: number, maxR: number): string {
  return vector
    .map((v, i) => {
      const angle = (i * 360) / vector.length;
      const r = Math.max(0, Math.min(1, v)) * maxR;
      const [x, y] = polarToXY(cx, cy, r, angle);
      return `${x},${y}`;
    })
    .join(' ');
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function VibeRadar({
  vector,
  compareVector,
  size = 160,
  showLabels = false,
  animated = true,
  className,
}: VibeRadarProps) {
  const polygonRef = useRef<SVGPolygonElement>(null);
  const comparePolygonRef = useRef<SVGPolygonElement>(null);

  const cx = size / 2;
  const cy = size / 2;
  const labelOffset = showLabels ? 22 : 0;
  const maxR = (size / 2) - (showLabels ? 28 : 10);
  const numAxes = 6;

  // Safe vector: clamp and pad if needed
  const safeVector = Array.from({ length: numAxes }, (_, i) =>
    typeof vector[i] === 'number' ? Math.max(0, Math.min(1, vector[i])) : 0.5
  );
  const mainPoints = buildPolygonPoints(safeVector, cx, cy, maxR);

  const safeCompare = compareVector
    ? Array.from({ length: numAxes }, (_, i) =>
        typeof compareVector[i] === 'number' ? Math.max(0, Math.min(1, compareVector[i])) : 0.5
      )
    : null;
  const comparePoints = safeCompare ? buildPolygonPoints(safeCompare, cx, cy, maxR) : '';

  // Animate polygon on mount / vector change
  useEffect(() => {
    if (!animated || !polygonRef.current) return;
    const el = polygonRef.current;
    el.style.transition = 'none';
    el.style.opacity = '0';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = 'opacity 0.5s ease, points 0.4s ease';
        el.style.opacity = '1';
      });
    });
  }, [vector, animated]);

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1.0];

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label="Atmosphere fingerprint radar chart"
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Main polygon gradient fill */}
        <radialGradient id={`vibeGrad-${size}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.15" />
        </radialGradient>
        {/* Compare polygon fill */}
        <radialGradient id={`vibeCompare-${size}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.08" />
        </radialGradient>
        <filter id={`vibeGlow-${size}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Grid rings */}
      {rings.map(r => {
        const ringPoints = Array.from({ length: numAxes }, (_, i) => {
          const angle = (i * 360) / numAxes;
          const [x, y] = polarToXY(cx, cy, r * maxR, angle);
          return `${x},${y}`;
        }).join(' ');
        return (
          <polygon
            key={r}
            points={ringPoints}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={r === 1.0 ? 1 : 0.5}
          />
        );
      })}

      {/* Axis lines + labels */}
      {VIBE_DIMENSIONS.map((dim, i) => {
        const angle = (i * 360) / numAxes;
        const [x2, y2] = polarToXY(cx, cy, maxR, angle);
        const [lx, ly] = showLabels ? polarToXY(cx, cy, maxR + labelOffset, angle) : [0, 0];
        // Dot at tip
        const [dx, dy] = polarToXY(cx, cy, safeVector[i] * maxR, angle);

        return (
          <g key={dim.key}>
            <line
              x1={cx} y1={cy} x2={x2} y2={y2}
              stroke={dim.color}
              strokeWidth={0.8}
              strokeOpacity={0.35}
            />
            {/* Tip dot */}
            <circle
              cx={dx} cy={dy} r={showLabels ? 3 : 2}
              fill={dim.color}
              opacity={0.9}
              filter={`url(#vibeGlow-${size})`}
            />
            {showLabels && (
              <text
                x={lx} y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={size > 200 ? 11 : 9}
                fontFamily="Inter, sans-serif"
                fontWeight={600}
                fill={dim.color}
                opacity={0.85}
              >
                {dim.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Compare polygon (query) */}
      {safeCompare && (
        <polygon
          ref={comparePolygonRef}
          points={comparePoints}
          fill={`url(#vibeCompare-${size})`}
          stroke="#f59e0b"
          strokeWidth={1}
          strokeDasharray="3 3"
          strokeOpacity={0.6}
          fillOpacity={0.2}
        />
      )}

      {/* Main polygon */}
      <polygon
        ref={polygonRef}
        points={mainPoints}
        fill={`url(#vibeGrad-${size})`}
        stroke="url(#vibeGrad-main)"
        strokeWidth={showLabels ? 1.5 : 1}
        strokeOpacity={0.8}
        fillOpacity={0.45}
        filter={`url(#vibeGlow-${size})`}
        style={{ transition: animated ? 'all 0.4s ease' : 'none' }}
      />

      {/* Centre dot */}
      <circle cx={cx} cy={cy} r={2} fill="rgba(255,255,255,0.3)" />
    </svg>
  );
}
