import { th } from '@/lib/content/th';
import type { Matrix } from '@/lib/core/types';
import type { CellByCellBeat, SceneSpecOf } from '@/lib/topics/matrix/scenes/types';
import {
  Fade,
  Highlight,
  STAGE_WIDTH,
  SvgBracket,
  SvgNumber,
  SvgText,
  matrixBox,
  type MatrixBox,
} from './svg';

const OP_WIDTH = 24;
const TOP = 30;
const WORK_GAP = 44;

interface Props {
  spec: SceneSpecOf<'cell_by_cell'>;
  beat: CellByCellBeat;
}

const OP_SIGN = { add: '+', sub: '−', scalar: '×' } as const;

function Labelled({
  value,
  box,
  x,
  size,
  label,
  tone = 'fill-muted',
  shown,
}: {
  value: Matrix;
  box: MatrixBox;
  x: number;
  size: number;
  label: string;
  tone?: string;
  shown?(i: number, j: number): boolean;
}) {
  return (
    <g transform={`translate(${x} ${TOP})`}>
      <SvgText x={box.width / 2} y={-13} size={13} className={`${tone} font-sans font-semibold`}>
        {label}
      </SvgText>
      <SvgBracket width={box.width} height={box.height} />
      {value.map((row, i) =>
        row.map((cell, j) => (
          <Fade key={`${i}:${j}`} show={shown ? shown(i, j) : true}>
            <SvgNumber value={cell} x={box.cellX(j)} y={box.cellY(i)} size={size} />
          </Fade>
        )),
      )}
    </g>
  );
}

function CellTint({
  box,
  x,
  i,
  j,
  show,
  tone,
}: {
  box: MatrixBox;
  x: number;
  i: number;
  j: number;
  show: boolean;
  tone?: 'brand' | 'good' | 'warn';
}) {
  return (
    <Highlight
      x={x + box.cellX(j) - box.colWidth / 2 + 1}
      y={TOP + box.cellY(i) - box.rowHeight / 2 + 1}
      width={box.colWidth - 2}
      height={box.rowHeight - 2}
      show={show}
      tone={tone}
    />
  );
}

/** SCENES §3.6. Every number on it comes from the spec: this only places them. */
export function CellByCell({ spec, beat }: Props) {
  const { op, left, right, k, result, names, work, cellsInFull, student, also } = spec.params;
  const comparing = beat === 'compare';
  const scaling = beat === 'also';

  const cols = left[0].length;
  const size = cols >= 3 ? 14 : 17;
  const minColumn = cols >= 3 ? 24 : 32;
  const leftBox = matrixBox(left, size, minColumn);
  const rightBox = right ? matrixBox(right, size, minColumn) : null;
  const resultBox = matrixBox(result, size, minColumn);
  const studentBox = student ? matrixBox(student, size, minColumn) : null;
  // The wider of the two, so that the drawing keeps one size from beat to beat.
  const rightmost = Math.max(resultBox.width, studentBox?.width ?? 0);

  const kWidth = k ? 34 : 0;
  const total =
    kWidth + leftBox.width + (rightBox ? OP_WIDTH + rightBox.width : 0) + OP_WIDTH + rightmost;
  const width = Math.max(STAGE_WIDTH, total + 8);
  const startX = (width - total) / 2;
  const kX = startX + kWidth / 2 - 6;
  const leftX = startX + kWidth;
  const rightX = leftX + leftBox.width + OP_WIDTH;
  const resultX = (rightBox ? rightX + rightBox.width : leftX + leftBox.width) + OP_WIDTH;
  const rowMiddle = TOP + leftBox.height / 2;
  const workY = TOP + Math.max(leftBox.height, resultBox.height) + WORK_GAP;
  const height = workY + 40;

  const now = spec.beats.indexOf(beat);
  const fullAt = (index: number) => spec.beats.indexOf(`cell_${index + 1}`);
  const currentIndex = work.findIndex((_, index) => index < cellsInFull && fullAt(index) === now);
  const current = currentIndex >= 0 ? work[currentIndex] : null;
  const allIn = beat === 'rest' || beat === 'done';

  const isShown = (i: number, j: number) => {
    if (allIn) return true;
    const index = work.findIndex((cell) => cell.i === i + 1 && cell.j === j + 1);
    return index < cellsInFull && fullAt(index) >= 0 && now >= fullAt(index);
  };

  const wrongCell = (i: number, j: number) => !student?.[i]?.[j]?.equals(result[i][j]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" aria-hidden="true">
      <Fade show={!scaling}>
        {current && (
          <>
            <CellTint box={leftBox} x={leftX} i={current.i - 1} j={current.j - 1} show />
            {rightBox && rightX && (
              <CellTint box={rightBox} x={rightX} i={current.i - 1} j={current.j - 1} show />
            )}
            <CellTint
              box={resultBox}
              x={resultX}
              i={current.i - 1}
              j={current.j - 1}
              show
              tone="good"
            />
          </>
        )}
        {comparing &&
          studentBox &&
          student?.map((row, i) =>
            row.map((_, j) => (
              <CellTint
                key={`${i}:${j}`}
                box={studentBox}
                x={resultX}
                i={i}
                j={j}
                show={wrongCell(i, j)}
                tone="warn"
              />
            )),
          )}

        {k && (
          <SvgNumber
            value={k}
            x={kX}
            y={rowMiddle}
            size={size + 2}
            className="fill-brand font-semibold"
          />
        )}
        {k && (
          <SvgText
            x={startX + kWidth - 8}
            y={rowMiddle}
            size={15}
            className="fill-muted font-matrix"
          >
            ×
          </SvgText>
        )}
        <Labelled value={left} box={leftBox} x={leftX} size={size} label={names.left} />
        {right && rightBox && (
          <>
            <SvgText
              x={leftX + leftBox.width + OP_WIDTH / 2}
              y={rowMiddle}
              size={18}
              className="fill-muted font-matrix"
            >
              {OP_SIGN[op]}
            </SvgText>
            <Labelled
              value={right}
              box={rightBox}
              x={rightX}
              size={size}
              label={names.right ?? 'B'}
            />
          </>
        )}
        <SvgText
          x={resultX - OP_WIDTH / 2}
          y={rowMiddle}
          size={18}
          className="fill-muted font-matrix"
        >
          =
        </SvgText>

        <Fade show={comparing}>
          {student && studentBox && (
            <Labelled
              value={student}
              box={studentBox}
              x={resultX}
              size={size}
              label={th.scenes.player.student}
              tone="fill-warn"
            />
          )}
        </Fade>
        <Fade show={!comparing}>
          <Labelled
            value={result}
            box={resultBox}
            x={resultX}
            size={size}
            label={names.result}
            shown={isShown}
          />
        </Fade>

        <Fade show={current !== null} length={0.25}>
          <SvgText
            x={width / 2}
            y={workY}
            size={22}
            className="fill-brand font-matrix font-semibold"
          >
            {current?.expression ?? ''}
          </SvgText>
        </Fade>
      </Fade>

      {also && (
        <Fade show={scaling}>
          <SvgNumber
            value={also.k}
            x={width / 2 - leftBox.width - 34}
            y={rowMiddle}
            size={19}
            className="fill-brand font-semibold"
          />
          <SvgText
            x={width / 2 - leftBox.width - 18}
            y={rowMiddle}
            size={16}
            className="fill-muted font-matrix"
          >
            ×
          </SvgText>
          <Labelled
            value={left}
            box={leftBox}
            x={width / 2 - leftBox.width - 8}
            size={size}
            label={names.left}
          />
          <SvgText x={width / 2 + 8} y={rowMiddle} size={18} className="fill-muted font-matrix">
            =
          </SvgText>
          <Labelled
            value={also.result}
            box={matrixBox(also.result, size, minColumn)}
            x={width / 2 + 22}
            size={size}
            label={names.result}
          />
        </Fade>
      )}
    </svg>
  );
}
