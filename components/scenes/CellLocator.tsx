import { rationalText } from '@/lib/topics/matrix/format';
import type { CellBeat, SceneSpecOf } from '@/lib/topics/matrix/scenes/types';
import { Fade, Highlight, STAGE_WIDTH, SvgBracket, SvgNumber, SvgText } from './svg';

const ORDER: CellBeat[] = ['row', 'col', 'hit', 'compare'];

const CELL_HEIGHT = 40;
const TOP = 42;
const LABELS = 24;

interface Props {
  spec: SceneSpecOf<'cell_locator'>;
  beat: CellBeat;
}

/** SCENES §4. The row, then the column, then the one cell they share. */
export function CellLocator({ spec, beat }: Props) {
  const { A, i, j, name, value, swapped } = spec.params;
  const reached = (step: CellBeat) => ORDER.indexOf(beat) >= ORDER.indexOf(step);
  const [row, col] = [i - 1, j - 1];

  const rows = A.length;
  const cols = A[0].length;
  const cellWidth = cols > 3 ? 48 : 56;
  const gridWidth = cols * cellWidth;
  const gridHeight = rows * CELL_HEIGHT;
  const left = (STAGE_WIDTH - gridWidth + LABELS) / 2;
  const yAnswer = TOP + gridHeight + 34;
  const height = yAnswer + (swapped ? 50 : 24);

  const cellX = (c: number) => left + (c + 0.5) * cellWidth;
  const cellY = (r: number) => TOP + (r + 0.5) * CELL_HEIGHT;

  const opacityAt = (r: number, c: number) => {
    if (beat === 'compare' && r === col && c === row) return 1;
    if (reached('hit')) return r === row && c === col ? 1 : 0.3;
    if (reached('col')) return r === row || c === col ? 1 : 0.3;
    return r === row ? 1 : 0.3;
  };

  return (
    <svg viewBox={`0 0 ${STAGE_WIDTH} ${height}`} className="h-full w-full" aria-hidden="true">
      {Array.from({ length: cols }, (_, c) => (
        <SvgText
          key={c}
          x={cellX(c)}
          y={TOP - 14}
          size={13}
          className={`font-matrix tabular-nums ${c === col && reached('col') ? 'fill-good font-semibold' : 'fill-muted'}`}
        >
          {c + 1}
        </SvgText>
      ))}
      {Array.from({ length: rows }, (_, r) => (
        <SvgText
          key={r}
          x={left - 16}
          y={cellY(r)}
          size={13}
          className={`font-matrix tabular-nums ${r === row ? 'fill-brand font-semibold' : 'fill-muted'}`}
        >
          {r + 1}
        </SvgText>
      ))}

      <Highlight
        x={left + 2}
        y={TOP + row * CELL_HEIGHT + 2}
        width={gridWidth - 4}
        height={CELL_HEIGHT - 4}
        show={reached('row') && !reached('hit')}
      />
      <Highlight
        x={left + col * cellWidth + 2}
        y={TOP + 2}
        width={cellWidth - 4}
        height={gridHeight - 4}
        show={reached('col') && !reached('hit')}
        tone="good"
      />
      <Highlight
        x={left + col * cellWidth + 2}
        y={TOP + row * CELL_HEIGHT + 2}
        width={cellWidth - 4}
        height={CELL_HEIGHT - 4}
        show={reached('hit')}
        tone="good"
      />
      {swapped && (
        <Highlight
          x={left + row * cellWidth + 2}
          y={TOP + col * CELL_HEIGHT + 2}
          width={cellWidth - 4}
          height={CELL_HEIGHT - 4}
          show={reached('compare')}
          tone="warn"
        />
      )}

      <g transform={`translate(${left - 4} ${TOP - 2})`}>
        <SvgBracket width={gridWidth + 8} height={gridHeight + 4} />
      </g>

      {A.map((cells, r) =>
        cells.map((cell, c) => (
          <Fade key={`${r}:${c}`} show to={opacityAt(r, c)}>
            <SvgNumber value={cell} x={cellX(c)} y={cellY(r)} />
          </Fade>
        )),
      )}

      <Fade show={reached('hit')} start={0.2}>
        <SvgText
          x={STAGE_WIDTH / 2}
          y={yAnswer}
          size={20}
          className="fill-good font-matrix font-semibold tabular-nums"
        >
          {`${name} = ${rationalText(value)}`}
        </SvgText>
      </Fade>
      {swapped && (
        <Fade show={reached('compare')} start={0.2}>
          <SvgText
            x={STAGE_WIDTH / 2}
            y={yAnswer + 30}
            size={16}
            className="fill-warn font-matrix tabular-nums"
          >
            {`${swapped.name} = ${rationalText(swapped.value)}`}
          </SvgText>
        </Fade>
      )}
    </svg>
  );
}
