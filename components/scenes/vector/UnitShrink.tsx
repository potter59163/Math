import { Choices, HandText, Reveal, Stage, Struck } from '@/components/clip/kit';
import { Surd } from '@/lib/core/surd';
import { surdText, surdVecText } from '@/lib/topics/vector/format';
import type { UnitBeat, VectorSceneOf } from '@/lib/topics/vector/scenes/types';
import {
  Arrow,
  Axes,
  Column,
  centersOf,
  SideBySide,
  VecName,
  WorkLine,
  columnBox,
  axisEnds,
  frameFor,
  reachOf,
  toNums,
  type Entry,
} from './kit';

interface Props {
  spec: VectorSceneOf<'unit_shrink'>;
  beat: UnitBeat;
}

const SIZE = 18;

const surdNum = (s: Surd): number => (s.coeff.n / s.coeff.d) * Math.sqrt(s.radicand);

/** VECTORS §5 `unit_shrink`. The arrow keeps its direction and shrinks until it is 1 long. */
export function UnitShrink({ spec, beat }: Props) {
  const {
    v,
    norm,
    normLine,
    unit,
    scaled,
    checkLine,
    student,
    studentCheck,
    wrongDivisor,
    try: question,
  } = spec.params;
  const now = spec.beats.indexOf(beat);
  const seen = (step: UnitBeat) => spec.beats.indexOf(step) >= 0 && now >= spec.beats.indexOf(step);
  const comparing = beat === 'compare';
  const dims = v.length as 2 | 3;
  const w = toNums(v);
  const O = w.map(() => 0);
  const u = unit.map(surdNum);
  const big = scaled ? scaled.value.map(surdNum) : null;
  const reach = reachOf([w], dims);
  const frame = frameFor(
    [O, w, u, ...(big ? [big] : []), ...axisEnds(reach)],
    { x: 50, y: 14, width: 240, height: 170 },
    { maxUnit: 60 },
  );
  const centre = frame.at(O);
  const divided = seen('divide');

  const entriesOf = (parts: Surd[]): Entry[] => parts;
  const pieces: { entries: Entry[]; label: string; className: string; show: boolean }[] = [
    { entries: v, label: 'v', className: 'fill-brand', show: true },
    { entries: entriesOf(unit), label: 'v/|v|', className: 'fill-good', show: divided },
    ...(scaled
      ? [
          {
            entries: entriesOf(scaled.value),
            label: `${scaled.length}v/|v|`,
            className: 'fill-cta',
            show: seen('scale'),
          },
        ]
      : []),
  ];
  const boxes = centersOf(
    pieces.map((p) => columnBox(p.entries, 0, 0, SIZE).width),
    46,
  );

  return (
    <Stage>
      <Axes frame={frame} reach={reach} dims={dims} />
      {/* Length 1 around the tail: a circle on the plane, the outline of a ball in space. */}
      {/* In the oblique view a ball has no true outline, so 3D marks the length on the arrow instead. */}
      <Reveal show={dims === 2 && (seen('divide') || beat === 'arrow' || comparing)}>
        <circle
          cx={centre.x}
          cy={centre.y}
          r={frame.unit}
          fill="none"
          strokeWidth={1.5}
          strokeDasharray="3 5"
          className="stroke-good"
        />
        <HandText
          x={centre.x + frame.unit * 0.72 + 8}
          y={centre.y + frame.unit * 0.72 + 6}
          size={14}
          className="fill-good"
        >
          1
        </HandText>
      </Reveal>
      <Arrow
        from={centre}
        to={frame.at(w)}
        tone="col"
        show
        start={0.05}
        width={divided ? 2.5 : 4}
        label={<VecName name="v" size={16} className="fill-brand" />}
        labelSide={-1}
      />
      <Arrow
        from={centre}
        to={frame.at(u)}
        tone="good"
        show={divided}
        start={0.25}
        length={0.4}
        width={4.5}
        label={
          dims === 3 ? (
            <HandText x={0} y={0} size={14} className="fill-good">
              1
            </HandText>
          ) : undefined
        }
      />
      {big && (
        <Arrow
          from={centre}
          to={frame.at(big)}
          tone="row"
          show={seen('scale')}
          start={0.2}
          width={3}
          dashed
        />
      )}

      {/* ---- v ÷ |v|, every component */}
      <Reveal show={!comparing && beat !== 'try'}>
        {pieces.map((piece, i) => {
          const box = columnBox(piece.entries, boxes[i], 214, SIZE);
          return (
            <g key={i}>
              <Column
                entries={piece.entries}
                box={box}
                size={SIZE}
                show={piece.show}
                start={0.3}
                label={
                  <VecName name={piece.label} size={14} className={piece.className} arrow={false} />
                }
                entryClass={() => piece.className}
              />
              {i > 0 && (
                <Reveal show={piece.show} start={0.2}>
                  <HandText
                    x={(boxes[i - 1] + boxes[i]) / 2}
                    y={214 + box.height / 2}
                    size={15}
                    className="fill-muted"
                  >
                    {i === 1 ? `÷ ${surdText(norm)}` : `× ${scaled!.length}`}
                  </HandText>
                </Reveal>
              )}
            </g>
          );
        })}
      </Reveal>
      <WorkLine
        text={normLine}
        y={356}
        show={beat === 'norm'}
        start={0.2}
        size={24}
        className="fill-ink"
      />
      <WorkLine
        text={checkLine}
        y={356}
        show={beat === 'check' || beat === 'end'}
        start={0.15}
        size={22}
        className="fill-good"
      />
      {student && studentCheck && (
        <WorkLine
          text={`|${surdVecText(student)}| = ${studentCheck}`}
          y={396}
          show={beat === 'check'}
          start={0.5}
          size={20}
          className="fill-warn"
        />
      )}

      {student && (
        <>
          <SideBySide
            mine={surdVecText(student)}
            right={surdVecText(scaled?.value ?? unit)}
            show={comparing}
            y={212}
          />
          {wrongDivisor && (
            <Struck text={wrongDivisor} y={320} show={comparing} start={0.45} size={26} />
          )}
        </>
      )}
      {question && beat === 'try' && (
        <Choices options={question.options} right={question.right} y={300} />
      )}
    </Stage>
  );
}
