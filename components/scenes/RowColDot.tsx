import type { RowColBeat, SceneSpecOf } from '@/lib/topics/matrix/scenes/types';
import {
  Fade,
  Highlight,
  Place,
  STAGE_WIDTH,
  SvgBracket,
  SvgNumber,
  SvgText,
  factorText,
  matrixBox,
} from './svg';

const ORDER: RowColBeat[] = [
  'compare',
  'setup',
  'pick_row',
  'pick_col',
  'pair',
  'multiply',
  'sum',
  'place',
  'fill_rest',
];

const SIZE = 16;
const TOP = 26;
const SLOT = 70;
const SUM_WIDTH = 58;

interface Props {
  spec: SceneSpecOf<'row_col_dot'>;
  beat: RowColBeat;
}

/** SCENES §3.1. Every number is already in the spec, so this only decides where each one sits. */
export function RowColDot({ spec, beat }: Props) {
  const { left, right, product, names, cell, terms, wrong } = spec.params;
  const reached = (name: RowColBeat) => ORDER.indexOf(beat) >= ORDER.indexOf(name);
  const comparing = beat === 'compare';
  const [row, col] = [cell[0] - 1, cell[1] - 1];

  const leftBox = matrixBox(left, SIZE);
  const rightBox = matrixBox(right, SIZE);
  const productBox = matrixBox(product, SIZE);

  const gap = 8;
  const equalsWidth = 22;
  const total = leftBox.width + gap + rightBox.width + equalsWidth + productBox.width;
  const width = Math.max(STAGE_WIDTH, total + 4);
  const leftX = (width - total) / 2;
  const rightX = leftX + leftBox.width + gap;
  const equalsX = rightX + rightBox.width + equalsWidth / 2;
  const productX = rightX + rightBox.width + equalsWidth;

  const matricesHeight = Math.max(leftBox.height, rightBox.height, productBox.height);
  const yA = TOP + matricesHeight + 28;
  const yB = yA + 46;
  const yP = yB + 40;
  const height = yP + 24;

  const workWidth = terms.length * SLOT + SUM_WIDTH;
  const slotX = (k: number) => (width - workWidth) / 2 + SLOT * (k + 0.5);
  const sumX = (width - workWidth) / 2 + terms.length * SLOT + SUM_WIDTH / 2 + 8;

  const value = product[row][col];
  const inPlay = reached('setup') && !reached('fill_rest');
  const rowPicked = inPlay && reached('pick_row');
  const colPicked = inPlay && reached('pick_col');

  const wrongLeft = new Set(wrong?.leftCells.map(([i, j]) => `${i - 1}:${j - 1}`));
  const wrongRight = new Set(wrong?.rightCells.map(([i, j]) => `${i - 1}:${j - 1}`));
  const leftOpacity = (i: number, j: number) => {
    if (comparing) return wrongLeft.has(`${i}:${j}`) ? 1 : 0.3;
    return rowPicked && i !== row ? 0.3 : 1;
  };
  const rightOpacity = (i: number, j: number) => {
    if (comparing) return wrongRight.has(`${i}:${j}`) ? 1 : 0.3;
    return colPicked && j !== col ? 0.3 : 1;
  };

  const wrongText =
    wrong &&
    `${wrong.terms.map(({ a, b }) => `${factorText(a)}×${factorText(b)}`).join(' + ')} = ${factorText(wrong.value)}`;
  const wrongSize = wrongText ? Math.min(15, (width - 24) / (wrongText.length * 0.56)) : 15;
  const wrongWidth = wrongText ? wrongText.length * wrongSize * 0.56 : 0;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" aria-hidden="true">
      <g transform={`translate(${leftX} ${TOP})`}>
        <SvgText x={leftBox.width / 2} y={-13} size={13} className="fill-muted font-medium">
          {names.left}
        </SvgText>
        {wrong?.leftCells.map(([i, j]) => (
          <Highlight
            key={`${i}:${j}`}
            x={leftBox.cellX(j - 1) - leftBox.colWidth / 2}
            y={leftBox.cellY(i - 1) - leftBox.rowHeight / 2}
            width={leftBox.colWidth}
            height={leftBox.rowHeight}
            show={comparing}
            tone="warn"
          />
        ))}
        <Highlight
          x={6}
          y={leftBox.cellY(row) - leftBox.rowHeight / 2}
          width={leftBox.width - 12}
          height={leftBox.rowHeight}
          show={rowPicked}
        />
        <SvgBracket width={leftBox.width} height={leftBox.height} />
        {left.map((cells, i) =>
          cells.map((number, j) => (
            <Fade key={`${i}:${j}`} show to={leftOpacity(i, j)}>
              <SvgNumber value={number} x={leftBox.cellX(j)} y={leftBox.cellY(i)} size={SIZE} />
            </Fade>
          )),
        )}
      </g>

      <g transform={`translate(${rightX} ${TOP})`}>
        <SvgText x={rightBox.width / 2} y={-13} size={13} className="fill-muted font-medium">
          {names.right}
        </SvgText>
        {wrong?.rightCells.map(([i, j]) => (
          <Highlight
            key={`${i}:${j}`}
            x={rightBox.cellX(j - 1) - rightBox.colWidth / 2}
            y={rightBox.cellY(i - 1) - rightBox.rowHeight / 2}
            width={rightBox.colWidth}
            height={rightBox.rowHeight}
            show={comparing}
            tone="warn"
          />
        ))}
        <Highlight
          x={rightBox.cellX(col) - rightBox.colWidth / 2}
          y={2}
          width={rightBox.colWidth}
          height={rightBox.height - 4}
          show={colPicked}
        />
        <SvgBracket width={rightBox.width} height={rightBox.height} />
        {right.map((cells, i) =>
          cells.map((number, j) => (
            <Fade key={`${i}:${j}`} show to={rightOpacity(i, j)}>
              <SvgNumber value={number} x={rightBox.cellX(j)} y={rightBox.cellY(i)} size={SIZE} />
            </Fade>
          )),
        )}
      </g>

      <SvgText x={equalsX} y={TOP + matricesHeight / 2} className="fill-muted font-matrix">
        =
      </SvgText>

      <g transform={`translate(${productX} ${TOP})`}>
        <SvgText x={productBox.width / 2} y={-13} size={13} className="fill-muted font-medium">
          {names.result}
        </SvgText>
        <Highlight
          x={productBox.cellX(col) - productBox.colWidth / 2}
          y={productBox.cellY(row) - productBox.rowHeight / 2}
          width={productBox.colWidth}
          height={productBox.rowHeight}
          show={inPlay}
        />
        <SvgBracket width={productBox.width} height={productBox.height} />
        {product.map((cells, i) =>
          cells.map((number, j) =>
            i === row && j === col ? null : (
              <Fade key={`${i}:${j}`} show={reached('fill_rest')} start={0.1 + 0.1 * (i + j)}>
                <SvgNumber
                  value={number}
                  x={productBox.cellX(j)}
                  y={productBox.cellY(i)}
                  size={SIZE}
                />
              </Fade>
            ),
          ),
        )}
      </g>

      {wrongText && (
        <Fade show={comparing}>
          <SvgText
            x={width / 2}
            y={yA + 22}
            size={wrongSize}
            className="fill-warn font-matrix tabular-nums"
          >
            {wrongText}
          </SvgText>
          <line
            x1={width / 2 - wrongWidth / 2}
            x2={width / 2 + wrongWidth / 2}
            y1={yA + 22}
            y2={yA + 22}
            strokeWidth={1}
            className="stroke-warn"
          />
        </Fade>
      )}

      {/* Faint once it is done, so the eye goes to the finished product. */}
      <Fade show to={reached('fill_rest') ? 0.3 : 1}>
        {terms.map(({ a, b, product: termProduct }, k) => (
          <g key={k}>
            <Fade show={reached('pair')} start={0.35}>
              <line
                x1={slotX(k)}
                x2={slotX(k)}
                y1={yA + 12}
                y2={yB - 12}
                strokeWidth={1.5}
                className="stroke-edge"
              />
              <SvgText
                x={slotX(k) + 10}
                y={(yA + yB) / 2}
                size={13}
                className="fill-muted font-matrix"
              >
                ×
              </SvgText>
            </Fade>
            <Place
              x={reached('pair') ? slotX(k) : leftX + leftBox.cellX(k)}
              y={reached('pair') ? yA : TOP + leftBox.cellY(row)}
              opacity={reached('pair') ? 1 : 0}
              start={0.05 * k}
            >
              <SvgNumber value={a} size={SIZE} />
            </Place>
            <Place
              x={reached('pair') ? slotX(k) : rightX + rightBox.cellX(col)}
              y={reached('pair') ? yB : TOP + rightBox.cellY(k)}
              opacity={reached('pair') ? 1 : 0}
              start={0.05 * k}
            >
              <SvgNumber value={b} size={SIZE} />
            </Place>
            <Fade show={reached('multiply')} start={0.1 + 0.2 * k} length={0.25}>
              <SvgNumber
                value={termProduct}
                x={slotX(k)}
                y={yP}
                size={SIZE}
                className="fill-brand"
              />
            </Fade>
            {k > 0 && (
              <Fade show={reached('sum')}>
                <SvgText x={slotX(k) - SLOT / 2} y={yP} className="fill-muted font-matrix">
                  +
                </SvgText>
              </Fade>
            )}
          </g>
        ))}
        <Fade show={reached('sum')} start={0.25}>
          <SvgText x={sumX - 26} y={yP} className="fill-muted font-matrix">
            =
          </SvgText>
          <SvgNumber value={value} x={sumX} y={yP} size={SIZE} className="fill-ink" />
        </Fade>
      </Fade>

      <Place
        x={reached('place') ? productX + productBox.cellX(col) : sumX}
        y={reached('place') ? TOP + productBox.cellY(row) : yP}
        opacity={reached('place') ? 1 : 0}
      >
        <SvgNumber value={value} size={SIZE} className="fill-brand" />
      </Place>
    </svg>
  );
}
