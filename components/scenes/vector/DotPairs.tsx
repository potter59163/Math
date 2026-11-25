import { Choices, HandText, Reveal, Stage, Struck, WIDTH, fitted } from '@/components/clip/kit';
import type { Surd } from '@/lib/core/surd';
import { surdText } from '@/lib/topics/vector/format';
import type { DotBeat, VectorSceneOf } from '@/lib/topics/vector/scenes/types';
import {
  AngleArc,
  Arrow,
  Column,
  SideBySide,
  VecName,
  WorkLine,
  columnBox,
  frameFor,
  toNums,
  type XY,
} from './kit';
import { Line } from './Line';

interface Props {
  spec: VectorSceneOf<'dot_pairs'>;
  beat: DotBeat;
}

const SIZE = 19;
const surdNum = (s: Surd): number => (s.coeff.n / s.coeff.d) * Math.sqrt(s.radicand);

/** u and v from one tail, with the angle between them marked. */
function Picture({
  u,
  v,
  show,
  box,
  arcTone,
  arcLabel,
  square,
}: {
  u: number[];
  v: number[];
  show: boolean;
  box: { x: number; y: number; width: number; height: number };
  arcTone: 'good' | 'warn' | 'muted' | 'col';
  arcLabel?: string;
  square?: boolean;
}) {
  const O = u.map(() => 0);
  const frame = frameFor([O, u, v], box, { maxUnit: 44 });
  const at = (p: readonly number[]): XY => frame.at(p);
  return (
    <Reveal show={show}>
      <Arrow
        from={at(O)}
        to={at(u)}
        tone="row"
        show={show}
        start={0.05}
        label={<VecName name="u" size={16} className="fill-cta" />}
      />
      <Arrow
        from={at(O)}
        to={at(v)}
        tone="col"
        show={show}
        start={0.2}
        label={<VecName name="v" size={16} className="fill-brand" />}
        labelSide={-1}
      />
      <AngleArc
        at={at(O)}
        from={at(u)}
        to={at(v)}
        show={show}
        start={0.4}
        tone={arcTone}
        label={arcLabel}
        radius={square ? 18 : 24}
      />
    </Reveal>
  );
}

/** VECTORS §5 `dot_pairs`. Same places pair up, multiply and add; the sign says what the angle is. */
export function DotPairs({ spec, beat }: Props) {
  return spec.params.mode === 'angle' ? (
    <Polar spec={spec} beat={beat} />
  ) : (
    <Pairs spec={spec} beat={beat} />
  );
}

function Pairs({ spec, beat }: Props) {
  const {
    mode,
    u = [],
    v = [],
    uFilled,
    vFilled,
    products = [],
    sumLine,
    sign,
    equationLine,
    solveLine,
    wrongLine,
    student,
    value,
    answer,
    try: question,
  } = spec.params;
  const now = spec.beats.indexOf(beat);
  const seen = (step: DotBeat) => spec.beats.indexOf(step) >= 0 && now >= spec.beats.indexOf(step);
  const comparing = beat === 'compare';
  const perp = mode === 'perp';
  const top = 150;
  const uBox = columnBox(u, 62, top, SIZE);
  const vBox = columnBox(v, 132, top, SIZE);
  const paired = perp ? seen('equation') : seen('pair');
  const multiplied = perp ? seen('equation') : seen('multiply');
  const arcTone = sign === 'acute' ? 'good' : sign === 'obtuse' ? 'warn' : 'col';
  const lineY = top + uBox.height + 34;

  return (
    <Stage>
      {uFilled && vFilled && (
        <Picture
          u={toNums(uFilled)}
          v={toNums(vFilled)}
          show={!perp || seen('solve')}
          box={{ x: 70, y: 12, width: 200, height: 118 }}
          arcTone={beat === 'sign' ? arcTone : 'muted'}
          square={sign === 'right'}
        />
      )}

      <Column
        entries={u}
        box={uBox}
        size={SIZE}
        label={<VecName name="u" className="fill-cta" />}
        entryClass={(i) => (typeof u[i] === 'string' ? 'fill-brand font-semibold' : 'fill-ink')}
      />
      <HandText x={97} y={top - 15} size={22} className="fill-muted">
        ·
      </HandText>
      <Column
        entries={v}
        box={vBox}
        size={SIZE}
        label={<VecName name="v" className="fill-brand" />}
        entryClass={(i) => (typeof v[i] === 'string' ? 'fill-brand font-semibold' : 'fill-ink')}
      />

      {/* ---- the pairs: same place with same place */}
      {u.map((_, i) => (
        <Line
          key={i}
          a={{ x: uBox.x + uBox.width - 6, y: uBox.cy(i) }}
          b={{ x: vBox.x + 6, y: vBox.cy(i) }}
          tone="row"
          width={2.5}
          show={paired && !comparing && beat !== 'try'}
          start={0.1 + 0.15 * i}
        />
      ))}
      {/* What V14 did instead: across, as for a determinant */}
      {u.length === 2 && wrongLine && !perp && (
        <>
          <Line
            a={{ x: uBox.x + uBox.width - 6, y: uBox.cy(0) }}
            b={{ x: vBox.x + 6, y: vBox.cy(1) }}
            tone="warn"
            width={2.5}
            show={comparing}
            start={0.2}
          />
          <Line
            a={{ x: uBox.x + uBox.width - 6, y: uBox.cy(1) }}
            b={{ x: vBox.x + 6, y: vBox.cy(0) }}
            tone="warn"
            width={2.5}
            show={comparing}
            start={0.35}
          />
        </>
      )}
      {products.map((line, i) => (
        <Reveal key={i} show={multiplied && !comparing && beat !== 'try'} start={0.15 + 0.15 * i}>
          <HandText x={252} y={uBox.cy(i)} size={fitted(line, 19, 150)} className="fill-ink">
            {line}
          </HandText>
        </Reveal>
      ))}

      {sumLine && (
        <WorkLine
          text={sumLine}
          y={lineY}
          show={seen('sum')}
          start={0.25}
          size={24}
          className="fill-good font-semibold"
          pop={beat === 'sum'}
        />
      )}
      {equationLine && (
        <WorkLine
          text={equationLine}
          y={lineY}
          show={seen('equation') && !comparing}
          start={0.5}
          size={24}
        />
      )}
      {solveLine && (
        <WorkLine
          text={solveLine}
          y={lineY + 42}
          show={seen('solve')}
          start={0.2}
          size={26}
          className="fill-good font-semibold"
          pop={beat === 'solve'}
        />
      )}

      {student !== undefined && (
        <>
          <SideBySide
            mine={perp ? `k = ${student}` : student}
            right={
              perp && answer
                ? `k = ${answer.toString().replace('-', '−')}`
                : value
                  ? surdText(value)
                  : ''
            }
            show={comparing}
            y={lineY - 20}
          />
          {wrongLine && (
            <Struck text={wrongLine} y={lineY + 68} show={comparing} start={0.45} size={22} />
          )}
        </>
      )}
      {question && beat === 'try' && (
        <Choices options={question.options} right={question.right} y={lineY - 24} />
      )}
      <Reveal show={beat === 'end'} start={0.1}>
        <HandText x={WIDTH / 2} y={404} size={22} className="fill-good">
          {perp ? 'u ⊥ v  ⇔  u · v = 0' : 'u · v = u₁v₁ + u₂v₂ + …'}
        </HandText>
      </Reveal>
    </Stage>
  );
}

function Polar({ spec, beat }: Props) {
  const {
    normU,
    normV,
    theta = 0,
    cosLine,
    sumLine,
    wrongLine,
    student,
    value,
    try: question,
  } = spec.params;
  const now = spec.beats.indexOf(beat);
  const seen = (step: DotBeat) => spec.beats.indexOf(step) >= 0 && now >= spec.beats.indexOf(step);
  const comparing = beat === 'compare';
  // Lengths as the norms, the angle as given: for drawing only.
  const a = surdNum(normU!);
  const b = surdNum(normV!);
  const radians = (theta * Math.PI) / 180;
  const u = [a, 0];
  const v = [b * Math.cos(radians), b * Math.sin(radians)];
  const frame = frameFor(
    [[0, 0], u, v, [b * Math.cos(radians), 0]],
    { x: 40, y: 20, width: 260, height: 150 },
    { maxUnit: 40 },
  );
  const O = frame.at([0, 0]);
  const foot = frame.at([b * Math.cos(radians), 0]);

  return (
    <Stage>
      <Arrow
        from={O}
        to={frame.at(u)}
        tone="row"
        show
        start={0.05}
        label={
          <HandText
            x={0}
            y={0}
            size={15}
            className="fill-cta"
          >{`|u| = ${surdText(normU!)}`}</HandText>
        }
      />
      <Arrow
        from={O}
        to={frame.at(v)}
        tone="col"
        show
        start={0.2}
        labelSide={-1}
        label={
          <HandText
            x={0}
            y={0}
            size={15}
            className="fill-brand"
          >{`|v| = ${surdText(normV!)}`}</HandText>
        }
      />
      <AngleArc
        at={O}
        from={frame.at(u)}
        to={frame.at(v)}
        show
        start={0.35}
        label={`${theta}°`}
        tone="muted"
      />
      {/* cos θ is how much of v lies along u: its shadow on u's line. */}
      <Line a={frame.at(v)} b={foot} tone="good" dashed width={2} show={seen('cos')} start={0.2} />
      <Line a={O} b={foot} tone="good" width={4} show={seen('cos')} start={0.4} />

      <WorkLine
        text="u · v = |u||v| cos θ"
        y={226}
        show={seen('formula') && !comparing}
        start={0.1}
        size={26}
        className="fill-ink"
      />
      {cosLine && (
        <WorkLine
          text={cosLine}
          y={272}
          show={seen('cos') && !comparing}
          start={0.3}
          size={24}
          className="fill-good"
        />
      )}
      {sumLine && (
        <WorkLine
          text={sumLine}
          y={318}
          show={seen('sum') && !comparing}
          start={0.2}
          size={24}
          className="fill-good font-semibold"
          pop={beat === 'sum'}
        />
      )}

      {student !== undefined && value && (
        <>
          <SideBySide mine={student} right={surdText(value)} show={comparing} y={214} />
          {wrongLine && <Struck text={wrongLine} y={320} show={comparing} start={0.45} size={24} />}
        </>
      )}
      {question && beat === 'try' && (
        <Choices options={question.options} right={question.right} y={250} />
      )}
    </Stage>
  );
}
