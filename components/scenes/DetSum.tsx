import {
  BoardMatrix,
  Choices,
  HandText,
  Reveal,
  Stage,
  Struck,
  Verdict,
  WIDTH,
  boxAt,
  fitted,
} from '@/components/clip/kit';
import { rationalText } from '@/lib/topics/matrix/format';
import type { SceneSpecOf } from '@/lib/topics/matrix/scenes/types';
import { SvgText } from './svg';

const CELL = 40;
const OP_WIDTH = 18;
const TOP = 36;

interface Props {
  spec: SceneSpecOf<'det_sum'>;
  beat: SceneSpecOf<'det_sum'>['beats'][number];
}

/** SCENES §3.7. The wrong way stays on screen, struck through, so it can be compared with the right one. */
export function DetSum({ spec, beat }: Props) {
  const { A, B, sum, wrongLine, rightLine, wrong, detSum, try: question } = spec.params;
  const now = spec.beats.indexOf(beat);
  const added = now >= spec.beats.indexOf('add_first');
  const worked = now >= spec.beats.indexOf('det_of_sum');

  const width = 2 * CELL + 12;
  const total = 3 * width + 2 * OP_WIDTH;
  const startX = (WIDTH - total) / 2;
  const a = boxAt(startX, TOP, 2, 2, CELL);
  const b = boxAt(startX + width + OP_WIDTH, TOP, 2, 2, CELL);
  const s = boxAt(b.x + width + OP_WIDTH, TOP, 2, 2, CELL);
  const middle = TOP + CELL + 2;
  const low = TOP + 2 * CELL + 42;

  return (
    <Stage>
      <BoardMatrix value={A} box={a} label="A" />
      <SvgText
        x={a.x + width + OP_WIDTH / 2}
        y={middle}
        size={18}
        className="fill-muted font-matrix"
      >
        +
      </SvgText>
      <BoardMatrix value={B} box={b} label="B" />
      <Reveal show={added} start={0.2}>
        <SvgText x={s.x - OP_WIDTH / 2} y={middle} size={18} className="fill-muted font-matrix">
          =
        </SvgText>
        <BoardMatrix value={sum} box={s} label="A + B" numberClass="fill-cta" />
      </Reveal>

      {/* ---- what they did */}
      <Reveal show={beat === 'compare' || beat === 'try'} start={0.1}>
        <HandText
          x={WIDTH / 2}
          y={low + 20}
          size={fitted(wrongLine, 30)}
          className={beat === 'compare' ? 'fill-warn font-semibold' : 'fill-muted'}
        >
          {wrongLine}
        </HandText>
      </Reveal>

      {/* ---- their turn */}
      {question && beat === 'try' && (
        <Choices options={question.options} right={question.right} y={low + 70} />
      )}

      {/* ---- the right way, below the wrong one struck through */}
      <Struck text={wrongLine} y={low + 20} show={added} start={0.2} size={26} />
      <Reveal show={worked} start={0.15}>
        <HandText
          x={WIDTH / 2}
          y={low + 76}
          size={fitted(`det = ${rightLine}`, 28)}
          className="fill-ink font-semibold"
        >
          {`det = ${rightLine}`}
        </HandText>
      </Reveal>
      <Verdict
        mine={rationalText(wrong)}
        right={rationalText(detSum)}
        show={beat === 'differ'}
        y={low + 118}
        start={0.1}
      />
    </Stage>
  );
}
