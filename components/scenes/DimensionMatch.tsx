import { th } from '@/lib/content/th';
import type { Dims } from '@/lib/core/types';
import type { DimensionBeat, SceneSpecOf } from '@/lib/topics/matrix/scenes/types';
import { Fade, Place, STAGE_WIDTH, SvgNumber, SvgText } from './svg';

const ORDER: DimensionBeat[] = ['blocks', 'count_rows', 'count_cols', 'check', 'result'];

interface Props {
  spec: SceneSpecOf<'dimension_match'>;
  beat: DimensionBeat;
}

/** SCENES §3.2. */
export function DimensionMatch({ spec, beat }: Props) {
  return spec.params.op === 'single' ? (
    <SingleBlock spec={spec} beat={beat} />
  ) : (
    <PairBlocks spec={spec} beat={beat} />
  );
}

/** Rows are counted as horizontal bands, then columns as vertical ones, with the real cells inside. */
function SingleBlock({ spec, beat }: Props) {
  const { first, values, labels, student, result } = spec.params;
  const reached = (name: DimensionBeat) => ORDER.indexOf(beat) >= ORDER.indexOf(name);
  const counting = beat === 'count_rows' || beat === 'count_cols';

  const cellW = first.cols >= 4 ? 42 : 48;
  const cellH = 40;
  const gridW = first.cols * cellW;
  const gridH = first.rows * cellH;
  const side = labels ? 60 : 30;
  const top = labels ? 54 : 44;
  const x0 = Math.max(side, (STAGE_WIDTH - gridW + side - 30) / 2);
  const width = Math.max(STAGE_WIDTH, x0 + gridW + 12);
  const yResult = top + gridH + 46;
  const height = yResult + (student ? 48 : 24);

  const dimsText = `${first.rows} × ${first.cols}`;
  const studentText =
    student && student !== 'undefined' ? `${student.rows} × ${student.cols}` : undefined;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" aria-hidden="true">
      {Array.from({ length: first.rows }, (_, i) => (
        <Fade key={i} show={beat === 'count_rows'} start={0.1 + 0.15 * i} length={0.2}>
          <rect
            x={x0}
            y={top + i * cellH + 2}
            width={gridW}
            height={cellH - 4}
            rx={6}
            className="fill-brand-soft"
          />
        </Fade>
      ))}
      {Array.from({ length: first.cols }, (_, j) => (
        <Fade key={j} show={beat === 'count_cols'} start={0.1 + 0.15 * j} length={0.2}>
          <rect
            x={x0 + j * cellW + 2}
            y={top}
            width={cellW - 4}
            height={gridH}
            rx={6}
            className="fill-good-soft"
          />
        </Fade>
      ))}

      {Array.from({ length: first.rows }, (_, i) =>
        Array.from({ length: first.cols }, (_, j) => (
          <g key={`${i}:${j}`}>
            <rect
              x={x0 + j * cellW + 3}
              y={top + i * cellH + 3}
              width={cellW - 6}
              height={cellH - 6}
              rx={5}
              strokeWidth={1.5}
              className="fill-none stroke-edge"
            />
            {values && (
              <SvgNumber
                value={values[i][j]}
                x={x0 + (j + 0.5) * cellW}
                y={top + (i + 0.5) * cellH}
              />
            )}
          </g>
        )),
      )}

      {labels?.rows.map((label, i) => (
        <Fade key={i} show={!reached('result')}>
          <SvgText
            x={x0 - 8}
            y={top + (i + 0.5) * cellH}
            size={13}
            anchor="end"
            className="fill-muted font-medium"
          >
            {label}
          </SvgText>
        </Fade>
      ))}
      {labels?.cols.map((label, j) => (
        <Fade key={j} show={!reached('result')}>
          <SvgText
            x={x0 + (j + 0.5) * cellW}
            y={top - 14}
            size={13}
            className="fill-muted font-medium"
          >
            {label}
          </SvgText>
        </Fade>
      ))}

      {Array.from({ length: first.rows }, (_, i) => (
        <Fade key={i} show={counting && !labels} start={0.1 + 0.15 * i} length={0.2}>
          <SvgText
            x={x0 - 14}
            y={top + (i + 0.5) * cellH}
            size={14}
            className="fill-brand font-matrix font-semibold tabular-nums"
          >
            {i + 1}
          </SvgText>
        </Fade>
      ))}
      {Array.from({ length: first.cols }, (_, j) => (
        <Fade key={j} show={beat === 'count_cols' && !labels} start={0.1 + 0.15 * j} length={0.2}>
          <SvgText
            x={x0 + (j + 0.5) * cellW}
            y={top - 14}
            size={14}
            className="fill-good font-matrix font-semibold tabular-nums"
          >
            {j + 1}
          </SvgText>
        </Fade>
      ))}

      <Fade show={reached('result')}>
        <SvgText
          x={width / 2}
          y={yResult}
          size={24}
          className="fill-ink font-matrix font-semibold tabular-nums"
        >
          {result ? dimsText : ''}
        </SvgText>
      </Fade>
      {studentText && (
        <Fade show={reached('result')} start={0.3}>
          <StruckAnswer x={width / 2} y={yResult + 28} text={studentText} />
        </Fade>
      )}
    </svg>
  );
}

function StruckAnswer({ x, y, text }: { x: number; y: number; text: string }) {
  const label = th.scenes.player.student;
  const width = text.length * 8.4;
  return (
    <g>
      <SvgText x={x - 8} y={y} size={13} anchor="end" className="fill-muted font-medium">
        {label}
      </SvgText>
      <SvgText x={x} y={y} size={15} anchor="start" className="fill-warn font-matrix tabular-nums">
        {text}
      </SvgText>
      <line x1={x - 2} x2={x + width + 2} y1={y} y2={y} strokeWidth={1.5} className="stroke-warn" />
    </g>
  );
}

const BLOCK_CELL = 19;

function Block({ dims, x, y }: { dims: Dims; x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {Array.from({ length: dims.rows }, (_, i) =>
        Array.from({ length: dims.cols }, (_, j) => (
          <rect
            key={`${i}:${j}`}
            x={j * BLOCK_CELL + 1.5}
            y={i * BLOCK_CELL + 1.5}
            width={BLOCK_CELL - 3}
            height={BLOCK_CELL - 3}
            rx={3}
            className="fill-sunken stroke-edge"
            strokeWidth={1}
          />
        )),
      )}
    </g>
  );
}

const blockWidth = ({ cols }: Dims) => cols * BLOCK_CELL;
const blockHeight = ({ rows }: Dims) => rows * BLOCK_CELL;

/** Add and multiply: two blocks, their dims underneath, and the check on the numbers that matter. */
function PairBlocks({ spec, beat }: Props) {
  const { op, first, second, names, fits, result, student } = spec.params;
  if (!second) return null;
  const reached = (name: DimensionBeat) => ORDER.indexOf(beat) >= ORDER.indexOf(name);
  const checked = reached('check');
  const tone = fits ? 'good' : 'warn';

  const width = STAGE_WIDTH;
  const centers = [84, width - 84];
  const blocksTop = 30;
  const tallest = Math.max(blockHeight(first), blockHeight(second));
  const yDims = blocksTop + tallest + 28;
  const yResultBlock = yDims + 44;
  const resultHeight = result ? blockHeight(result) : 0;
  const yResultDims = yResultBlock + resultHeight + 24;
  const height = yResultDims + (student ? 56 : 28);

  const digit = 19;
  const dimX = (center: number, part: 'rows' | 'cols') =>
    center + (part === 'rows' ? -digit : digit);

  const innerA = dimX(centers[0], 'cols');
  const innerB = dimX(centers[1], 'rows');

  const studentText =
    student === 'undefined'
      ? th.scenes.player.undefined
      : student && `${student.rows} × ${student.cols}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" aria-hidden="true">
      {[first, second].map((dims, index) => (
        <g key={index}>
          <SvgText x={centers[index]} y={14} size={14} className="fill-muted font-semibold">
            {index === 0 ? names.first : names.second}
          </SvgText>
          <Block
            dims={dims}
            x={centers[index] - blockWidth(dims) / 2}
            y={blocksTop + (tallest - blockHeight(dims)) / 2}
          />
        </g>
      ))}

      {op === 'mult' ? (
        <Fade show={checked}>
          <rect
            x={innerA - 13}
            y={yDims - 15}
            width={26}
            height={30}
            rx={7}
            className={fits ? 'fill-good-soft' : 'fill-warn-soft'}
          />
          <rect
            x={innerB - 13}
            y={yDims - 15}
            width={26}
            height={30}
            rx={7}
            className={fits ? 'fill-good-soft' : 'fill-warn-soft'}
          />
          <line
            x1={innerA + 15}
            x2={innerB - 15}
            y1={yDims}
            y2={yDims}
            strokeWidth={2}
            strokeDasharray={fits ? undefined : '4 4'}
            className={fits ? 'stroke-good' : 'stroke-warn'}
          />
          <SvgText
            x={(innerA + innerB) / 2}
            y={yDims - 12}
            size={15}
            className={`font-matrix font-semibold ${fits ? 'fill-good' : 'fill-warn'}`}
          >
            {fits ? '=' : '≠'}
          </SvgText>
        </Fade>
      ) : (
        <Fade show={checked}>
          <SvgText
            x={(centers[0] + centers[1]) / 2}
            y={yDims}
            size={18}
            className={`font-matrix font-semibold ${fits ? 'fill-good' : 'fill-warn'}`}
          >
            {fits ? '=' : '≠'}
          </SvgText>
        </Fade>
      )}

      {[first, second].map((dims, index) => {
        const outer = op === 'mult' && (index === 0 ? 'rows' : 'cols');
        const toneClass = (part: 'rows' | 'cols') => {
          if (!checked) return 'fill-ink';
          if (op === 'add') return tone === 'good' ? 'fill-good' : 'fill-warn';
          if (part === outer) return reached('result') && fits ? 'fill-brand' : 'fill-muted';
          return tone === 'good' ? 'fill-good' : 'fill-warn';
        };
        return (
          <g
            key={index}
            className="font-matrix font-semibold tabular-nums"
            fontSize={18}
            textAnchor="middle"
          >
            <text
              x={dimX(centers[index], 'rows')}
              y={yDims}
              dy="0.35em"
              className={toneClass('rows')}
            >
              {dims.rows}
            </text>
            <text x={centers[index]} y={yDims} dy="0.35em" className="fill-muted">
              ×
            </text>
            <text
              x={dimX(centers[index], 'cols')}
              y={yDims}
              dy="0.35em"
              className={toneClass('cols')}
            >
              {dims.cols}
            </text>
          </g>
        );
      })}

      {result ? (
        <>
          <Fade show={reached('result')} start={0.35}>
            <Block dims={result} x={width / 2 - blockWidth(result) / 2} y={yResultBlock} />
            <SvgText x={width / 2} y={yResultDims} size={18} className="fill-muted font-matrix">
              ×
            </SvgText>
          </Fade>
          {/* The outer numbers travel down and become the result's dims (SCENES §3.2). */}
          <Place
            x={reached('result') ? dimX(width / 2, 'rows') : dimX(centers[0], 'rows')}
            y={reached('result') ? yResultDims : yDims}
            opacity={reached('result') ? 1 : 0}
          >
            <SvgText size={18} className="fill-brand font-matrix font-semibold tabular-nums">
              {result.rows}
            </SvgText>
          </Place>
          <Place
            x={reached('result') ? dimX(width / 2, 'cols') : dimX(centers[1], 'cols')}
            y={reached('result') ? yResultDims : yDims}
            opacity={reached('result') ? 1 : 0}
          >
            <SvgText size={18} className="fill-brand font-matrix font-semibold tabular-nums">
              {result.cols}
            </SvgText>
          </Place>
        </>
      ) : (
        <Fade show={reached('result')} start={0.2}>
          <SvgText
            x={width / 2}
            y={yResultBlock + 10}
            size={18}
            className="fill-warn font-semibold"
          >
            {th.scenes.player.undefined}
          </SvgText>
        </Fade>
      )}
      {studentText && (
        <Fade show={reached('result')} start={0.45}>
          <StruckAnswer
            x={width / 2 - 8}
            y={(result ? yResultDims : yResultBlock + 10) + 30}
            text={studentText}
          />
        </Fade>
      )}
    </svg>
  );
}
