import { Choices, HandText, Reveal, Stage, Struck, WIDTH } from '@/components/clip/kit';
import { rationalText, surdText } from '@/lib/topics/vector/format';
import type { MagnitudeBeat, VectorSceneOf } from '@/lib/topics/vector/scenes/types';
import {
  Arrow,
  Axes,
  SideBySide,
  VecName,
  WorkLine,
  axisEnds,
  frameFor,
  reachOf,
  toNums,
  type XY,
} from './kit';
import { Line } from './Line';

interface Props {
  spec: VectorSceneOf<'magnitude_box'>;
  beat: MagnitudeBeat;
}

const PICTURE = { x: 40, y: 16, width: 260, height: 196 };

/** VECTORS §5 `magnitude_box`. The length of v is the diagonal of the box its components make. */
export function MagnitudeBox({ spec, beat }: Props) {
  const {
    mode,
    v,
    from,
    edges,
    floor,
    squaresLine,
    rootLine,
    norm,
    walkLine,
    sumLine,
    student,
    try: question,
  } = spec.params;
  const now = spec.beats.indexOf(beat);
  const seen = (step: MagnitudeBeat) =>
    spec.beats.indexOf(step) >= 0 && now >= spec.beats.indexOf(step);
  const comparing = beat === 'compare';
  const asking = beat === 'try';
  const flat = v.length === 2;
  const w = toNums(v);
  const O = w.map(() => 0);
  const triangle = mode === 'triangle' && from?.kind === 'combo';
  const parts = triangle ? from.terms.map((t) => toNums(t.vec)) : [];
  const middle = parts[0] ?? O;

  const reach = reachOf(triangle ? [middle, w] : [w], flat ? 2 : 3);
  const frame = frameFor(triangle ? [O, middle, w] : [O, w, ...axisEnds(reach)], PICTURE, {
    maxUnit: 44,
  });
  const P = (p: readonly number[]): XY => frame.at(p);
  const corner = (x: number, y: number, z = 0) => (flat ? [x, y] : [x, y, z]);
  const [a, b] = w;

  const floorLit = beat === 'floor';
  const riseLit = beat === 'rise' || (beat === 'floor' && !flat && !spec.beats.includes('rise'));
  const walking = beat === 'walk' || (comparing && mode === 'walk');
  const edgeLabel = (value: number) => rationalText(edges[value]);

  return (
    <Stage>
      <Axes frame={frame} reach={reach} dims={flat ? 2 : 3} show={!triangle} />

      {/* ---- the box of the components, faint, and its edges when they are counted */}
      {!triangle && (
        <g>
          {!flat && (
            <>
              <Line a={P(corner(0, 0))} b={P(corner(a, 0))} dashed />
              <Line a={P(corner(a, 0))} b={P(corner(a, b))} dashed />
              <Line a={P(corner(0, 0))} b={P(corner(0, b))} dashed />
              <Line a={P(corner(0, b))} b={P(corner(a, b))} dashed />
              <Line a={P(corner(a, b))} b={P(w)} dashed />
            </>
          )}
          {flat && (
            <>
              <Line a={P([0, 0])} b={P([a, 0])} dashed />
              <Line a={P([a, 0])} b={P(w)} dashed />
            </>
          )}
          {/* Pythagoras on the floor */}
          <Line
            a={P(corner(0, 0))}
            b={P(corner(a, 0))}
            tone="row"
            show={floorLit}
            width={3.5}
            label={edgeLabel(0)}
          />
          <Line
            a={P(corner(a, 0))}
            b={P(corner(a, b))}
            tone="row"
            show={floorLit}
            width={3.5}
            start={0.15}
            label={edgeLabel(1)}
          />
          {!flat && (
            <>
              <Line
                a={P(corner(0, 0))}
                b={P(corner(a, b))}
                tone="col"
                show={floorLit || riseLit}
                start={0.35}
                width={3}
              />
              <Line
                a={P(corner(a, b))}
                b={P(w)}
                tone="col"
                show={riseLit}
                start={0.5}
                width={3.5}
                label={edgeLabel(2)}
              />
            </>
          )}
          {/* Walking along the axes, which V10 counts */}
          <Line
            a={P(corner(0, 0))}
            b={P(corner(a, 0))}
            tone="warn"
            show={walking}
            width={4}
            label={edgeLabel(0)}
          />
          <Line
            a={P(corner(a, 0))}
            b={P(corner(a, b))}
            tone="warn"
            show={walking}
            start={0.15}
            width={4}
            label={edgeLabel(1)}
          />
          {!flat && (
            <Line
              a={P(corner(a, b))}
              b={P(w)}
              tone="warn"
              show={walking}
              start={0.3}
              width={4}
              label={edgeLabel(2)}
            />
          )}
          <Arrow
            from={P(O)}
            to={P(w)}
            tone="good"
            show={!walking || beat === 'compare'}
            start={0.1}
            width={4}
            label={<VecName name="v" size={17} className="fill-good" />}
            labelSide={-1}
          />
        </g>
      )}

      {/* ---- |u + v| against |u| + |v| */}
      {triangle && (
        <g>
          <Arrow
            from={P(O)}
            to={P(middle)}
            tone="row"
            show
            start={0.05}
            label={<VecName name={from.terms[0].label} size={16} className="fill-cta" />}
          />
          <Arrow
            from={P(middle)}
            to={P(w)}
            tone="col"
            show
            start={0.3}
            label={<VecName name={from.terms[1].label} size={16} className="fill-brand" />}
          />
          <Arrow
            from={P(O)}
            to={P(w)}
            tone="good"
            show={seen('combine') || comparing}
            start={0.5}
            width={4}
            labelSide={-1}
          />
        </g>
      )}

      {/* ---- the working */}
      {from && (
        <WorkLine
          text={from.line}
          y={236}
          show={beat === 'points' || beat === 'combine'}
          start={0.2}
          size={22}
          className="fill-ink"
        />
      )}
      {floor && (
        <WorkLine
          text={floor.line}
          y={236}
          show={floorLit || riseLit}
          start={0.45}
          size={22}
          className="fill-cta"
        />
      )}
      {walkLine && (
        <WorkLine
          text={walkLine}
          y={236}
          show={beat === 'walk'}
          start={0.4}
          size={24}
          className="fill-warn"
        />
      )}
      <WorkLine
        text={squaresLine}
        y={280}
        show={beat === 'square' || beat === 'root' || beat === 'end'}
        start={0.15}
        size={24}
      />
      <WorkLine
        text={rootLine}
        y={324}
        show={beat === 'root' || beat === 'end'}
        start={0.45}
        size={28}
        className="fill-good font-semibold"
        pop={beat === 'root'}
      />

      {student !== undefined && (
        <>
          <SideBySide mine={student} right={surdText(norm)} show={comparing} y={232} />
          {mode === 'walk' && walkLine && (
            <Struck text={walkLine} y={330} show={comparing} start={0.45} size={24} />
          )}
          {mode === 'triangle' && sumLine && (
            <Struck text={sumLine} y={330} show={comparing} start={0.45} size={22} />
          )}
          {mode === 'box' && (
            <WorkLine
              text={`${squaresLine}  →  √ ?`}
              y={330}
              show={comparing}
              start={0.45}
              size={24}
              className="fill-warn"
            />
          )}
        </>
      )}
      {question && asking && <Choices options={question.options} right={question.right} y={330} />}
      <Reveal show={beat === 'end'} start={0.1} pop>
        <HandText x={WIDTH / 2} y={390} size={30} className="fill-good font-semibold">
          {`|${from ? from.line.split(' = ')[0].replace('B − A', '').trim() : 'v'}| = ${surdText(norm)}`}
        </HandText>
      </Reveal>
    </Stage>
  );
}
