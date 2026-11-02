import { useContext, useState } from 'react';
import {
  Band,
  BoardMatrix,
  ClipActionsContext,
  Cross,
  HEIGHT,
  HandText,
  Reveal,
  Stage,
  TapArea,
  WIDTH,
  WrongFlash,
  boxAt,
  colRect,
  matrixFont,
  rowRect,
  type Box,
  type Rect,
} from '@/components/clip/kit';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { SceneSpecOf, TransposeBeat } from '@/lib/topics/matrix/scenes/types';
import { Fade, Place, SvgNumber, SvgText } from './svg';

const TOP = 42;
const ARROW = 30;
const MAX_CELL = 46;
const MATRIX_HEIGHT = 156;

const copy = th.scenes.transpose;

interface Props {
  spec: SceneSpecOf<'transpose_flip'>;
  beat: TransposeBeat;
}

/** The main diagonal of a matrix, which is the mirror: those cells stay where they are. */
function Diagonal({ box, cells, show }: { box: Box; cells: number; show: boolean }) {
  return (
    <Fade show={show}>
      <line
        x1={box.cx(0) - box.cell / 2}
        y1={box.cy(0) - box.rowHeight / 2}
        x2={box.cx(cells - 1) + box.cell / 2}
        y2={box.cy(cells - 1) + box.rowHeight / 2}
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
  const actions = useContext(ClipActionsContext);
  const [flash, setFlash] = useState<{ box: Rect; n: number } | null>(null);
  const now = spec.beats.indexOf(beat);
  const comparing = beat === 'compare';
  const setUp = now >= spec.beats.indexOf('setup');
  const movedAt = (row: number) => spec.beats.indexOf(`row_${row + 1}`);
  const isMoved = (row: number) => now >= movedAt(row);
  const current = A.findIndex((_, row) => movedAt(row) === now);
  const lastRow = A.length - 1;
  const asking = beat === 'try';

  const rows = A.length;
  const cols = A[0].length;
  const columns = cols + rows;
  const cell = Math.min(
    MAX_CELL,
    (WIDTH - 24 - 24 - ARROW) / columns,
    MATRIX_HEIGHT / Math.max(rows, cols),
  );
  const leftWidth = cols * cell + 12;
  const rightWidth = rows * cell + 12;
  const x0 = (WIDTH - leftWidth - ARROW - rightWidth) / 2;
  const a = boxAt(x0, TOP, rows, cols, cell);
  const t = boxAt(x0 + leftWidth + ARROW, TOP, cols, rows, cell);
  const font = matrixFont(A, cell);
  const diagonal = Math.min(rows, cols);
  const low = TOP + Math.max(rows, cols) * cell + 30;
  const middle = (low + HEIGHT) / 2 - 4;

  const pick = (column: number) => {
    if (column === lastRow) {
      setFlash(null);
      actions.right();
      return;
    }
    setFlash((last) => ({ box: colRect(t, column), n: (last?.n ?? 0) + 1 }));
    actions.wrong();
  };

  const opacityOf = (row: number) => {
    if (asking) return row === lastRow ? 1 : 0.3;
    return current >= 0 && row !== current ? 0.3 : 1;
  };
  const moving = current >= 0 ? current : asking ? lastRow : -1;

  return (
    <Stage>
      {moving >= 0 && <Band box={rowRect(a, moving)} tone="row" show />}
      {current >= 0 && <Band box={colRect(t, current)} tone="col" show start={0.1} />}

      <Diagonal box={a} cells={diagonal} show={setUp} />
      <Diagonal box={t} cells={diagonal} show={setUp} />

      <BoardMatrix value={A} box={a} label="A" opacity={(row) => opacityOf(row)} />
      <BoardMatrix
        value={transposed}
        box={t}
        label={comparing ? th.clip.mine : 'Aᵀ'}
        labelClass={comparing ? 'fill-warn' : 'fill-muted'}
        hidden={() => true}
      />
      <SvgText
        x={a.x + a.width + ARROW / 2}
        y={TOP + (rows * cell) / 2}
        size={20}
        className="fill-muted font-matrix"
      >
        →
      </SvgText>

      {/* ---- what they wrote, in the place of the answer */}
      {student?.map((cells, row) =>
        cells.map((number, col) => (
          <Fade key={`${row}:${col}`} show={comparing}>
            <SvgNumber
              value={number}
              x={t.cx(col)}
              y={t.cy(row)}
              size={font}
              className="fill-brand"
            />
          </Fade>
        )),
      )}
      <Cross
        x={t.x + t.width / 2}
        y={t.y + t.height / 2}
        size={Math.min(t.width, t.height) * 0.4}
        show={comparing}
        start={0.4}
      />

      {/* ---- each row on its way to being a column */}
      {A.map((cells, row) =>
        cells.map((number, col) => (
          <Place
            key={`${row}:${col}`}
            x={isMoved(row) ? t.cx(row) : a.cx(col)}
            y={isMoved(row) ? t.cy(col) : a.cy(row)}
            opacity={isMoved(row) ? 1 : 0}
            start={0.08 + 0.1 * col}
            length={0.4}
          >
            <SvgNumber value={number} size={font} className="fill-cta" />
          </Place>
        )),
      )}

      {current >= 0 && (
        <g>
          <Reveal show start={0.08} pop>
            <HandText x={88} y={middle} size={40} className="fill-cta font-semibold">
              {fillTokens(copy.rowWord, { k: String(current + 1) })}
            </HandText>
          </Reveal>
          <Reveal show start={0.3}>
            <HandText x={170} y={middle} size={26} className="fill-muted">
              →
            </HandText>
          </Reveal>
          <Reveal show start={0.42} pop>
            <HandText x={252} y={middle} size={40} className="fill-brand font-semibold">
              {fillTokens(copy.colWord, { k: String(current + 1) })}
            </HandText>
          </Reveal>
        </g>
      )}
      <Reveal show={beat === 'done' || beat === 'setup'} start={0.15} pop>
        <HandText x={WIDTH / 2} y={middle} size={36} className="fill-cta font-semibold">
          {copy.rule}
        </HandText>
      </Reveal>

      {/* ---- their turn: the last row, onto a column of their choosing */}
      {asking &&
        transposed[0].map((_, column) => (
          <TapArea
            key={column}
            hit={{
              x: t.cx(column) - cell / 2,
              y: TOP - 12,
              width: cell,
              height: t.height + 24,
            }}
            edge={colRect(t, column)}
            tone="col"
            label={fillTokens(copy.colWord, { k: String(column + 1) })}
            onTap={() => pick(column)}
          />
        ))}
      {flash && <WrongFlash box={flash.box} n={flash.n} />}
    </Stage>
  );
}
