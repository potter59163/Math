import { Choices, HandText, Reveal, Stage, Struck } from '@/components/clip/kit';
import { rationalText } from '@/lib/topics/vector/format';
import type { AreaBeat, VectorSceneOf } from '@/lib/topics/vector/scenes/types';
import { Arrow, SideBySide, VecName, WorkLine, frameFor, toNums, type XY } from './kit';
import { Line } from './Line';

interface Props {
  spec: VectorSceneOf<'area_volume'>;
  beat: AreaBeat;
}

const PICTURE = { x: 40, y: 14, width: 260, height: 190 };

const add = (...vs: number[][]) => vs[0].map((_, i) => vs.reduce((sum, v) => sum + v[i], 0));
const scaleTo = (v: number[], length: number) => {
  const size = Math.hypot(...v) || 1;
  return v.map((part) => (part / size) * length);
};
const dotN = (a: number[], b: number[]) => a.reduce((sum, part, i) => sum + part * b[i], 0);
const points = (list: XY[]) => list.map(({ x, y }) => `${x},${y}`).join(' ');

/** VECTORS §5 `area_volume`. Area is the size of u × v; a slanted box is as tall as u along it. */
export function AreaVolume({ spec, beat }: Props) {
  return spec.params.mode === 'box' ? (
    <Box spec={spec} beat={beat} />
  ) : (
    <Flat spec={spec} beat={beat} />
  );
}

function Flat({ spec, beat }: Props) {
  const {
    mode,
    edges,
    names,
    sidesLine,
    crossLine,
    normLine,
    halfLine,
    wrongLine,
    student,
    right,
    try: question,
  } = spec.params;
  const now = spec.beats.indexOf(beat);
  const seen = (step: AreaBeat) => spec.beats.indexOf(step) >= 0 && now >= spec.beats.indexOf(step);
  const comparing = beat === 'compare';
  const triangle = mode === 'triangle';
  const [u, v] = edges.map(toNums);
  const O = [0, 0, 0];
  const normal = scaleTo(
    toNums(spec.params.cross),
    Math.max(Math.hypot(...u), Math.hypot(...v)) * 0.8,
  );
  const frame = frameFor([O, u, v, add(u, v), normal], PICTURE, { maxUnit: 56 });
  const at = (p: number[]) => frame.at(p);
  const halved = seen('half');

  return (
    <Stage>
      <polygon
        points={points([at(O), at(u), at(add(u, v)), at(v)])}
        strokeWidth={1.5}
        strokeDasharray={triangle && halved ? '3 5' : undefined}
        className={`stroke-edge ${triangle && halved ? 'fill-transparent' : 'fill-brand/15'}`}
      />
      <Reveal show={triangle}>
        <polygon
          points={points([at(O), at(u), at(v)])}
          className={halved ? 'fill-good/30' : 'fill-transparent'}
          strokeWidth={0}
        />
      </Reveal>
      <Line
        a={at(u)}
        b={at(v)}
        tone="good"
        width={2.5}
        dashed
        show={triangle && halved}
        start={0.15}
      />
      <Arrow
        from={at(O)}
        to={at(u)}
        tone="row"
        show
        start={0.05}
        label={<VecName name={names[0]} size={16} className="fill-cta" />}
      />
      <Arrow
        from={at(O)}
        to={at(v)}
        tone="col"
        show
        start={0.2}
        labelSide={-1}
        label={<VecName name={names[1]} size={16} className="fill-brand" />}
      />
      <Arrow
        from={at(O)}
        to={at(normal)}
        tone="good"
        show={seen('cross')}
        start={0.3}
        width={3}
        dashed
        label={
          <HandText
            x={0}
            y={0}
            size={14}
            className="fill-good"
          >{`${names[0]} × ${names[1]}`}</HandText>
        }
      />

      {sidesLine && (
        <WorkLine text={sidesLine} y={232} show={beat === 'shape'} start={0.3} size={20} />
      )}
      <WorkLine
        text={crossLine}
        y={232}
        show={seen('cross') && !comparing && beat !== 'try'}
        start={0.3}
        size={22}
        className="fill-good"
      />
      {normLine && (
        <WorkLine
          text={normLine}
          y={274}
          show={seen('norm') && !comparing}
          start={0.3}
          size={22}
          className="fill-good font-semibold"
          pop={beat === 'norm'}
        />
      )}
      {halfLine && (
        <WorkLine
          text={halfLine}
          y={316}
          show={halved}
          start={0.35}
          size={26}
          className="fill-good font-semibold"
          pop={beat === 'half'}
        />
      )}

      {student !== undefined && (
        <>
          <SideBySide mine={student} right={right} show={comparing} y={226} />
          {wrongLine && <Struck text={wrongLine} y={330} show={comparing} start={0.45} size={24} />}
        </>
      )}
      {question && beat === 'try' && (
        <Choices options={question.options} right={question.right} y={330} />
      )}
      <Reveal show={beat === 'end'} start={0.1}>
        <HandText x={170} y={380} size={26} className="fill-good font-semibold">
          {triangle
            ? `½ |${names[0]} × ${names[1]}| = ${right}`
            : `|${names[0]} × ${names[1]}| = ${right}`}
        </HandText>
      </Reveal>
    </Stage>
  );
}

function Box({ spec, beat }: Props) {
  const {
    edges,
    crossLine,
    dotLine,
    triple,
    volume,
    productLine,
    mistake,
    student,
    right,
    try: question,
  } = spec.params;
  const now = spec.beats.indexOf(beat);
  const seen = (step: AreaBeat) => spec.beats.indexOf(step) >= 0 && now >= spec.beats.indexOf(step);
  const comparing = beat === 'compare';
  const [u, v, w] = edges.map(toNums);
  const c = toNums(spec.params.cross);
  const O = [0, 0, 0];
  // How far u reaches along the normal of the base: the box's true height, for drawing only.
  const height = scaleTo(c, dotN(u, c) / (Math.hypot(...c) || 1));
  const upright = scaleTo(height, Math.hypot(...u) * Math.sign(dotN(u, c) || 1));
  const corners = [O, u, v, w, add(u, v), add(u, w), add(v, w), add(u, v, w)];
  const frame = frameFor([...corners, upright], PICTURE, { maxUnit: 48 });
  const at = (p: number[]) => frame.at(p);
  const edgesOf: [number[], number[]][] = [
    [O, v],
    [O, w],
    [v, add(v, w)],
    [w, add(v, w)],
    [u, add(u, v)],
    [u, add(u, w)],
    [add(u, v), add(u, v, w)],
    [add(u, w), add(u, v, w)],
    [v, add(u, v)],
    [w, add(u, w)],
    [add(v, w), add(u, v, w)],
  ];

  return (
    <Stage>
      <Reveal show={seen('base')}>
        <polygon points={points([at(O), at(v), at(add(v, w)), at(w)])} className="fill-brand/25" />
      </Reveal>
      {edgesOf.map(([a, b], i) => (
        <Line key={i} a={at(a)} b={at(b)} width={1.3} dashed={i >= 4} />
      ))}
      <Arrow
        from={at(O)}
        to={at(u)}
        tone="row"
        show
        start={0.05}
        label={<VecName name="u" size={16} className="fill-cta" />}
      />
      <Arrow
        from={at(O)}
        to={at(v)}
        tone="col"
        show
        start={0.15}
        labelSide={-1}
        label={<VecName name="v" size={16} className="fill-brand" />}
      />
      <Arrow
        from={at(O)}
        to={at(w)}
        tone="third"
        show
        start={0.25}
        label={<VecName name="w" size={16} className="fill-flame" />}
      />
      {/* the true height, and how tall an upright box with the same edges would be */}
      <Line
        a={at(O)}
        b={at(height)}
        tone="good"
        width={4}
        show={seen('dot') || beat === 'tilt'}
        start={0.3}
      />
      <Line
        a={at(u)}
        b={at(height)}
        tone="good"
        width={1.5}
        dashed
        show={seen('dot') || beat === 'tilt'}
        start={0.45}
      />
      <Line
        a={at(O)}
        b={at(upright)}
        tone="warn"
        width={2.5}
        dashed
        show={beat === 'tilt' || (comparing && mistake === 'product')}
        start={0.2}
      />

      <WorkLine
        text={crossLine}
        y={234}
        show={seen('base') && !comparing}
        start={0.3}
        size={22}
        className="fill-brand"
      />
      {dotLine && (
        <WorkLine text={dotLine} y={276} show={seen('dot') && !comparing} start={0.3} size={21} />
      )}
      {triple && volume && (
        <WorkLine
          text={`|${rationalText(triple)}| = ${rationalText(volume)}`}
          y={320}
          show={seen('abs')}
          start={0.3}
          size={28}
          className="fill-good font-semibold"
          pop={beat === 'abs'}
        />
      )}
      {productLine && (
        <WorkLine
          text={productLine}
          y={234}
          show={beat === 'tilt'}
          start={0.5}
          size={22}
          className="fill-warn"
        />
      )}

      {student !== undefined && (
        <>
          <SideBySide mine={student} right={right} show={comparing} y={226} />
          {mistake === 'product' && productLine && (
            <Struck text={productLine} y={330} show={comparing} start={0.45} size={22} />
          )}
        </>
      )}
      {question && beat === 'try' && (
        <Choices options={question.options} right={question.right} y={330} />
      )}
    </Stage>
  );
}
