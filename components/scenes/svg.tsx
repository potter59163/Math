import * as m from 'motion/react-m';
import { createContext, useContext, type ReactNode } from 'react';
import type { Rational } from '@/lib/core/rational';
import type { Matrix } from '@/lib/core/types';
import { signed } from '@/lib/topics/matrix/format';

// Shared drawing pieces for the SVG templates. A number looks as it does in MatrixView: same face,
// tabular digits, typographic minus and stacked fractions. MatrixView itself is HTML, and motion's
// transforms on SVG need the numbers inside the SVG.

/** Width of the drawing at 360px, so one unit is one CSS pixel on a phone. */
export const STAGE_WIDTH = 328;

export interface BeatClock {
  ms: number;
  /** prefers-reduced-motion: every beat is a still frame (SCENES §2). */
  still: boolean;
}

export const BeatClockContext = createContext<BeatClock>({ ms: 2000, still: false });

/** A timing within the current beat, as fractions of its declared length. */
export function useTween() {
  const { ms, still } = useContext(BeatClockContext);
  return (start = 0, length = 0.4) =>
    still
      ? { duration: 0 }
      : { duration: (ms * length) / 1000, delay: (ms * start) / 1000, ease: 'easeInOut' as const };
}

interface FadeProps {
  show: boolean;
  to?: number;
  start?: number;
  length?: number;
  children: ReactNode;
}

/** Only opacity changes, so nothing can shift. */
export function Fade({ show, to = 1, start, length, children }: FadeProps) {
  const tween = useTween();
  return (
    <m.g initial={false} animate={{ opacity: show ? to : 0 }} transition={tween(start, length)}>
      {children}
    </m.g>
  );
}

interface PlaceProps {
  x: number;
  y: number;
  opacity?: number;
  start?: number;
  length?: number;
  children: ReactNode;
}

/** Moves its children with a transform, and fades them if asked. */
export function Place({ x, y, opacity = 1, start, length, children }: PlaceProps) {
  const tween = useTween();
  return (
    <m.g initial={false} animate={{ x, y, opacity }} transition={tween(start, length)}>
      {children}
    </m.g>
  );
}

const NUMBER = 'font-matrix tabular-nums';

/** Close enough for layout: Inter's tabular digits are about 0.62em, and a stacked fraction shrinks. */
export function numberWidth(value: Rational, size: number): number {
  if (value.isInteger()) return signed(value.n).length * size * 0.62;
  const longest = Math.max(String(Math.abs(value.n)).length, String(value.d).length);
  return longest * size * 0.52 + (value.sign() < 0 ? size * 0.7 : 0) + size * 0.3;
}

interface SvgNumberProps {
  value: Rational;
  x?: number;
  y?: number;
  size?: number;
  className?: string;
}

export function SvgNumber({
  value,
  x = 0,
  y = 0,
  size = 16,
  className = 'fill-ink',
}: SvgNumberProps) {
  if (value.isInteger()) {
    return (
      <SvgText x={x} y={y} size={size} className={`${NUMBER} ${className}`}>
        {signed(value.n)}
      </SvgText>
    );
  }
  const small = size * 0.8;
  const barWidth =
    Math.max(String(Math.abs(value.n)).length, String(value.d).length) * small * 0.62;
  const shift = value.sign() < 0 ? small * 0.45 : 0;
  return (
    <g className={className}>
      {value.sign() < 0 && (
        <SvgText x={x - barWidth / 2 - shift * 0.7} y={y} size={size} className={NUMBER}>
          −
        </SvgText>
      )}
      <SvgText x={x + shift} y={y - small * 0.62} size={small} className={NUMBER}>
        {Math.abs(value.n)}
      </SvgText>
      <line
        x1={x + shift - barWidth / 2 - 1}
        x2={x + shift + barWidth / 2 + 1}
        y1={y}
        y2={y}
        strokeWidth={1.2}
        className="stroke-current"
      />
      <SvgText x={x + shift} y={y + small * 0.62} size={small} className={NUMBER}>
        {value.d}
      </SvgText>
    </g>
  );
}

interface SvgTextProps {
  x?: number;
  y?: number;
  size?: number;
  anchor?: 'start' | 'middle' | 'end';
  className?: string;
  children: ReactNode;
}

/** Centered on y: `dy` works alike in every browser, unlike dominant-baseline. */
export function SvgText({
  x = 0,
  y = 0,
  size = 16,
  anchor = 'middle',
  className = 'fill-ink',
  children,
}: SvgTextProps) {
  return (
    <text x={x} y={y} dy="0.35em" fontSize={size} textAnchor={anchor} className={className}>
      {children}
    </text>
  );
}

export interface MatrixBox {
  width: number;
  height: number;
  /** Center of column j, row i, relative to the box. Both 0-based. */
  cellX(j: number): number;
  cellY(i: number): number;
  colWidth: number;
  rowHeight: number;
}

const BRACKET_PAD = 10;

export function matrixBox(value: Matrix, size = 16, minColumn = 24): MatrixBox {
  const cells = value.flat();
  // The same 6px between columns as MatrixView.
  const colWidth = Math.max(minColumn, ...cells.map((cell) => numberWidth(cell, size) + 6));
  const rowHeight = size * (cells.some((cell) => !cell.isInteger()) ? 2.5 : 1.75);
  return {
    width: value[0].length * colWidth + BRACKET_PAD * 2,
    height: value.length * rowHeight + 8,
    cellX: (j) => BRACKET_PAD + colWidth * (j + 0.5),
    cellY: (i) => 4 + rowHeight * (i + 0.5),
    colWidth,
    rowHeight,
  };
}

/** The square brackets of MatrixView. */
export function SvgBracket({ width, height }: { width: number; height: number }) {
  const lip = 7;
  return (
    <g className="fill-none stroke-ink" strokeWidth={2} strokeLinejoin="round">
      <path d={`M${lip} 1H1V${height - 1}H${lip}`} />
      <path d={`M${width - lip} 1H${width - 1}V${height - 1}H${width - lip}`} />
    </g>
  );
}

interface SvgMatrixProps {
  value: Matrix;
  box?: MatrixBox;
  size?: number;
  x?: number;
  y?: number;
  /** Faint for what the beat is not about (Signaling, SCENES §1). */
  cellOpacity?(i: number, j: number): number;
  label?: string;
}

export function SvgMatrix({
  value,
  box = matrixBox(value),
  size = 16,
  x = 0,
  y = 0,
  cellOpacity,
  label,
}: SvgMatrixProps) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {label && (
        <SvgText x={box.width / 2} y={-11} size={13} className="fill-muted font-sans font-medium">
          {label}
        </SvgText>
      )}
      <SvgBracket width={box.width} height={box.height} />
      {value.map((row, i) =>
        row.map((cell, j) => (
          <Fade key={`${i}:${j}`} show to={cellOpacity?.(i, j) ?? 1}>
            <SvgNumber value={cell} x={box.cellX(j)} y={box.cellY(i)} size={size} />
          </Fade>
        )),
      )}
    </g>
  );
}

/** A number in copy-style text: brackets a negative factor, as on paper. */
export function factorText(value: Rational): string {
  const text = value.toString().replace('-', '−');
  return value.sign() < 0 ? `(${text})` : text;
}

/** Tints a stretch of the drawing behind its numbers; the fade is all that animates. */
export function Highlight({
  x,
  y,
  width,
  height,
  show,
  tone = 'brand',
  start,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  show: boolean;
  tone?: 'brand' | 'good' | 'warn';
  start?: number;
}) {
  const fill = { brand: 'fill-brand-soft', good: 'fill-good-soft', warn: 'fill-warn-soft' }[tone];
  return (
    <Fade show={show} start={start}>
      <rect x={x} y={y} width={width} height={height} rx={6} className={fill} />
    </Fade>
  );
}
