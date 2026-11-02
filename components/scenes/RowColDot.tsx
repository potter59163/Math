import * as m from 'motion/react-m';
import { useContext, useState } from 'react';
import {
  Band,
  BigWords,
  BoardMatrix,
  BRACKET,
  Chip,
  Choices,
  ClipActionsContext,
  Fly,
  HAND,
  HEIGHT,
  HandText,
  Paper,
  Reveal,
  Ring,
  Stage,
  Struck,
  TapArea,
  Verdict,
  WIDTH,
  WrongFlash,
  boxAt,
  cellRect,
  colRect,
  fitted,
  rowRect,
  useReveal,
  type Rect,
} from '@/components/clip/kit';
import { th } from '@/lib/content/th';
import type { Rational } from '@/lib/core/rational';
import { fillTokens } from '@/lib/core/tokens';
import { factorText, rationalText } from '@/lib/topics/matrix/format';
import type { RowColBeat, SceneSpecOf } from '@/lib/topics/matrix/scenes/types';
import { SvgText } from './svg';

// One board for the whole clip: left × right = the answer. Below it a sheet of the notebook slides in, and
// the numbers fly down from the row and the column, so a student can see where each one came from. When
// they can be counted, the sheet is a bill: a row is how many, and a column is how much.

const ORDER: RowColBeat[] = [
  'compare',
  'setup',
  'pick_row',
  'pick_col',
  'pair',
  'only_first',
  'multiply',
  'sum',
  'place',
  'try_row',
  'try_col',
  'try_done',
  'fill_rest',
  'end',
];

const TOP = 30;
const OPERATOR = 16;
const MAX_CELL = 44;
const MATRICES_HEIGHT = 116;
/** Below this a row is too thin to tap, so the question comes as cards instead. */
const MIN_TAP_CELL = 38;
/** Tap areas reach past the matrix on its outer sides, for phones so short that the drawing shrinks. */
const OUTSET = 12;

const ITEM_X = 34;
const QTY_X = 164;
const TIMES_X = 196;
const PRICE_X = 226;
const EQUALS_X = 258;
const AMOUNT_X = 292;

interface Props {
  spec: SceneSpecOf<'row_col_dot'>;
  beat: RowColBeat;
}

/** One cell of the student's answer. Once marked, their number moves up small and struck through. */
function AnswerCell({
  x,
  y,
  mine,
  right,
  font,
  marked,
  start,
}: {
  x: number;
  y: number;
  mine: Rational;
  right: Rational;
  font: number;
  marked: boolean;
  start?: number;
}) {
  const reveal = useReveal();
  const wrong = !mine.equals(right);
  const moved = marked && wrong;
  const transition = reveal(marked, start, 0.14);
  return (
    <>
      <m.g
        initial={false}
        animate={moved ? { x: x + 15, y: y - 14, scale: 0.58 } : { x, y, scale: 1 }}
        transition={transition}
      >
        <HandText x={0} y={0} size={font} className="fill-brand">
          {rationalText(mine)}
        </HandText>
        <m.line
          initial={false}
          animate={{ opacity: moved ? 1 : 0 }}
          transition={transition}
          x1={-font * 0.7}
          x2={font * 0.7}
          y1={2}
          y2={-2}
          strokeWidth={2.5}
          strokeLinecap="round"
          className="stroke-warn"
        />
      </m.g>
      {wrong && (
        <m.g
          initial={false}
          animate={{ opacity: marked ? 1 : 0, scale: marked ? 1 : 1.5, x: x - 3, y: y + 4 }}
          transition={transition}
        >
          <HandText x={0} y={0} size={font} className="fill-cta">
            {rationalText(right)}
          </HandText>
        </m.g>
      )}
    </>
  );
}

/** SCENES §3.1. Every number is already in the spec, so this only decides where each one sits. */
export function RowColDot({ spec, beat }: Props) {
  const { left, right, product, names, cell: focus, terms, wrong, student, story } = spec.params;
  const { tryCell, tryTerms } = spec.params;
  const copy = th.clip.receipt;
  const plain = th.scenes.rowCol;
  const actions = useContext(ClipActionsContext);
  const [flash, setFlash] = useState<{ box: Rect; n: number } | null>(null);

  const at = ORDER.indexOf(beat);
  const reached = (name: RowColBeat) => at >= ORDER.indexOf(name);
  const during = (from: RowColBeat, until: RowColBeat) => reached(from) && !reached(until);

  const columns = left[0].length + right[0].length + product[0].length;
  const tallest = Math.max(left.length, right.length, product.length);
  const cell = Math.min(
    MAX_CELL,
    (WIDTH - 4 - 6 * BRACKET - 2 * OPERATOR) / columns,
    MATRICES_HEIGHT / tallest,
  );
  const total = columns * cell + 6 * BRACKET + 2 * OPERATOR;
  const a = boxAt((WIDTH - total) / 2, TOP, left.length, left[0].length, cell);
  const b = boxAt(a.x + a.width + OPERATOR, TOP, right.length, right[0].length, cell);
  const p = boxAt(b.x + b.width + OPERATOR, TOP, product.length, product[0].length, cell);
  const font = cell * 0.56;

  const [row, col] = [focus[0] - 1, focus[1] - 1];
  const [tryRow, tryCol] = tryCell ? [tryCell[0] - 1, tryCell[1] - 1] : [-1, -1];

  const wrongLeft = new Set(wrong?.leftCells.map(([i, j]) => `${i - 1}:${j - 1}`));
  const wrongRight = new Set(wrong?.rightCells.map(([i, j]) => `${i - 1}:${j - 1}`));
  const leftOpacity = (i: number, j: number) => {
    if (beat === 'compare') return wrongLeft.has(`${i}:${j}`) ? 1 : 0.3;
    if (during('pick_row', 'try_row')) return i === row ? 1 : 0.3;
    if (during('try_col', 'fill_rest')) return i === tryRow ? 1 : 0.3;
    return 1;
  };
  const rightOpacity = (i: number, j: number) => {
    if (beat === 'compare') return wrongRight.has(`${i}:${j}`) ? 1 : 0.3;
    if (during('pick_col', 'try_row')) return j === col ? 1 : 0.3;
    if (beat === 'try_done') return j === tryCol ? 1 : 0.3;
    return 1;
  };

  const low = TOP + tallest * cell + 18;
  const lineHeight = Math.max(
    30,
    Math.min(52, (HEIGHT - low - 8 - 66 - 56) / Math.max(terms.length, 1)),
  );
  const chip = Math.min(34, lineHeight - 4);
  const lineY = (k: number) => low + 82 + k * lineHeight;
  const ruleY = lineY(terms.length - 1) + 24;
  const totalY = ruleY + 26;
  const paperHeight = totalY + 26 - low;
  const value = product[row][col];
  const billing = beat !== 'setup' && spec.beats.includes('only_first');

  const rowHit = (i: number): Rect => ({
    x: a.x,
    y: a.cy(i) - cell / 2 - (i === 0 ? OUTSET : 0),
    width: a.width,
    height: cell + (i === 0 || i === left.length - 1 ? OUTSET : 0),
  });
  const colHit = (j: number): Rect => ({
    x: b.cx(j) - cell / 2 - (j === 0 ? BRACKET : 0),
    y: TOP - OUTSET,
    width: cell + (j === 0 || j === right[0].length - 1 ? BRACKET : 0),
    height: b.height + 2 * OUTSET,
  });

  const tap = (kind: 'row' | 'col', index: number) => {
    if (index === (kind === 'row' ? tryRow : tryCol)) {
      setFlash(null);
      actions.right();
      return;
    }
    setFlash((last) => ({
      box: kind === 'row' ? rowRect(a, index) : colRect(b, index),
      n: (last?.n ?? 0) + 1,
    }));
    actions.wrong();
  };

  const asked = (template: string, known: boolean, index: number, name: string) =>
    fillTokens(template, { n: known ? String(index + 1) : '?', name });

  const wrongText =
    wrong &&
    `${wrong.terms.map((pair) => `${factorText(pair.a)}×${factorText(pair.b)}`).join(' + ')} = ${rationalText(wrong.value)}`;
  const mine = student?.[row]?.[col] ?? wrong?.value;
  const workedTerms = (tryTerms ?? []).map(
    (pair) => `${factorText(pair.a)} × ${factorText(pair.b)}`,
  );
  const workedLine = workedTerms.join(' + ');
  const productsLine = `= ${(tryTerms ?? []).map((pair) => rationalText(pair.product)).join(' + ')}`;
  const tryValue = tryCell && product[tryRow][tryCol];
  const rule = beat === 'end' || beat === 'fill_rest';

  return (
    <Stage>
      {/* ---- left × right = the answer */}
      <Band box={rowRect(a, row)} tone="row" show={during('pick_row', 'try_row')} start={0.2} />
      <Band box={colRect(b, col)} tone="col" show={during('pick_col', 'try_row')} start={0.1} />
      {tryCell && (
        <>
          <Band box={rowRect(a, tryRow)} tone="row" show={during('try_col', 'fill_rest')} />
          <Band box={colRect(b, tryCol)} tone="col" show={beat === 'try_done'} />
        </>
      )}
      {wrong?.leftCells.map(([i, j]) => (
        <Band
          key={`l${i}:${j}`}
          box={cellRect(a, i - 1, j - 1)}
          tone="warn"
          show={beat === 'compare'}
          start={0.4}
        />
      ))}
      {wrong?.rightCells.map(([i, j]) => (
        <Band
          key={`r${i}:${j}`}
          box={cellRect(b, i - 1, j - 1)}
          tone="warn"
          show={beat === 'compare'}
          start={0.5}
        />
      ))}

      <BoardMatrix value={left} box={a} label={names.left} opacity={leftOpacity} />
      <BoardMatrix value={right} box={b} label={names.right} opacity={rightOpacity} />
      <SvgText x={b.x - OPERATOR / 2} y={TOP + a.height / 2} className="fill-muted font-matrix">
        ×
      </SvgText>
      <SvgText x={p.x - OPERATOR / 2} y={TOP + p.height / 2} className="fill-muted font-matrix">
        =
      </SvgText>

      <HandText x={p.x + p.width / 2} y={15} size={15} className="fill-muted">
        {student && !reached('end') ? th.clip.mine : names.result}
      </HandText>
      <BoardMatrix value={product} box={p} hidden={() => true} />
      {product.map((cells, i) =>
        cells.map((number, j) => {
          const isFocus = i === row && j === col;
          const isTry = i === tryRow && j === tryCol;
          if (student) {
            return (
              <AnswerCell
                key={`${i}:${j}`}
                x={p.cx(j)}
                y={p.cy(i)}
                mine={student[i][j]}
                right={number}
                font={font}
                marked={reached(isFocus ? 'place' : isTry ? 'try_done' : 'end')}
                start={isFocus ? 0.42 : isTry ? 0.78 : 0.1 + 0.12 * (i + j)}
              />
            );
          }
          return (
            <Reveal
              key={`${i}:${j}`}
              show={reached(isFocus ? 'place' : isTry ? 'try_done' : 'fill_rest')}
              start={isFocus ? 0.42 : isTry ? 0.78 : 0.1 + 0.12 * (i + j)}
              pop
            >
              <HandText x={p.cx(j)} y={p.cy(i)} size={font} className="fill-cta">
                {rationalText(number)}
              </HandText>
            </Reveal>
          );
        }),
      )}
      <Ring
        cx={p.cx(col)}
        cy={p.cy(row)}
        r={cell * 0.46}
        tone={student ? 'warn' : 'row'}
        show={!reached('place') || beat === 'place'}
      />
      {tryCell && (
        <Ring
          cx={p.cx(tryCol)}
          cy={p.cy(tryRow)}
          r={cell * 0.46}
          tone="row"
          show={during('try_row', 'try_done')}
          start={0.2}
        />
      )}

      {/* ---- what they answered, and how they got it */}
      {mine && (
        <Verdict
          mine={rationalText(mine)}
          right={rationalText(value)}
          show={beat === 'compare'}
          y={low + 20}
        />
      )}
      {wrongText && (
        <Struck text={wrongText} y={low + 134} show={beat === 'compare'} start={0.5} size={30} />
      )}

      {/* ---- the sheet */}
      <Paper show={during('setup', 'try_row')} y={low} height={paperHeight}>
        <HandText
          x={ITEM_X}
          y={low + 26}
          size={20}
          anchor="start"
          className="fill-ink font-semibold"
        >
          {story?.who ?? fillTokens(plain.cellLabel, { i: String(row + 1), j: String(col + 1) })}
        </HandText>
        <SvgText x={QTY_X} y={low + 54} size={13} className="fill-muted font-sans">
          {story?.labels.qty ?? fillTokens(plain.rowLabel, { i: String(row + 1) })}
        </SvgText>
        <SvgText x={PRICE_X} y={low + 54} size={13} className="fill-muted font-sans">
          {story?.labels.price ?? fillTokens(plain.colLabel, { j: String(col + 1) })}
        </SvgText>
        <SvgText x={AMOUNT_X} y={low + 54} size={13} className="fill-muted font-sans">
          {story?.labels.result ?? copy.product}
        </SvgText>

        {terms.map(({ a: qty, b: price, product: amount }, k) => {
          const isTheirs = billing && k === row;
          return (
            <g key={k}>
              <Reveal show={beat === 'pair'} start={0.1 + 0.25 * k} length={0.1}>
                <rect
                  x={ITEM_X - 8}
                  y={lineY(k) - lineHeight / 2 + 2}
                  width={AMOUNT_X - ITEM_X + 34}
                  height={lineHeight - 4}
                  rx={8}
                  className="fill-marker/40"
                />
              </Reveal>
              <HandText x={ITEM_X} y={lineY(k)} size={18} anchor="start">
                {story ? story.items[k] : fillTokens(plain.pairLabel, { n: String(k + 1) })}
              </HandText>
              <Reveal show={reached('pick_row')} start={0.55 + 0.06 * k}>
                <rect
                  x={QTY_X - chip / 2}
                  y={lineY(k) - chip / 2}
                  width={chip}
                  height={chip}
                  rx={6}
                  className="fill-marker"
                />
                <HandText x={QTY_X} y={lineY(k)} size={chip * 0.72}>
                  {rationalText(qty)}
                </HandText>
              </Reveal>
              <Reveal show={reached('pick_col')} start={0.42 + 0.08 * k}>
                <SvgText x={TIMES_X} y={lineY(k)} size={17} className="fill-muted font-matrix">
                  ×
                </SvgText>
                <rect
                  x={PRICE_X - chip / 2}
                  y={lineY(k) - chip / 2}
                  width={chip}
                  height={chip}
                  rx={6}
                  className="fill-brand-soft"
                />
                <HandText x={PRICE_X} y={lineY(k)} size={chip * 0.72}>
                  {rationalText(price)}
                </HandText>
              </Reveal>
              <Reveal
                show={
                  billing
                    ? isTheirs
                      ? reached('only_first')
                      : reached('sum')
                    : reached('multiply')
                }
                start={billing ? (isTheirs ? 0.08 : 0.12) : 0.2 + 0.2 * k}
              >
                <SvgText x={EQUALS_X} y={lineY(k)} size={17} className="fill-muted font-matrix">
                  =
                </SvgText>
                <HandText x={AMOUNT_X} y={lineY(k)} size={chip * 0.72} className="fill-brand">
                  {rationalText(amount)}
                </HandText>
              </Reveal>
              {billing && !isTheirs && (
                <Reveal show={beat === 'only_first'} start={0.58} pop>
                  <HandText x={AMOUNT_X} y={lineY(k)} size={30} className="fill-warn font-semibold">
                    ?
                  </HandText>
                </Reveal>
              )}
            </g>
          );
        })}

        {billing && (
          <Reveal show={beat === 'only_first'} start={0.04}>
            <rect
              x={QTY_X - 24}
              y={lineY(row) - lineHeight / 2 + 3}
              width={AMOUNT_X - QTY_X + 48}
              height={lineHeight - 6}
              rx={12}
              fill="none"
              strokeWidth={2.5}
              className="stroke-warn"
            />
          </Reveal>
        )}

        <Reveal show={reached('sum')} start={0.36}>
          <line
            x1={ITEM_X}
            x2={306}
            y1={ruleY}
            y2={ruleY}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            className="stroke-muted"
          />
          <HandText
            x={ITEM_X}
            y={totalY}
            size={20}
            anchor="start"
            className="fill-ink font-semibold"
          >
            {copy.total}
          </HandText>
        </Reveal>
        <Reveal show={reached('sum')} start={0.46} pop>
          <rect
            x={AMOUNT_X - 28}
            y={totalY - 18}
            width={56}
            height={36}
            rx={8}
            className="fill-marker"
          />
          <HandText x={AMOUNT_X} y={totalY} size={28} className="fill-brand font-semibold">
            {rationalText(value)}
          </HandText>
        </Reveal>
      </Paper>

      {/* ---- numbers on their way down to the sheet, and the total on its way up */}
      {terms.map(({ a: qty, b: price }, k) => (
        <g key={k}>
          <Fly
            from={{ x: a.cx(k), y: a.cy(row) }}
            to={{ x: QTY_X, y: lineY(k) }}
            show={beat === 'pick_row'}
            start={0.33 + 0.06 * k}
            length={0.24}
          >
            <Chip width={chip} height={chip} size={chip * 0.72} tone="row">
              {rationalText(qty)}
            </Chip>
          </Fly>
          <Fly
            from={{ x: b.cx(col), y: b.cy(k) }}
            to={{ x: PRICE_X, y: lineY(k) }}
            show={beat === 'pick_col'}
            start={0.1 + 0.08 * k}
            length={0.34}
          >
            <Chip width={chip} height={chip} size={chip * 0.72} tone="col">
              {rationalText(price)}
            </Chip>
          </Fly>
        </g>
      ))}
      <Fly
        from={{ x: AMOUNT_X, y: totalY }}
        to={{ x: p.cx(col), y: p.cy(row) }}
        show={beat === 'place'}
        start={0.08}
        length={0.36}
        shrinkTo={0.8}
      >
        <Chip width={56} height={36} size={28} tone="row" ink="fill-brand font-semibold">
          {rationalText(value)}
        </Chip>
      </Fly>

      {/* ---- the rule, big enough to remember */}
      <BigWords
        left={copy.rowWord}
        middle={copy.pairWith}
        right={copy.colWord}
        y={(low + HEIGHT) / 2 - 10}
        show={rule}
      />

      {/* ---- their turn */}
      {tryCell && (
        <Reveal show={during('try_row', 'try_done')} start={0.2}>
          <HandText x={WIDTH / 2} y={low + 36} size={18} className="fill-muted">
            {copy.ringed}
          </HandText>
          <HandText x={WIDTH / 2} y={low + 80} size={30} className="fill-cta font-semibold">
            {asked(copy.rowChip, reached('try_col'), tryRow, names.left)}
          </HandText>
          <HandText x={WIDTH / 2} y={low + 118} size={18} className="fill-muted">
            {copy.pairWith}
          </HandText>
          <HandText x={WIDTH / 2} y={low + 156} size={30} className="fill-brand font-semibold">
            {asked(copy.colChip, reached('try_done'), tryCol, names.right)}
          </HandText>
        </Reveal>
      )}
      {beat === 'try_row' &&
        (cell >= MIN_TAP_CELL ? (
          left.map((_, i) => (
            <TapArea
              key={i}
              hit={rowHit(i)}
              edge={rowRect(a, i)}
              tone="row"
              label={fillTokens(copy.rowChip, { n: String(i + 1), name: names.left })}
              onTap={() => tap('row', i)}
            />
          ))
        ) : (
          <Choices
            options={left.map((_, i) => fillTokens(plain.rowLabel, { i: String(i + 1) }))}
            right={tryRow}
            y={low + 190}
          />
        ))}
      {beat === 'try_col' &&
        (cell >= MIN_TAP_CELL ? (
          right[0].map((_, j) => (
            <TapArea
              key={j}
              hit={colHit(j)}
              edge={colRect(b, j)}
              tone="col"
              label={fillTokens(copy.colChip, { n: String(j + 1), name: names.right })}
              onTap={() => tap('col', j)}
            />
          ))
        ) : (
          <Choices
            options={right[0].map((_, j) => fillTokens(plain.colLabel, { j: String(j + 1) }))}
            right={tryCol}
            y={low + 190}
          />
        ))}
      {flash && <WrongFlash box={flash.box} n={flash.n} />}

      {tryCell && tryValue && (
        <>
          <Reveal show={beat === 'try_done'} start={0.05}>
            <HandText x={WIDTH / 2} y={low + 60} size={fitted(workedLine, 30)}>
              {workedLine}
            </HandText>
          </Reveal>
          <Reveal show={beat === 'try_done'} start={0.22}>
            <HandText x={WIDTH / 2} y={low + 110} size={fitted(productsLine, 30)}>
              {productsLine}
            </HandText>
          </Reveal>
          <Reveal show={beat === 'try_done'} start={0.42} pop>
            <HandText x={WIDTH / 2} y={low + 172} size={48} className="fill-cta font-semibold">
              {`= ${rationalText(tryValue)}`}
            </HandText>
          </Reveal>
          <Fly
            from={{ x: WIDTH / 2 + 20, y: low + 172 }}
            to={{ x: p.cx(tryCol), y: p.cy(tryRow) }}
            show={beat === 'try_done'}
            start={0.62}
            length={0.2}
            shrinkTo={0.75}
          >
            <SvgText size={32} className={`${HAND} fill-cta font-semibold`}>
              {rationalText(tryValue)}
            </SvgText>
          </Fly>
        </>
      )}
    </Stage>
  );
}
