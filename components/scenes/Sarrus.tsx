import * as m from 'motion/react-m';
import { useContext, type ReactNode } from 'react';
import { th } from '@/lib/content/th';
import { factorText, rationalText } from '@/lib/topics/matrix/format';
import type { SarrusBeat, SceneSpecOf } from '@/lib/topics/matrix/scenes/types';
import { BeatClockContext, Fade, Place, STAGE_WIDTH, SvgBracket, SvgNumber, SvgText } from './svg';

const ORDER: SarrusBeat[] = ['copy', 'compare', 'down', 'up', 'result'];

const TOP = 40;

interface Props {
  spec: SceneSpecOf<'sarrus'>;
  beat: SarrusBeat;
}

interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Draws attention to the lines the student left out. A still frame stays on. */
function Blink({ show, children }: { show: boolean; children: ReactNode }) {
  const { ms, still } = useContext(BeatClockContext);
  if (still || !show) return <Fade show={show}>{children}</Fade>;
  return (
    <m.g
      animate={{ opacity: [1, 0.2, 1, 0.2, 1] }}
      transition={{ duration: (ms * 0.8) / 1000, ease: 'linear' }}
    >
      {children}
    </m.g>
  );
}

function Line({
  segment,
  className,
  dashed,
}: {
  segment: Segment;
  className: string;
  dashed?: boolean;
}) {
  return (
    <line
      {...segment}
      strokeWidth={2}
      strokeOpacity={0.75}
      strokeLinecap="round"
      strokeDasharray={dashed ? '3 6' : undefined}
      className={className}
    />
  );
}

/** SCENES §4. Numbers sit on top of the lines, with a halo so a line never crosses a digit. */
export function Sarrus({ spec, beat }: Props) {
  const { A, size, down, up, downSum, upSum, det, wrong } = spec.params;
  const reached = (step: SarrusBeat) => ORDER.indexOf(beat) >= ORDER.indexOf(step);
  const comparing = beat === 'compare';
  const isBig = size === 3;
  const variant = wrong?.variant;

  const cellWidth = isBig ? 44 : 64;
  const cellHeight = isBig ? 38 : 50;
  const columns = isBig ? 5 : 2;
  const gridWidth = columns * cellWidth;
  const left = (STAGE_WIDTH - gridWidth) / 2;
  const cx = (col: number) => left + cellWidth * (col + 0.5);
  const cy = (row: number) => TOP + cellHeight * (row + 0.5);
  const reachX = cellWidth * 0.42;
  const reachY = cellHeight * 0.42;

  const last = size - 1;
  const downLine = (k: number): Segment => ({
    x1: cx(k) - reachX,
    y1: cy(0) - reachY,
    x2: cx(k + last) + reachX,
    y2: cy(last) + reachY,
  });
  const upLine = (k: number): Segment => ({
    x1: cx(k) - reachX,
    y1: cy(last) + reachY,
    x2: cx(k + last) + reachX,
    y2: cy(0) - reachY,
  });

  const yBelow = cy(last) + reachY + 14;
  const yAbove = cy(0) - reachY - 14;
  const yLines = yBelow + 30;
  const height = yLines + 62;

  const [[a, b], [c, d]] = A;
  const downText = isBig
    ? `${th.scenes.sarrus.downLabel}: ${down.map(factorText).join(' + ')} = ${rationalText(downSum)}`
    : `ad = ${factorText(a)}·${factorText(d)} = ${rationalText(downSum)}`;
  const upText = isBig
    ? `${th.scenes.sarrus.upLabel}: ${up.map(factorText).join(' + ')} = ${rationalText(upSum)}`
    : `bc = ${factorText(b)}·${factorText(c)} = ${rationalText(upSum)}`;
  const detText = `det = ${factorText(downSum)} − ${factorText(upSum)} = ${rationalText(det)}`;

  const halo = 'stroke-canvas [paint-order:stroke] [stroke-width:4px]';
  const number = `fill-ink ${halo}`;

  const expressionSize = wrong
    ? Math.min(15, (STAGE_WIDTH - 16) / (wrong.expression.length * 0.56))
    : 15;
  const expressionWidth = wrong ? wrong.expression.length * expressionSize * 0.56 : 0;

  // What the wrong formula looked at, shown before the right lines take over.
  const rowsAcross = A.map((_, row) => ({
    x1: cx(0) - reachX,
    y1: cy(row),
    x2: cx(last) + reachX,
    y2: cy(row),
  }));
  const columnsDown = A.map((_, col) => ({
    x1: cx(col),
    y1: cy(0) - reachY,
    x2: cx(col),
    y2: cy(last) + reachY,
  }));

  return (
    <svg viewBox={`0 0 ${STAGE_WIDTH} ${height}`} className="h-full w-full" aria-hidden="true">
      {/* The lines of the wrong formula. */}
      {(variant === 'ADD' || variant === 'REVERSE') && (
        <Fade show={comparing}>
          <Line segment={downLine(0)} className="stroke-warn" />
          <Line segment={upLine(0)} className="stroke-warn" />
        </Fade>
      )}
      {variant === 'PAIRS_ROW' && (
        <Fade show={comparing}>
          {rowsAcross.map((segment, index) => (
            <Line key={index} segment={segment} className="stroke-warn" />
          ))}
        </Fade>
      )}
      {variant === 'PAIRS_COL' && (
        <Fade show={comparing}>
          {columnsDown.map((segment, index) => (
            <Line key={index} segment={segment} className="stroke-warn" />
          ))}
        </Fade>
      )}
      {variant === 'ALL_PLUS' && (
        <>
          <Fade show={comparing}>
            {down.map((_, k) => (
              <Line key={k} segment={downLine(k)} className="stroke-good" />
            ))}
          </Fade>
          <Blink show={comparing}>
            {up.map((_, k) => (
              <Line key={k} segment={upLine(k)} className="stroke-warn" />
            ))}
          </Blink>
        </>
      )}
      {variant === 'TWO_DIAG' && (
        <Fade show={comparing}>
          <Line segment={downLine(0)} className="stroke-good" />
          <Line segment={upLine(0)} className="stroke-warn" />
          {[1, 2].map((k) => (
            <g key={k}>
              <Line segment={downLine(k)} className="stroke-edge" dashed />
              <Line segment={upLine(k)} className="stroke-edge" dashed />
            </g>
          ))}
        </Fade>
      )}
      {variant === 'NO_ALT_SIGN' && (
        <Fade show={comparing}>
          {['+', '−', '+'].map((sign, col) => (
            <SvgText
              key={col}
              x={cx(col)}
              y={yAbove}
              size={22}
              className={`font-matrix font-semibold ${col === 1 ? 'fill-warn' : 'fill-muted'}`}
            >
              {sign}
            </SvgText>
          ))}
        </Fade>
      )}

      {/* The right lines, with the product at the end of each. */}
      {down.map((product, k) => (
        <g key={k}>
          <Fade show={reached('down')} start={0.05 + 0.25 * k} length={0.2}>
            <Line segment={downLine(k)} className="stroke-good" />
          </Fade>
          <Fade show={reached('down')} start={0.12 + 0.25 * k} length={0.2}>
            <SvgNumber
              value={product}
              x={cx(k + last) + reachX}
              y={yBelow}
              size={15}
              className="fill-good font-semibold"
            />
          </Fade>
        </g>
      ))}
      {up.map((product, k) => (
        <g key={k}>
          <Fade show={reached('up')} start={0.05 + 0.25 * k} length={0.2}>
            <Line segment={upLine(k)} className="stroke-warn" />
          </Fade>
          <Fade show={reached('up')} start={0.12 + 0.25 * k} length={0.2}>
            <SvgNumber
              value={product}
              x={cx(k + last) + reachX}
              y={yAbove}
              size={15}
              className="fill-warn font-semibold"
            />
          </Fade>
        </g>
      ))}

      <g transform={`translate(${left - 2} ${TOP - 2})`}>
        <SvgBracket width={size * cellWidth + 4} height={size * cellHeight + 4} />
      </g>

      {A.map((cells, row) =>
        cells.map((cell, col) => (
          <SvgNumber
            key={`${row}:${col}`}
            value={cell}
            x={cx(col)}
            y={cy(row)}
            className={number}
          />
        )),
      )}

      {/* The first two columns copied to the right of a 3×3. */}
      {isBig &&
        A.map((cells, row) =>
          cells.slice(0, 2).map((cell, col) => (
            <Place
              key={`${row}:${col}`}
              x={reached('copy') ? cx(col + 3) : cx(col)}
              y={cy(row)}
              opacity={reached('copy') ? 1 : 0}
              start={0.05 + 0.1 * col}
              length={0.45}
            >
              <SvgNumber value={cell} className={`fill-muted ${halo}`} />
            </Place>
          )),
        )}

      {wrong && (
        <Fade show={comparing}>
          <SvgText
            x={STAGE_WIDTH / 2}
            y={yLines + 14}
            size={expressionSize}
            className="fill-warn font-matrix tabular-nums"
          >
            {wrong.expression}
          </SvgText>
          <line
            x1={STAGE_WIDTH / 2 - expressionWidth / 2}
            x2={STAGE_WIDTH / 2 + expressionWidth / 2}
            y1={yLines + 14}
            y2={yLines + 14}
            strokeWidth={1}
            className="stroke-warn"
          />
        </Fade>
      )}

      <Fade show={reached('down')} start={0.75} length={0.2}>
        <SvgText
          x={STAGE_WIDTH / 2}
          y={yLines}
          size={14}
          className="fill-good font-matrix tabular-nums"
        >
          {downText}
        </SvgText>
      </Fade>
      <Fade show={reached('up')} start={0.75} length={0.2}>
        <SvgText
          x={STAGE_WIDTH / 2}
          y={yLines + 22}
          size={14}
          className="fill-warn font-matrix tabular-nums"
        >
          {upText}
        </SvgText>
      </Fade>
      <Fade show={reached('result')} start={0.1}>
        <SvgText
          x={STAGE_WIDTH / 2}
          y={yLines + 50}
          size={18}
          className="fill-ink font-matrix font-semibold tabular-nums"
        >
          {detText}
        </SvgText>
      </Fade>
    </svg>
  );
}
