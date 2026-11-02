import * as m from 'motion/react-m';
import { useContext, type ReactNode } from 'react';
import {
  Band,
  Choices,
  Cross,
  HandText,
  Reveal,
  Stage,
  Struck,
  Tick,
  WIDTH,
  boxAt,
  fitted,
  matrixFont,
  useReveal,
  type Box,
} from '@/components/clip/kit';
import { th } from '@/lib/content/th';
import type { Dims, Matrix } from '@/lib/core/types';
import { dimsLabel } from '@/lib/topics/matrix/format';
import type { DimensionBeat, SceneSpecOf } from '@/lib/topics/matrix/scenes/types';
import { BeatClockContext, SvgNumber, useTween } from './svg';

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

const copy = th.scenes.dimension;
const SIDE_LABELS = 62;
const TOP_LABELS = 48;
const GRID_HEIGHT = 190;

function studentLabel(student: SceneSpecOf<'dimension_match'>['params']['student']) {
  if (!student) return '';
  return student === 'undefined' ? th.scenes.player.undefined : dimsLabel(student);
}

/** A table with its cells drawn, whether or not it has numbers in them. */
function Table({ box, dims, values }: { box: Box; dims: Dims; values?: Matrix }) {
  const font = values ? matrixFont(values, box.cell, box.rowHeight) : 0;
  return (
    <g>
      {Array.from({ length: dims.rows }, (_, i) =>
        Array.from({ length: dims.cols }, (_, j) => (
          <g key={`${i}:${j}`}>
            <rect
              x={box.cx(j) - box.cell / 2 + 2}
              y={box.cy(i) - box.rowHeight / 2 + 2}
              width={box.cell - 4}
              height={box.rowHeight - 4}
              rx={5}
              strokeWidth={1.5}
              className="fill-sunken/60 stroke-line"
            />
            {values && <SvgNumber value={values[i][j]} x={box.cx(j)} y={box.cy(i)} size={font} />}
          </g>
        )),
      )}
    </g>
  );
}

/** Rows are counted as bands going down, then columns as bands going across, and each count lands below. */
function SingleBlock({ spec, beat }: Props) {
  const { first, values, labels, student, try: question } = spec.params;
  const trying = beat === 'try' || beat === 'try_done';
  const shape = trying && question ? question.first : first;
  const shown = trying && question ? question.values : values;

  const side = labels ? SIDE_LABELS : 14;
  const top = labels ? TOP_LABELS : 30;
  const cell = Math.min(64, (WIDTH - side - 14) / shape.cols);
  const rowHeight = Math.min(56, GRID_HEIGHT / shape.rows);
  const x0 = side + (WIDTH - side - 14 - shape.cols * cell) / 2 - 6;
  const box = boxAt(x0, top, shape.rows, shape.cols, cell, rowHeight);
  const low = top + shape.rows * rowHeight + 66;

  const counting = (name: DimensionBeat) => beat === name;
  const counted = (name: 'count_rows' | 'count_cols') =>
    spec.beats.indexOf(beat) >= spec.beats.indexOf(name) && !trying;

  return (
    <Stage>
      {Array.from({ length: first.rows }, (_, i) => (
        <Band
          key={`r${i}`}
          box={{
            x: box.cx(0) - cell / 2,
            y: box.cy(i) - rowHeight / 2 + 1,
            width: cell * shape.cols,
            height: rowHeight - 2,
          }}
          tone="row"
          show={counting('count_rows')}
          start={0.1 + 0.2 * i}
        />
      ))}
      {Array.from({ length: first.cols }, (_, j) => (
        <Band
          key={`c${j}`}
          box={{
            x: box.cx(j) - cell / 2 + 1,
            y: box.cy(0) - rowHeight / 2,
            width: cell - 2,
            height: rowHeight * shape.rows,
          }}
          tone="col"
          show={counting('count_cols')}
          start={0.1 + 0.2 * j}
        />
      ))}

      <Table box={box} dims={shape} values={shown} />

      {labels?.rows.map((label, i) => (
        <HandText key={i} x={x0 - 4} y={box.cy(i)} size={15} anchor="end" className="fill-muted">
          {label}
        </HandText>
      ))}
      {labels?.cols.map((label, j) => (
        <HandText key={j} x={box.cx(j)} y={top - 16} size={15} className="fill-muted">
          {label}
        </HandText>
      ))}

      {Array.from({ length: first.rows }, (_, i) => (
        <Reveal key={i} show={counting('count_rows')} start={0.15 + 0.2 * i} pop>
          <circle cx={x0 + box.width + 2} cy={box.cy(i)} r={11} className="fill-cta" />
          <HandText x={x0 + box.width + 2} y={box.cy(i)} size={15} className="fill-on-cta">
            {i + 1}
          </HandText>
        </Reveal>
      ))}
      {Array.from({ length: first.cols }, (_, j) => (
        <Reveal key={j} show={counting('count_cols')} start={0.15 + 0.2 * j} pop>
          <circle cx={box.cx(j)} cy={box.y + box.height + 12} r={11} className="fill-brand" />
          <HandText x={box.cx(j)} y={box.y + box.height + 12} size={15} className="fill-on-brand">
            {j + 1}
          </HandText>
        </Reveal>
      ))}

      {/* ---- what they answered */}
      <Struck
        text={studentLabel(student)}
        y={low + 28}
        show={beat === 'compare'}
        start={0.2}
        size={56}
      />

      {/* ---- the count, one number at a time */}
      <Reveal show={counted('count_rows')} start={beat === 'count_rows' ? 0.7 : 0} pop>
        <HandText x={104} y={low + 20} size={56} className="fill-cta font-semibold">
          {first.rows}
        </HandText>
        <HandText x={104} y={low + 66} size={18} className="fill-muted">
          {copy.rows}
        </HandText>
      </Reveal>
      <Reveal show={counted('count_cols')} start={beat === 'count_cols' ? 0.7 : 0} pop>
        <HandText x={236} y={low + 20} size={56} className="fill-brand font-semibold">
          {first.cols}
        </HandText>
        <HandText x={236} y={low + 66} size={18} className="fill-muted">
          {copy.cols}
        </HandText>
      </Reveal>
      <Reveal show={counted('count_cols')} start={beat === 'count_cols' ? 0.74 : 0}>
        <HandText x={170} y={low + 20} size={36} className="fill-muted">
          ×
        </HandText>
      </Reveal>

      {/* ---- their turn */}
      {question && beat === 'try' && (
        <Choices options={question.options} right={question.right} y={low + 4} />
      )}
      {question && (
        <Reveal show={beat === 'try_done'} start={0.1} pop>
          <HandText x={WIDTH / 2} y={low + 30} size={56} className="fill-cta font-semibold">
            {question.options[question.right]}
          </HandText>
        </Reveal>
      )}
    </Stage>
  );
}

const BLOCK_TOP = 34;
const BLOCK_HEIGHT = 112;
const BLOCK_WIDTH = 132;
const TILE_WIDTH = 124;
const TILE_HEIGHT = 58;
/** How far the tiles of a product move in, so that the two inner numbers end up side by side. */
const TILE_MEET = 12;

function blockCell(...dims: Dims[]) {
  const rows = Math.max(...dims.map((shape) => shape.rows));
  const cols = Math.max(...dims.map((shape) => shape.cols));
  return Math.min(26, BLOCK_HEIGHT / rows, BLOCK_WIDTH / cols);
}

function Block({
  dims,
  x,
  y,
  cell,
  flagged,
}: {
  dims: Dims;
  x: number;
  y: number;
  cell: number;
  /** Red for a cell with nothing to pair with. */
  flagged?(i: number, j: number): boolean;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {Array.from({ length: dims.rows }, (_, i) =>
        Array.from({ length: dims.cols }, (_, j) => (
          <rect
            key={`${i}:${j}`}
            x={j * cell + 1.5}
            y={i * cell + 1.5}
            width={cell - 3}
            height={cell - 3}
            rx={3}
            strokeWidth={1}
            className={flagged?.(i, j) ? 'fill-warn/60 stroke-warn' : 'fill-brand/25 stroke-edge'}
          />
        )),
      )}
    </g>
  );
}

/** Moves to where it should be for the beat, without fading. */
function Slide({
  x,
  y,
  start,
  children,
}: {
  x: number;
  y: number;
  start?: number;
  children: ReactNode;
}) {
  const tween = useTween();
  return (
    <m.g initial={false} animate={{ x, y }} transition={tween(start, 0.3)}>
      {children}
    </m.g>
  );
}

/** A domino: its two numbers are what the rule looks at. */
function Tile({
  dims,
  name,
  innerTone,
  side,
}: {
  dims: Dims;
  name?: string;
  /** Lights up the number that faces the other tile. */
  innerTone?: string;
  side?: 'left' | 'right';
}) {
  return (
    <g>
      {name && (
        <HandText x={0} y={-TILE_HEIGHT / 2 - 12} size={15} className="fill-muted">
          {name}
        </HandText>
      )}
      <g className="paper">
        <rect
          x={-TILE_WIDTH / 2}
          y={-TILE_HEIGHT / 2}
          width={TILE_WIDTH}
          height={TILE_HEIGHT}
          rx={10}
          className="fill-surface"
          style={{ filter: 'drop-shadow(0 3px 5px rgb(0 0 0 / 0.35))' }}
        />
        <HandText
          x={-TILE_WIDTH / 4 - 4}
          y={0}
          size={34}
          className={side === 'right' && innerTone ? innerTone : 'fill-ink'}
        >
          {dims.rows}
        </HandText>
        <HandText x={0} y={0} size={22} className="fill-muted">
          ×
        </HandText>
        <HandText
          x={TILE_WIDTH / 4 + 4}
          y={0}
          size={34}
          className={side === 'left' && innerTone ? innerTone : 'fill-ink'}
        >
          {dims.cols}
        </HandText>
      </g>
    </g>
  );
}

/** A number leaving a tile for the result, unseen until it sets off. */
function Travelling({
  from,
  to,
  show,
  start,
  children,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  show: boolean;
  start: number;
  children: ReactNode;
}) {
  const reveal = useReveal();
  const { still } = useContext(BeatClockContext);
  return (
    <m.g
      initial={false}
      animate={show ? { ...to, opacity: 1 } : { ...from, opacity: 0 }}
      transition={show && !still ? reveal(true, start, 0.3) : { duration: 0 }}
    >
      {children}
    </m.g>
  );
}

/** Add and multiply: two blocks, each with its dims on a tile, and the check on the numbers that matter. */
function PairBlocks({ spec, beat }: Props) {
  const { op, first, second, names, fits, result, student, try: question } = spec.params;
  if (!second) return null;
  const trying = beat === 'try' || beat === 'try_done';
  const checked = beat === 'check' || beat === 'result';

  const cell = blockCell(first, second);
  const blockY = (dims: Dims) => BLOCK_TOP + (BLOCK_HEIGHT - dims.rows * cell) / 2;
  const leftX = 92 - (first.cols * cell) / 2;
  const rightX = 248 - (second.cols * cell) / 2;
  const tileY = BLOCK_TOP + BLOCK_HEIGHT + 56;
  const lowY = tileY + TILE_HEIGHT / 2;

  const adding = op === 'add';
  const onTop = adding && checked;
  // On top of the first, so a cell with nothing under it is plain to see.
  const secondX = onTop ? leftX + 78 : rightX;
  const outside = (i: number, j: number) => onTop && (i >= first.rows || j >= first.cols);
  const meeting = !adding && checked;
  const tone = fits ? 'fill-good' : 'fill-warn';

  if (trying && question?.second) {
    const askedName = question.names;
    return (
      <Stage>
        <g transform={`translate(${WIDTH / 2 - 66} 104)`}>
          <Tile dims={question.first} name={askedName?.first} />
        </g>
        <g transform={`translate(${WIDTH / 2 + 66} 104)`}>
          <Tile dims={question.second} name={askedName?.second} />
        </g>
        {beat === 'try' && <Choices options={question.options} right={question.right} y={196} />}
        <Reveal show={beat === 'try_done'} start={0.1} pop>
          <HandText
            x={WIDTH / 2}
            y={236}
            size={fitted(question.options[question.right], 60)}
            className="fill-cta font-semibold"
          >
            {question.options[question.right]}
          </HandText>
        </Reveal>
        <Tick x={WIDTH / 2} y={306} size={26} show={beat === 'try_done'} start={0.35} />
      </Stage>
    );
  }

  return (
    <Stage>
      <HandText x={92} y={16} size={16} className="fill-muted">
        {names.first}
      </HandText>
      <Reveal show={!onTop}>
        <HandText x={248} y={16} size={16} className="fill-muted">
          {names.second}
        </HandText>
      </Reveal>

      <Block dims={first} x={leftX} y={blockY(first)} cell={cell} />
      <Slide x={secondX} y={blockY(onTop ? first : second)}>
        <Block dims={second} x={0} y={0} cell={cell} flagged={outside} />
      </Slide>

      {/* ---- the two tiles */}
      <Slide x={meeting ? 92 + TILE_MEET : 92} y={tileY}>
        <Tile dims={first} innerTone={meeting ? tone : undefined} side="left" />
      </Slide>
      <Slide x={meeting ? 248 - TILE_MEET : 248} y={tileY}>
        <Tile dims={second} innerTone={meeting ? tone : undefined} side="right" />
      </Slide>
      {meeting && (
        <Reveal show start={0.3} pop>
          <HandText
            x={WIDTH / 2}
            y={tileY - TILE_HEIGHT / 2 - 16}
            size={30}
            className={`${tone} font-semibold`}
          >
            {fits ? '=' : '≠'}
          </HandText>
        </Reveal>
      )}
      {adding && (
        <Reveal show={checked} start={0.3} pop>
          <HandText x={WIDTH / 2} y={tileY} size={30} className={`${tone} font-semibold`}>
            {fits ? '=' : '≠'}
          </HandText>
        </Reveal>
      )}

      {/* ---- what they answered */}
      {student && (
        <Struck
          text={studentLabel(student)}
          y={lowY + 58}
          show={beat === 'compare'}
          start={0.2}
          size={44}
        />
      )}

      {/* ---- what comes of it */}
      {result ? (
        !adding ? (
          <>
            <Travelling
              from={{ x: 92 + TILE_MEET - TILE_WIDTH / 4 - 4, y: tileY }}
              to={{ x: WIDTH / 2 - 44, y: lowY + 58 }}
              show={beat === 'result'}
              start={0.1}
            >
              <HandText x={0} y={0} size={52} className="fill-cta font-semibold">
                {result.rows}
              </HandText>
            </Travelling>
            <Travelling
              from={{ x: 248 - TILE_MEET + TILE_WIDTH / 4 + 4, y: tileY }}
              to={{ x: WIDTH / 2 + 44, y: lowY + 58 }}
              show={beat === 'result'}
              start={0.1}
            >
              <HandText x={0} y={0} size={52} className="fill-cta font-semibold">
                {result.cols}
              </HandText>
            </Travelling>
            <Reveal show={beat === 'result'} start={0.4}>
              <HandText x={WIDTH / 2} y={lowY + 58} size={30} className="fill-muted">
                ×
              </HandText>
            </Reveal>
          </>
        ) : (
          <Tick x={WIDTH / 2} y={lowY + 58} size={30} show={beat === 'result'} start={0.15} />
        )
      ) : (
        <>
          <Cross x={WIDTH / 2} y={lowY + 40} size={20} show={beat === 'result'} start={0.1} />
          <Reveal show={beat === 'result'} start={0.3}>
            <HandText x={WIDTH / 2} y={lowY + 90} size={28} className="fill-warn font-semibold">
              {th.scenes.player.undefined}
            </HandText>
          </Reveal>
        </>
      )}
    </Stage>
  );
}
