import { Choices, HandText, Reveal, Stage, Struck, WIDTH } from '@/components/clip/kit';
import { rationalText } from '@/lib/topics/vector/format';
import type { ParallelBeat, VectorSceneOf } from '@/lib/topics/vector/scenes/types';
import { Arrow, Column, SideBySide, VecName, WorkLine, columnBox, toNum, type Entry } from './kit';

interface Props {
  spec: VectorSceneOf<'parallel_scale'>;
  beat: ParallelBeat;
}

const SIZE = 20;
const LONGEST = 220;

/** VECTORS §5 `parallel_scale`. u = kv: v stretched, shrunk or turned round by one k for every part. */
export function ParallelScale({ spec, beat }: Props) {
  const {
    u,
    v,
    ask,
    k,
    pair,
    unknown,
    kLine,
    solveLine,
    answer,
    student,
    wrongLine,
    uFilled,
    vFilled,
    try: question,
  } = spec.params;
  const now = spec.beats.indexOf(beat);
  const seen = (step: ParallelBeat) =>
    spec.beats.indexOf(step) >= 0 && now >= spec.beats.indexOf(step);
  const solved = seen('solve');
  const lit =
    beat === 'find_k' ? pair : beat === 'solve' || beat === 'try' ? unknown.index : undefined;
  const tone = beat === 'find_k' ? 'row' : 'col';

  const show = (slots: typeof u, filled: typeof uFilled, which: 'u' | 'v'): Entry[] =>
    slots.map((part, i) =>
      typeof part === 'string' && solved && (which !== unknown.vector || i === unknown.index)
        ? filled[i]
        : part,
    );
  const uBox = columnBox(show(u, uFilled, 'u'), 120, 40, SIZE);
  const vBox = columnBox(show(v, vFilled, 'v'), 220, 40, SIZE);
  const unknownClass = (which: 'u' | 'v') => (i: number) =>
    typeof (which === 'u' ? u : v)[i] === 'string' ? 'fill-brand font-semibold' : 'fill-ink';

  // The picture: v along a line, and u = kv on the same line, as long as |k| times, turned if k < 0.
  const kValue = toNum(k);
  const vLength = LONGEST / Math.max(1, Math.abs(kValue));
  const uLength = vLength * Math.abs(kValue);
  const middle = WIDTH / 2;
  const vFrom = { x: middle - vLength / 2, y: 196 };
  const uStart = kValue > 0 ? middle - uLength / 2 : middle + uLength / 2;
  const knownK = seen('find_k');
  const comparing = beat === 'compare';

  return (
    <Stage>
      <Column
        entries={show(u, uFilled, 'u')}
        box={uBox}
        size={SIZE}
        lit={lit}
        tone={tone}
        label={<VecName name="u" className="fill-cta" />}
        entryClass={unknownClass('u')}
      />
      <HandText x={170} y={40 + uBox.height / 2} size={26} className="fill-muted">
        ∥
      </HandText>
      <Column
        entries={show(v, vFilled, 'v')}
        box={vBox}
        size={SIZE}
        lit={lit}
        tone={tone}
        label={<VecName name="v" className="fill-brand" />}
        entryClass={unknownClass('v')}
      />

      <Reveal show={!comparing && beat !== 'try'}>
        <Arrow
          from={vFrom}
          to={{ x: vFrom.x + vLength, y: 196 }}
          tone="col"
          show
          start={0.1}
          label={<VecName name="v" size={16} className="fill-brand" />}
        />
        <Arrow
          from={{ x: uStart, y: 240 }}
          to={{ x: uStart + (kValue > 0 ? uLength : -uLength), y: 240 }}
          tone="row"
          show={seen('stretch')}
          start={0.35}
          labelSide={-1}
          label={
            <HandText x={0} y={0} size={16} className="fill-cta">
              {knownK ? `u = ${rationalText(k)}v` : 'u = kv'}
            </HandText>
          }
        />
      </Reveal>

      <WorkLine
        text={kLine}
        y={300}
        show={seen('find_k') && !comparing}
        start={beat === 'find_k' ? 0.3 : 0}
        size={24}
        className="fill-cta"
      />
      <WorkLine
        text={solveLine}
        y={346}
        show={solved}
        start={beat === 'solve' ? 0.3 : 0}
        size={24}
        className="fill-brand font-semibold"
        pop={beat === 'solve'}
      />

      {student !== undefined && (
        <>
          <SideBySide
            mine={`${ask} = ${rationalText(student)}`}
            right={`${ask} = ${rationalText(answer)}`}
            show={comparing}
            y={186}
          />
          {wrongLine && <Struck text={wrongLine} y={300} show={comparing} start={0.45} size={24} />}
        </>
      )}
      {question && beat === 'try' && (
        <Choices options={question.options} right={question.right} y={330} />
      )}
      <Reveal show={beat === 'end'} start={0.1} pop>
        <HandText x={WIDTH / 2} y={396} size={30} className="fill-good font-semibold">
          {`u = ${rationalText(k)}v`}
        </HandText>
      </Reveal>
    </Stage>
  );
}
