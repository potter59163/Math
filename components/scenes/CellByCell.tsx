import {
  Band,
  BoardMatrix,
  Chip,
  Choices,
  Fly,
  HEIGHT,
  HandText,
  Reveal,
  Ring,
  Stage,
  Tick,
  Verdict,
  WIDTH,
  boxAt,
  cellRect,
  fitted,
} from '@/components/clip/kit';
import { th } from '@/lib/content/th';
import { rationalText } from '@/lib/topics/matrix/format';
import type { CellByCellBeat, SceneSpecOf } from '@/lib/topics/matrix/scenes/types';
import { SvgText } from './svg';

const OP_WIDTH = 18;
const K_WIDTH = 34;
const TOP = 30;
const MAX_CELL = 46;
const MATRICES_HEIGHT = 130;
/** Where the five pieces of "a + b = c" sit on the board. */
const SLOTS = [50, 110, 170, 230, 290];
/** Of a beat, when a worked number reaches its cell. */
const ARRIVES = 0.9;

interface Props {
  spec: SceneSpecOf<'cell_by_cell'>;
  beat: CellByCellBeat;
}

const OP_SIGN = { add: '+', sub: '−', scalar: '×' } as const;

/** SCENES §3.6. Every number on it comes from the spec: this only places them. */
export function CellByCell({ spec, beat }: Props) {
  const { op, left, right, k, result, names, work, cellsInFull, student, also } = spec.params;
  const { try: question } = spec.params;
  const copy = th.scenes.cellByCell;
  const comparing = beat === 'compare';
  const scaling = beat === 'also';

  const rows = left.length;
  const cols = left[0].length;
  const matrices = right ? 3 : 2;
  const kWidth = k ? K_WIDTH : 0;
  const cell = Math.min(
    MAX_CELL,
    (WIDTH - 8 - kWidth - OP_WIDTH * (matrices - 1) - 12 * matrices) / (cols * matrices),
    MATRICES_HEIGHT / rows,
  );
  const matrixWidth = cols * cell + 12;
  const total = kWidth + matrixWidth * matrices + OP_WIDTH * (matrices - 1);
  const startX = (WIDTH - total) / 2;
  const a = boxAt(startX + kWidth, TOP, rows, cols, cell);
  const b = boxAt(a.x + matrixWidth + OP_WIDTH, TOP, rows, cols, cell);
  const c = right ? boxAt(b.x + matrixWidth + OP_WIDTH, TOP, rows, cols, cell) : b;
  const middleY = TOP + (rows * cell) / 2;
  const low = TOP + rows * cell + 24;
  const workY = (low + HEIGHT) / 2 - 20;

  const now = spec.beats.indexOf(beat);
  const fullBeat = (index: number): CellByCellBeat =>
    index === 0 ? 'cell_1' : spec.beats.includes('try_done') ? 'try_done' : 'cell_2';
  const fullAt = (index: number) => spec.beats.indexOf(fullBeat(index));
  const currentIndex = work.findIndex((_, index) => index < cellsInFull && fullAt(index) === now);
  const current = currentIndex >= 0 ? work[currentIndex] : null;
  const asking = beat === 'try';
  const asked = asking ? work[1] : null;
  const pointed = current ?? asked;
  const allIn = beat === 'rest' || beat === 'done' || scaling;

  const isShown = (i: number, j: number) => {
    if (allIn) return true;
    const index = work.findIndex((cell2) => cell2.i === i + 1 && cell2.j === j + 1);
    return index >= 0 && index < cellsInFull && fullAt(index) >= 0 && now >= fullAt(index);
  };

  const focus = work[0];
  const wrongCell = (i: number, j: number) => !student?.[i]?.[j]?.equals(result[i][j]);

  const size = 34;
  const chipSize = 46;

  return (
    <Stage>
      <Reveal show={!scaling}>
        {pointed && (
          <>
            <Band box={cellRect(a, pointed.i - 1, pointed.j - 1)} tone="row" show />
            {right && <Band box={cellRect(b, pointed.i - 1, pointed.j - 1)} tone="col" show />}
          </>
        )}
        {k && (
          <>
            <HandText x={startX + 12} y={middleY} size={26} className="fill-cta font-semibold">
              {rationalText(k)}
            </HandText>
            <SvgText x={a.x - 8} y={middleY} size={15} className="fill-muted font-matrix">
              ×
            </SvgText>
          </>
        )}
        <BoardMatrix value={left} box={a} label={names.left} />
        {right && (
          <>
            <SvgText
              x={a.x + matrixWidth + OP_WIDTH / 2}
              y={middleY}
              size={18}
              className="fill-muted font-matrix"
            >
              {OP_SIGN[op]}
            </SvgText>
            <BoardMatrix value={right} box={b} label={names.right ?? 'B'} />
          </>
        )}
        <SvgText x={c.x - OP_WIDTH / 2} y={middleY} size={18} className="fill-muted font-matrix">
          =
        </SvgText>

        {/* ---- what they answered, in the place of the answer */}
        {student ? (
          <Reveal show={comparing}>
            <BoardMatrix
              value={student}
              box={c}
              label={th.clip.mine}
              labelClass="fill-warn"
              numberClass="fill-brand"
            />
            {student.map((cells, i) =>
              cells.map((_, j) => (
                <Ring
                  key={`${i}:${j}`}
                  cx={c.cx(j)}
                  cy={c.cy(i)}
                  r={cell * 0.44}
                  show={comparing && wrongCell(i, j)}
                  start={0.15 + 0.08 * (i + j)}
                />
              )),
            )}
          </Reveal>
        ) : null}
        <Reveal show={!comparing}>
          <BoardMatrix
            value={result}
            box={c}
            label={names.result}
            hidden={(i, j) => !isShown(i, j)}
            numberClass="fill-cta"
            // A worked cell is filled in only when its number has flown there.
            start={current ? ARRIVES : 0}
          />
        </Reveal>

        {student && (
          <Verdict
            mine={rationalText(student[focus.i - 1][focus.j - 1])}
            right={rationalText(result[focus.i - 1][focus.j - 1])}
            show={comparing}
            y={low + 44}
            start={0.3}
          />
        )}

        {/* ---- one cell, worked out where everyone can see it */}
        {work.slice(0, cellsInFull).map((worked, index) => {
          const open = fullBeat(index) === beat;
          const [first, sign, second] =
            op === 'scalar' ? [k, OP_SIGN[op], worked.a] : [worked.a, OP_SIGN[op], worked.b];
          return (
            <g key={index}>
              {first && op !== 'scalar' && (
                <Fly
                  from={{ x: a.cx(worked.j - 1), y: a.cy(worked.i - 1) }}
                  to={{ x: SLOTS[0], y: workY }}
                  show={open}
                  start={0.08}
                  length={0.26}
                >
                  <Chip width={chipSize} height={chipSize} size={size * 0.8} tone="row">
                    {rationalText(first)}
                  </Chip>
                </Fly>
              )}
              {second && (
                <Fly
                  from={
                    op === 'scalar'
                      ? { x: a.cx(worked.j - 1), y: a.cy(worked.i - 1) }
                      : { x: b.cx(worked.j - 1), y: b.cy(worked.i - 1) }
                  }
                  to={{ x: SLOTS[2], y: workY }}
                  show={open}
                  start={0.2}
                  length={0.26}
                >
                  <Chip
                    width={chipSize}
                    height={chipSize}
                    size={size * 0.8}
                    tone={op === 'scalar' ? 'row' : 'col'}
                  >
                    {rationalText(second)}
                  </Chip>
                </Fly>
              )}
              {first && (
                <Reveal show={open} start={op === 'scalar' ? 0.06 : 0.32}>
                  <HandText x={SLOTS[0]} y={workY} size={fitted(rationalText(first), size, 56)}>
                    {rationalText(first)}
                  </HandText>
                </Reveal>
              )}
              <Reveal show={open} start={0.34}>
                <HandText x={SLOTS[1]} y={workY} size={size} className="fill-muted">
                  {sign}
                </HandText>
              </Reveal>
              {second && (
                <Reveal show={open} start={0.44}>
                  <HandText x={SLOTS[2]} y={workY} size={fitted(rationalText(second), size, 56)}>
                    {rationalText(second)}
                  </HandText>
                </Reveal>
              )}
              <Reveal show={open} start={0.52}>
                <HandText x={SLOTS[3]} y={workY} size={size} className="fill-muted">
                  =
                </HandText>
              </Reveal>
              <Reveal show={open} start={0.58} pop>
                <HandText
                  x={SLOTS[4]}
                  y={workY}
                  size={fitted(rationalText(worked.value), 42, 62)}
                  className="fill-cta font-semibold"
                >
                  {rationalText(worked.value)}
                </HandText>
              </Reveal>
              <Fly
                from={{ x: SLOTS[4], y: workY }}
                to={{ x: c.cx(worked.j - 1), y: c.cy(worked.i - 1) }}
                show={open}
                start={0.72}
                length={0.2}
                shrinkTo={0.7}
              >
                <SvgText size={36} className="fill-cta font-hand font-semibold">
                  {rationalText(worked.value)}
                </SvgText>
              </Fly>
            </g>
          );
        })}

        {/* ---- their turn */}
        {question && asking && (
          <Choices options={question.options} right={question.right} y={workY - 30} />
        )}

        {/* ---- the rule */}
        <Reveal show={beat === 'done'} start={0.05} pop>
          <HandText x={WIDTH / 2} y={workY} size={36} className="fill-cta font-semibold">
            {copy.rule[op]}
          </HandText>
        </Reveal>
        <Tick x={WIDTH / 2} y={workY + 62} size={22} show={beat === 'done'} start={0.2} />
      </Reveal>

      {/* ---- the same idea with a number: it goes into every cell */}
      {also && (
        <Reveal show={scaling}>
          <AlsoScaled spec={spec} scaling={scaling} />
        </Reveal>
      )}
    </Stage>
  );
}

function AlsoScaled({ spec, scaling }: { spec: SceneSpecOf<'cell_by_cell'>; scaling: boolean }) {
  const { left, names, also } = spec.params;
  if (!also) return null;
  const rows = left.length;
  const cols = left[0].length;
  const cell = Math.min(50, (WIDTH - 90) / (cols * 2));
  const width = cols * cell + 12;
  const start = (WIDTH - (34 + width * 2 + 22)) / 2;
  const a = boxAt(start + 34, 70, rows, cols, cell);
  const r = boxAt(a.x + width + 22, 70, rows, cols, cell);
  const middleY = 70 + (rows * cell) / 2;
  return (
    <g>
      <HandText x={start + 12} y={middleY} size={30} className="fill-cta font-semibold">
        {rationalText(also.k)}
      </HandText>
      <SvgText x={a.x - 8} y={middleY} size={16} className="fill-muted font-matrix">
        ×
      </SvgText>
      <BoardMatrix value={left} box={a} label={names.left} />
      <SvgText x={r.x - 11} y={middleY} size={18} className="fill-muted font-matrix">
        =
      </SvgText>
      <BoardMatrix value={also.result} box={r} hidden={() => true} label={names.result} />
      {also.result.map((cells, i) =>
        cells.map((number, j) => (
          <Reveal key={`${i}:${j}`} show={scaling} start={0.2 + 0.12 * (i + j)} pop>
            <HandText x={r.cx(j)} y={r.cy(i)} size={cell * 0.56} className="fill-cta">
              {rationalText(number)}
            </HandText>
          </Reveal>
        )),
      )}
      <Reveal show={scaling} start={0.5}>
        <HandText
          x={WIDTH / 2}
          y={70 + rows * cell + 80}
          size={36}
          className="fill-cta font-semibold"
        >
          {th.scenes.cellByCell.rule.scalar}
        </HandText>
      </Reveal>
    </g>
  );
}
