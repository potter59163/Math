import { Choices, HandText, Reveal, Stage, WIDTH } from '@/components/clip/kit';
import { surdVecText, vecText } from '@/lib/topics/vector/format';
import type { CrossBeat, VectorSceneOf } from '@/lib/topics/vector/scenes/types';
import {
  Arrow,
  Column,
  EntryText,
  SideBySide,
  VecName,
  WorkLine,
  columnBox,
  frameFor,
  toNums,
} from './kit';
import { Line } from './Line';

interface Props {
  spec: VectorSceneOf<'cross_cover'>;
  beat: CrossBeat;
}

const CELL_W = 58;
const CELL_H = 36;
const LEFT = 52;
const TOP = 46;
const SIZE = 19;
const COVERS: CrossBeat[] = ['cover_i', 'cover_j', 'cover_k'];
const AXES = ['i', 'j', 'k'];
const SIGNS = ['+', '−', '+'];

/** VECTORS §5 `cross_cover`. The i j k table, one column covered at a time, signs + − +. */
export function CrossCover({ spec, beat }: Props) {
  const {
    first,
    second,
    names,
    lines,
    result,
    checkLines,
    flipped,
    mistake,
    student,
    studentCheck,
    try: question,
  } = spec.params;
  const now = spec.beats.indexOf(beat);
  const seen = (step: CrossBeat) =>
    spec.beats.indexOf(step) >= 0 && now >= spec.beats.indexOf(step);
  const covering = COVERS.indexOf(beat);
  const comparing = beat === 'compare';
  const flipping = beat === 'flip';
  const cx = (col: number) => LEFT + CELL_W * (col + 0.5);
  const cy = (row: number) => TOP + CELL_H * (row + 0.5);
  const rows = [AXES, first, second];
  const done = (i: number) => seen(COVERS[i]);
  const product = `${names[0]} × ${names[1]}`;
  const resultBox = columnBox(result, 284, TOP + 4, SIZE);
  const others = (col: number) => [0, 1, 2].filter((c) => c !== col);
  const signLit = covering === 1 || ((comparing || beat === 'try') && mistake === 'middle_sign');

  // The picture of the order beat: both factors, their product, and the product the other way round.
  const longest = Math.max(...[first, second].map((v) => Math.hypot(...toNums(v))));
  const shrink = (v: number[]) => {
    const size = Math.hypot(...v) || 1;
    return v.map((part) => (part / size) * longest);
  };
  const up = shrink(toNums(result));
  const down = shrink(toNums(flipped));
  const O = [0, 0, 0];
  const frame = frameFor(
    [O, toNums(first), toNums(second), up, down],
    { x: 50, y: 70, width: 240, height: 250 },
    { maxUnit: 40 },
  );

  return (
    <Stage>
      {/* ---- the table: i j k over the two factors */}
      <Reveal show={!flipping}>
        {SIGNS.map((sign, col) => (
          <Reveal key={col} show={seen('cover_i') || comparing} start={0.1 * col}>
            <HandText
              x={cx(col)}
              y={TOP - 20}
              size={22}
              className={`font-semibold ${col === 1 && signLit ? 'fill-warn' : 'fill-muted'}`}
            >
              {sign}
            </HandText>
          </Reveal>
        ))}
        <line
          x1={LEFT}
          x2={LEFT + CELL_W * 3}
          y1={TOP + CELL_H}
          y2={TOP + CELL_H}
          strokeWidth={1}
          className="stroke-line"
        />
        {rows.map((cells, row) =>
          cells.map((cell, col) => (
            <EntryText
              key={`${row}:${col}`}
              entry={cell}
              x={cx(col)}
              y={cy(row)}
              size={SIZE}
              className={
                row === 0
                  ? 'fill-muted font-semibold'
                  : covering >= 0 && col === covering
                    ? 'fill-edge'
                    : 'fill-ink'
              }
            />
          )),
        )}
        <HandText x={LEFT - 22} y={cy(1)} size={16} className="fill-cta">
          {names[0]}
        </HandText>
        <HandText x={LEFT - 22} y={cy(2)} size={16} className="fill-brand">
          {names[1]}
        </HandText>
        {/* the covered column, and the cross of what is left */}
        {[0, 1, 2].map((col) => (
          <g key={col}>
            <Reveal show={covering === col}>
              <rect
                x={cx(col) - CELL_W / 2 + 3}
                y={TOP + 2}
                width={CELL_W - 6}
                height={CELL_H * 3 - 4}
                rx={8}
                className="fill-marker/70"
              />
            </Reveal>
            <Line
              a={{ x: cx(others(col)[0]) + 12, y: cy(1) + 8 }}
              b={{ x: cx(others(col)[1]) - 12, y: cy(2) - 8 }}
              tone={col === 1 ? 'col' : 'row'}
              width={2.5}
              show={covering === col}
              start={0.25}
            />
            <Line
              a={{ x: cx(others(col)[0]) + 12, y: cy(2) - 8 }}
              b={{ x: cx(others(col)[1]) - 12, y: cy(1) + 8 }}
              tone="warn"
              width={2.5}
              show={covering === col}
              start={0.45}
            />
          </g>
        ))}
        <Column
          entries={result}
          box={resultBox}
          size={SIZE}
          label={
            <HandText x={0} y={0} size={15} className="fill-good">
              {product}
            </HandText>
          }
          entryClass={(i) => (done(i) && !comparing ? 'fill-good' : 'fill-transparent')}
          lit={covering >= 0 ? covering : undefined}
          tone="good"
        />
      </Reveal>

      {lines.map((line, i) => (
        <WorkLine
          key={i}
          text={line}
          y={214}
          show={covering === i}
          start={0.55}
          size={24}
          className={i === 1 ? 'fill-brand' : 'fill-cta'}
        />
      ))}
      <WorkLine
        text={`${product} = ${vecText(result)}`}
        y={214}
        show={beat === 'result' || beat === 'end'}
        size={26}
        className="fill-good font-semibold"
        pop={beat === 'result'}
      />
      {checkLines.map((line, i) => (
        <WorkLine
          key={i}
          text={line}
          y={258 + i * 38}
          show={beat === 'check'}
          start={0.2 + 0.3 * i}
          size={21}
          className="fill-good"
        />
      ))}
      {studentCheck && student && (
        <WorkLine
          text={`${surdVecText(student)} · ${names[0]} = ${studentCheck}`}
          y={336}
          show={beat === 'check' || comparing}
          start={0.6}
          size={20}
          className="fill-warn"
        />
      )}

      {/* ---- the order: v × u points the other way */}
      <Reveal show={flipping}>
        <Arrow
          from={frame.at(O)}
          to={frame.at(toNums(first))}
          tone="row"
          show={flipping}
          start={0.05}
          label={<VecName name={names[0]} size={15} className="fill-cta" />}
        />
        <Arrow
          from={frame.at(O)}
          to={frame.at(toNums(second))}
          tone="col"
          show={flipping}
          start={0.15}
          label={<VecName name={names[1]} size={15} className="fill-brand" />}
        />
        <Arrow
          from={frame.at(O)}
          to={frame.at(up)}
          tone="good"
          show={flipping}
          start={0.3}
          width={4}
          label={
            <HandText x={0} y={0} size={15} className="fill-good">
              {product}
            </HandText>
          }
        />
        <Arrow
          from={frame.at(O)}
          to={frame.at(down)}
          tone="warn"
          show={flipping}
          start={0.55}
          width={4}
          label={
            <HandText
              x={0}
              y={0}
              size={15}
              className="fill-warn"
            >{`${names[1]} × ${names[0]}`}</HandText>
          }
        />
        <HandText x={WIDTH / 2} y={30} size={24} className="fill-ink">
          {`${names[1]} × ${names[0]} = −(${product})`}
        </HandText>
      </Reveal>

      {student && (
        <SideBySide mine={surdVecText(student)} right={vecText(result)} show={comparing} y={226} />
      )}
      {question && beat === 'try' && (
        <Choices options={question.options} right={question.right} y={250} />
      )}
      <Reveal show={beat === 'end'} start={0.15}>
        <HandText x={WIDTH / 2} y={300} size={30} className="fill-cta font-semibold">
          + − +
        </HandText>
      </Reveal>
    </Stage>
  );
}
