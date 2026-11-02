import { useContext, useState } from 'react';
import {
  Band,
  BoardMatrix,
  ClipActionsContext,
  HandText,
  Reveal,
  Ring,
  Stage,
  Struck,
  TapArea,
  WIDTH,
  WrongFlash,
  boxAt,
  cellRect,
  colRect,
  rowRect,
  type Rect,
} from '@/components/clip/kit';
import { rationalText, subscript } from '@/lib/topics/matrix/format';
import type { CellBeat, SceneSpecOf } from '@/lib/topics/matrix/scenes/types';

const ORDER: CellBeat[] = ['compare', 'row', 'col', 'hit', 'try', 'try_done'];

const TOP = 92;
const LABELS = 26;

interface Props {
  spec: SceneSpecOf<'cell_locator'>;
  beat: CellBeat;
}

/** SCENES §4. The row, then the column, then the one cell they share. */
export function CellLocator({ spec, beat }: Props) {
  const { A, i, j, name, value, swapped } = spec.params;
  const actions = useContext(ClipActionsContext);
  const [flash, setFlash] = useState<{ box: Rect; n: number } | null>(null);
  const reached = (step: CellBeat) => ORDER.indexOf(beat) >= ORDER.indexOf(step);
  const [row, col] = [i - 1, j - 1];

  const rows = A.length;
  const cols = A[0].length;
  const cell = Math.min(68, (WIDTH - 2 * LABELS - 24) / cols);
  const rowHeight = Math.min(58, 180 / rows);
  const box = boxAt((WIDTH - cols * cell - 12 + LABELS) / 2, TOP, rows, cols, cell, rowHeight);
  const low = TOP + rows * rowHeight + 50;

  const trying = reached('try');
  const opacityAt = (r: number, c: number) => {
    if (beat === 'compare') return r === col && c === row ? 1 : 0.35;
    if (trying) return 1;
    if (reached('hit')) return r === row && c === col ? 1 : 0.3;
    if (reached('col')) return r === row || c === col ? 1 : 0.3;
    if (reached('row')) return r === row ? 1 : 0.3;
    return 1;
  };

  const askedName = trying && swapped ? swapped.name : name;
  const tryRow = col;
  const tryCol = row;

  const pick = (r: number, c: number) => {
    if (r === tryRow && c === tryCol) {
      setFlash(null);
      actions.right();
      return;
    }
    setFlash((last) => ({ box: cellRect(box, r, c), n: (last?.n ?? 0) + 1 }));
    actions.wrong();
  };

  const rowSign = trying ? tryRow + 1 : i;
  const colSign = trying ? tryCol + 1 : j;

  return (
    <Stage>
      {/* ---- the name of the cell: its first small number is the row, and its second is the column */}
      <text x={WIDTH / 2} y={48} textAnchor="middle" className="font-hand" fontSize={58}>
        <tspan className="fill-ink">{askedName[0]}</tspan>
        <tspan fontSize={44} dy={8} className={reached('row') ? 'fill-cta' : 'fill-muted'}>
          {subscript(rowSign)}
        </tspan>
        <tspan fontSize={44} className={reached('col') ? 'fill-brand' : 'fill-muted'}>
          {subscript(colSign)}
        </tspan>
      </text>

      <Band box={rowRect(box, row)} tone="row" show={beat === 'row' || beat === 'col'} />
      <Band box={colRect(box, col)} tone="col" show={beat === 'col'} />
      {swapped && (
        <Band box={cellRect(box, col, row)} tone="warn" show={beat === 'compare'} start={0.15} />
      )}

      <BoardMatrix value={A} box={box} opacity={opacityAt} />

      {Array.from({ length: cols }, (_, c) => (
        <HandText
          key={c}
          x={box.cx(c)}
          y={TOP - 13}
          size={15}
          className={c === col && reached('col') && !trying ? 'fill-brand' : 'fill-muted'}
        >
          {c + 1}
        </HandText>
      ))}
      {Array.from({ length: rows }, (_, r) => (
        <HandText
          key={r}
          x={box.x - 14}
          y={box.cy(r)}
          size={15}
          className={r === row && reached('row') && !trying ? 'fill-cta' : 'fill-muted'}
        >
          {r + 1}
        </HandText>
      ))}

      <Ring
        cx={box.cx(col)}
        cy={box.cy(row)}
        r={Math.min(cell, rowHeight) * 0.46}
        tone="good"
        show={beat === 'hit'}
        start={0.1}
      />
      <Reveal show={beat === 'hit'} start={0.3} pop>
        <HandText x={WIDTH / 2} y={low + 20} size={44} className="fill-cta font-semibold">
          {`${name} = ${rationalText(value)}`}
        </HandText>
      </Reveal>

      {swapped && (
        <>
          <Struck
            text={`${swapped.name} = ${rationalText(swapped.value)}`}
            y={low + 20}
            show={beat === 'compare'}
            start={0.3}
            size={44}
          />
          {beat === 'try' &&
            A.map((cells, r) =>
              cells.map((_, c) => (
                <TapArea
                  key={`${r}:${c}`}
                  hit={{
                    x: box.cx(c) - cell / 2,
                    y: box.cy(r) - rowHeight / 2,
                    width: cell,
                    height: rowHeight,
                  }}
                  edge={cellRect(box, r, c)}
                  tone="row"
                  label={`a${subscript(r + 1)}${subscript(c + 1)}`}
                  onTap={() => pick(r, c)}
                />
              )),
            )}
          {flash && <WrongFlash box={flash.box} n={flash.n} />}
          <Ring
            cx={box.cx(tryCol)}
            cy={box.cy(tryRow)}
            r={Math.min(cell, rowHeight) * 0.46}
            tone="good"
            show={beat === 'try_done'}
          />
          <Reveal show={beat === 'try_done'} start={0.2} pop>
            <HandText x={WIDTH / 2} y={low + 20} size={44} className="fill-cta font-semibold">
              {`${swapped.name} = ${rationalText(swapped.value)}`}
            </HandText>
          </Reveal>
        </>
      )}
    </Stage>
  );
}
