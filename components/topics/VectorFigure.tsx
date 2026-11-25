import type { Figure, PointLabel } from '@/lib/topics/vector/types';

// The figure of a geometry item, drawn from the engine's hidden coordinates: the outline in ink, and
// every point, midpoints too, as a labelled dot. Fits 360px with room to spare.

const MAX_WIDTH = 240;
const MAX_HEIGHT = 150;
const PAD = 24;
const LABEL_OFFSET = 14;

export function VectorFigure({ figure }: { figure: Figure }) {
  const xs = figure.points.map(({ at }) => at[0]);
  const ys = figure.points.map(({ at }) => at[1]);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const scale = Math.min(
    MAX_WIDTH / Math.max(maxX - minX, 1),
    MAX_HEIGHT / Math.max(maxY - minY, 1),
  );
  const width = (maxX - minX) * scale + 2 * PAD;
  const height = (maxY - minY) * scale + 2 * PAD;

  // y grows upwards on paper and downwards in SVG.
  const place = new Map<PointLabel, [number, number]>(
    figure.points.map(({ label, at: [x, y] }) => [
      label,
      [PAD + (x - minX) * scale, PAD + (maxY - y) * scale],
    ]),
  );
  const centre = [...place.values()].reduce(
    ([sx, sy], [x, y]) => [sx + x / place.size, sy + y / place.size],
    [0, 0],
  );
  const outline = figure.outline.map((label) => place.get(label)!.join(',')).join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={figure.outline.join('')}
      className="mx-auto max-w-full text-ink"
    >
      <polygon
        points={outline}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {[...place.entries()].map(([label, [x, y]]) => {
        const dx = x - centre[0];
        const dy = y - centre[1];
        const length = Math.hypot(dx, dy) || 1;
        return (
          <g key={label}>
            <circle cx={x} cy={y} r={3.5} className="fill-brand" />
            <text
              x={x + (dx / length) * LABEL_OFFSET}
              y={y + (dy / length) * LABEL_OFFSET}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-current font-hand text-base font-semibold"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
