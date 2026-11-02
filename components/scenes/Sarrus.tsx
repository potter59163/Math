import * as m from 'motion/react-m';
import { useContext, type ReactNode } from 'react';
import {
  Choices,
  HandText,
  Reveal,
  Stage,
  Struck,
  Verdict,
  WIDTH,
  fitted,
  useReveal,
} from '@/components/clip/kit';
import { th } from '@/lib/content/th';
import { factorText, rationalText } from '@/lib/topics/matrix/format';
import type { SarrusBeat, SceneSpecOf } from '@/lib/topics/matrix/scenes/types';
import { BeatClockContext, Place, SvgBracket, SvgNumber } from './svg';

const ORDER: SarrusBeat[] = ['copy', 'compare', 'down', 'try', 'up', 'result'];

const TOP = 34;

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
  if (still || !show) return <Reveal show={show}>{children}</Reveal>;
  return (
    <m.g
      animate={{ opacity: [1, 0.2, 1, 0.2, 1] }}
      transition={{ duration: (ms * 0.8) / 1000, ease: 'linear' }}
    >
      {children}
    </m.g>
  );
}

/** A line drawn from one end to the other, as a pen would. */
function Line({
  segment,
  className,
  show,
  start,
  dashed,
}: {
  segment: Segment;
  className: string;
  show: boolean;
  start?: number;
  dashed?: boolean;
}) {
  const reveal = useReveal();
  const path = `M${segment.x1} ${segment.y1} L${segment.x2} ${segment.y2}`;
  return (
    <m.path
      d={path}
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: show ? 1 : 0, opacity: show ? 0.85 : 0 }}
      transition={reveal(show, start, 0.2)}
      fill="none"
      strokeWidth={3}
      strokeLinecap="round"
      strokeDasharray={dashed ? '3 7' : undefined}
      className={className}
    />
  );
}

const DOWN = 'stroke-cta';
const UP = 'stroke-brand';
const WRONG = 'stroke-warn';

/** SCENES §4. Numbers sit on top of the lines, with a halo so a line never crosses a digit. */
export function Sarrus({ spec, beat }: Props) {
  const { A, size, down, up, downSum, upSum, det, wrong, try: question } = spec.params;
  const reached = (step: SarrusBeat) => ORDER.indexOf(beat) >= ORDER.indexOf(step);
  const comparing = beat === 'compare';
  const isBig = size === 3;
  const variant = wrong?.variant;
  const copy = th.scenes.sarrus;

  const cellWidth = isBig ? 54 : 84;
  const cellHeight = isBig ? 44 : 66;
  const columns = isBig ? 5 : 2;
  const gridWidth = columns * cellWidth;
  const left = (WIDTH - gridWidth) / 2;
  const cx = (col: number) => left + cellWidth * (col + 0.5);
  const cy = (row: number) => TOP + cellHeight * (row + 0.5);
  const reachX = cellWidth * 0.42;
  const reachY = cellHeight * 0.42;
  const font = isBig ? 22 : 34;

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

  const gridBottom = TOP + size * cellHeight;
  const low = gridBottom + 34;

  const [[a, b], [c, d]] = A;
  const downText = isBig
    ? `${copy.downLabel}: ${down.map(factorText).join(' + ')} = ${rationalText(downSum)}`
    : `ad = ${factorText(a)}·${factorText(d)} = ${rationalText(downSum)}`;
  const upText = isBig
    ? `${copy.upLabel}: ${up.map(factorText).join(' + ')} = ${rationalText(upSum)}`
    : `bc = ${factorText(b)}·${factorText(c)} = ${rationalText(upSum)}`;
  const detText = `det = ${factorText(downSum)} − ${factorText(upSum)} = ${rationalText(det)}`;

  const halo = 'stroke-canvas [paint-order:stroke] [stroke-width:5px]';
  const number = `fill-ink ${halo}`;

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
    <Stage>
      {/* ---- the lines of the wrong formula */}
      {(variant === 'ADD' || variant === 'REVERSE') && (
        <>
          <Line segment={downLine(0)} className={WRONG} show={comparing} />
          <Line segment={upLine(0)} className={WRONG} show={comparing} start={0.2} />
        </>
      )}
      {variant === 'PAIRS_ROW' &&
        rowsAcross.map((segment, index) => (
          <Line
            key={index}
            segment={segment}
            className={WRONG}
            show={comparing}
            start={0.2 * index}
          />
        ))}
      {variant === 'PAIRS_COL' &&
        columnsDown.map((segment, index) => (
          <Line
            key={index}
            segment={segment}
            className={WRONG}
            show={comparing}
            start={0.2 * index}
          />
        ))}
      {variant === 'ALL_PLUS' && (
        <>
          {down.map((_, k) => (
            <Line key={k} segment={downLine(k)} className={DOWN} show={comparing} />
          ))}
          <Blink show={comparing}>
            {up.map((_, k) => (
              <path
                key={k}
                d={`M${upLine(k).x1} ${upLine(k).y1} L${upLine(k).x2} ${upLine(k).y2}`}
                strokeWidth={3}
                strokeLinecap="round"
                className={WRONG}
              />
            ))}
          </Blink>
        </>
      )}
      {variant === 'TWO_DIAG' && (
        <>
          <Line segment={downLine(0)} className={DOWN} show={comparing} />
          <Line segment={upLine(0)} className={WRONG} show={comparing} />
          {[1, 2].map((k) => (
            <g key={k}>
              <Line segment={downLine(k)} className="stroke-edge" show={comparing} dashed />
              <Line segment={upLine(k)} className="stroke-edge" show={comparing} dashed />
            </g>
          ))}
        </>
      )}
      {variant === 'NO_ALT_SIGN' && (
        <Reveal show={comparing}>
          {['+', '−', '+'].map((sign, col) => (
            <HandText
              key={col}
              x={cx(col)}
              y={TOP - 14}
              size={22}
              className={`font-semibold ${col === 1 ? 'fill-warn' : 'fill-muted'}`}
            >
              {sign}
            </HandText>
          ))}
        </Reveal>
      )}

      {/* ---- the right lines, with the product at the end of each */}
      {down.map((product, k) => (
        <g key={k}>
          <Line
            segment={downLine(k)}
            className={DOWN}
            show={reached('down')}
            start={0.05 + (0.25 * k) / Math.max(down.length, 1)}
          />
          <Reveal show={reached('down')} start={0.25 + (0.25 * k) / Math.max(down.length, 1)} pop>
            <SvgNumber
              value={product}
              x={cx(k + last) + reachX}
              y={gridBottom + 12}
              size={15}
              className="fill-cta font-semibold"
            />
          </Reveal>
        </g>
      ))}
      {up.map((product, k) => (
        <g key={k}>
          <Line
            segment={upLine(k)}
            className={UP}
            show={reached('up')}
            start={0.05 + (0.25 * k) / Math.max(up.length, 1)}
          />
          <Reveal show={reached('up')} start={0.25 + (0.25 * k) / Math.max(up.length, 1)} pop>
            <SvgNumber
              value={product}
              x={cx(k + last) + reachX}
              y={TOP - 12}
              size={15}
              className="fill-brand font-semibold"
            />
          </Reveal>
        </g>
      ))}
      {beat === 'try' && <Line segment={upLine(0)} className={UP} show dashed />}

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
            size={font}
            className={number}
          />
        )),
      )}

      {/* ---- the first two columns copied to the right of a 3×3 */}
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
              <SvgNumber value={cell} size={font} className={`fill-muted ${halo}`} />
            </Place>
          )),
        )}

      {/* ---- what they answered, and how they got it */}
      {wrong && (
        <>
          <Verdict
            mine={rationalText(wrong.value)}
            right={rationalText(det)}
            show={comparing}
            y={low + 6}
          />
          <Struck text={wrong.expression} y={low + 106} show={comparing} start={0.45} size={26} />
        </>
      )}

      {/* ---- their turn */}
      {question && beat === 'try' && (
        <Choices options={question.options} right={question.right} y={low + 40} />
      )}

      {/* ---- adding it all up */}
      <Reveal show={reached('down') && beat !== 'try'} start={beat === 'down' ? 0.7 : 0}>
        <HandText x={WIDTH / 2} y={low + 12} size={fitted(downText, 24)} className="fill-cta">
          {downText}
        </HandText>
      </Reveal>
      <Reveal show={reached('up')} start={beat === 'up' ? 0.7 : 0}>
        <HandText x={WIDTH / 2} y={low + 52} size={fitted(upText, 24)} className="fill-brand">
          {upText}
        </HandText>
      </Reveal>
      <Reveal show={reached('result')} start={0.1} pop>
        <HandText
          x={WIDTH / 2}
          y={low + 112}
          size={fitted(detText, 38)}
          className="fill-ink font-semibold"
        >
          {detText}
        </HandText>
      </Reveal>
    </Stage>
  );
}
