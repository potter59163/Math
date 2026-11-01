import { th } from '@/lib/content/th';
import type { SceneSpecOf, TransposeBeat } from '@/lib/topics/matrix/scenes/types';
import {
  Fade,
  Highlight,
  Place,
  STAGE_WIDTH,
  SvgBracket,
  SvgMatrix,
  SvgNumber,
  SvgText,
  matrixBox,
  type MatrixBox,
} from './svg';

const SIZE = 18;
const MIN_COLUMN = 32;
/** The diagonal runs through these cells, so their digits get a halo to stay readable. */
const ON_DIAGONAL = 'stroke-canvas [paint-order:stroke] [stroke-width:4px]';
const TOP = 28;
const ARROW = 44;

interface Props {
  spec: SceneSpecOf<'transpose_flip'>;
  beat: TransposeBeat;
}

/** The main diagonal of a matrix, which is the mirror: those cells stay where they are. */
function Diagonal({ box, x, y, show }: { box: MatrixBox; x: number; y: number; show: boolean }) {
  const cells = Math.min(
    Math.round((box.width - 20) / box.colWidth),
    Math.round((box.height - 8) / box.rowHeight),
  );
  return (
    <Fade show={show}>
      <line
        x1={x + box.cellX(0) - box.colWidth / 2}
        y1={y + box.cellY(0) - box.rowHeight / 2}
        x2={x + box.cellX(cells - 1) + box.colWidth / 2}
        y2={y + box.cellY(cells - 1) + box.rowHeight / 2}
        strokeWidth={1.5}
        strokeDasharray="4 4"
        className="stroke-edge"
      />
    </Fade>
  );
}

/** SCENES §4. Row k leaves A and lands as column k of Aᵀ, so each row turns on its way across. */
export function TransposeFlip({ spec, beat }: Props) {
  const { A, transposed, student } = spec.params;
  const now = spec.beats.indexOf(beat);
  const comparing = beat === 'compare';
  const setUp = now >= spec.beats.indexOf('setup');
  const done = beat === 'done';
  const movedAt = (row: number) => spec.beats.indexOf(`row_${row + 1}`);
  const isMoved = (row: number) => now >= movedAt(row);
  const current = A.findIndex((_, row) => movedAt(row) === now);

  const box = matrixBox(A, SIZE, MIN_COLUMN);
  const flipped = matrixBox(transposed, SIZE, MIN_COLUMN);
  const total = box.width + ARROW + flipped.width;
  const leftX = (STAGE_WIDTH - total) / 2;
  const rightX = leftX + box.width + ARROW;
  const tallest = Math.max(box.height, flipped.height);
  const yStudent = TOP + tallest + 26;
  const studentBox = student ? matrixBox(student, 16) : null;
  const height = yStudent + (studentBox ? studentBox.height + 6 : 0);

  const rightLabel = comparing ? th.scenes.player.student : 'Aᵀ';

  return (
    <svg viewBox={`0 0 ${STAGE_WIDTH} ${height}`} className="h-full w-full" aria-hidden="true">
      <SvgText
        x={leftX + box.width / 2}
        y={TOP - 13}
        size={14}
        className="fill-muted font-semibold"
      >
        A
      </SvgText>
      <SvgText
        x={rightX + flipped.width / 2}
        y={TOP - 13}
        size={14}
        className={comparing ? 'fill-warn font-semibold' : 'fill-muted font-semibold'}
      >
        {rightLabel}
      </SvgText>
      <SvgText
        x={leftX + box.width + ARROW / 2}
        y={TOP + tallest / 2}
        size={18}
        className="fill-muted font-matrix"
      >
        →
      </SvgText>

      {current >= 0 && (
        <>
          <Highlight
            x={leftX + 6}
            y={TOP + box.cellY(current) - box.rowHeight / 2}
            width={box.width - 12}
            height={box.rowHeight}
            show
          />
          <Highlight
            x={rightX + flipped.cellX(current) - flipped.colWidth / 2}
            y={TOP + 2}
            width={flipped.colWidth}
            height={flipped.height - 4}
            show
          />
        </>
      )}

      <Diagonal box={box} x={leftX} y={TOP} show={setUp} />
      <Diagonal box={flipped} x={rightX} y={TOP} show={setUp} />

      <g transform={`translate(${leftX} ${TOP})`}>
        <SvgBracket width={box.width} height={box.height} />
      </g>
      <g transform={`translate(${rightX} ${TOP})`}>
        <SvgBracket width={flipped.width} height={flipped.height} />
      </g>

      {A.map((cells, row) =>
        cells.map((cell, col) => (
          <Fade key={`${row}:${col}`} show to={current >= 0 && row !== current ? 0.35 : 1}>
            <SvgNumber
              value={cell}
              x={leftX + box.cellX(col)}
              y={TOP + box.cellY(row)}
              size={SIZE}
              className={row === col ? `fill-ink ${ON_DIAGONAL}` : 'fill-ink'}
            />
          </Fade>
        )),
      )}

      {student?.map((cells, row) =>
        cells.map((cell, col) => (
          <Fade key={`${row}:${col}`} show={comparing}>
            <SvgNumber
              value={cell}
              x={rightX + flipped.cellX(col)}
              y={TOP + flipped.cellY(row)}
              size={SIZE}
              className="fill-warn"
            />
          </Fade>
        )),
      )}

      {A.map((cells, row) =>
        cells.map((cell, col) => (
          <Place
            key={`${row}:${col}`}
            x={isMoved(row) ? rightX + flipped.cellX(row) : leftX + box.cellX(col)}
            y={isMoved(row) ? TOP + flipped.cellY(col) : TOP + box.cellY(row)}
            opacity={isMoved(row) ? 1 : 0}
            start={0.05 + 0.12 * col}
            length={0.4}
          >
            <SvgNumber
              value={cell}
              size={SIZE}
              className={`${done ? 'fill-ink' : 'fill-brand'} ${row === col ? ON_DIAGONAL : ''}`}
            />
          </Place>
        )),
      )}

      {student && studentBox && (
        <Fade show={done} start={0.2}>
          <SvgText
            x={STAGE_WIDTH / 2 - studentBox.width / 2 - 8}
            y={yStudent + studentBox.height / 2}
            size={13}
            anchor="end"
            className="fill-muted font-medium"
          >
            {th.scenes.player.student}
          </SvgText>
          <SvgMatrix
            value={student}
            box={studentBox}
            x={STAGE_WIDTH / 2 - studentBox.width / 2}
            y={yStudent}
            size={16}
          />
          <line
            x1={STAGE_WIDTH / 2 - studentBox.width / 2 - 4}
            x2={STAGE_WIDTH / 2 + studentBox.width / 2 + 4}
            y1={yStudent + studentBox.height}
            y2={yStudent}
            strokeWidth={1.5}
            className="stroke-warn"
          />
        </Fade>
      )}
    </svg>
  );
}
