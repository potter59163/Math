import { thVector } from '@/lib/content/th.vector';
import { Rational } from '@/lib/core/rational';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer } from '@/lib/core/types';
import { figureExprText, figureKey } from '../format';
import { equals, sub } from '../ops';
import { askedValue, optionWithValue, pointAt, termValue } from '../solve';
import type { DataOf, Figure, MisconceptionId, Term, Vec } from '../types';
import { beatsOf, choiceOf, scene } from './build';
import type {
  ArrowChainBeat,
  ArrowChainMode,
  ArrowSpot,
  ArrowTone,
  ChainArrow,
  FigureXY,
  ScenePurpose,
  VectorSceneOf,
} from './types';
import type { VoiceId } from './voice';

/** For drawing only: a hidden coordinate of the figure, which can be a half at a midpoint. */
const xy = (v: Vec): FigureXY => [v[0].n / v[0].d, v[1].n / v[1].d];

const plus = (p: Vec, by: Vec): Vec => p.map((part, i) => part.add(by[i]));

const TERM_TONES: ArrowTone[] = ['row', 'col', 'third'];

/** Where a term is drawn in the figure: from its tail point, or back from its head when negative. */
function nativeSpot(figure: Figure, t: Term): { from: Vec; to: Vec } {
  const value = termValue(figure, t);
  const tail = t.k.sign() < 0 ? pointAt(figure, t.to) : pointAt(figure, t.from);
  return { from: tail, to: plus(tail, value) };
}

const spot = (beat: ArrowChainBeat, at: { from: Vec; to: Vec }): ArrowSpot => ({
  beat,
  from: xy(at.from),
  to: xy(at.to),
});

const nameOf = (t: Term): string => figureExprText([t]);

/** The option a student picked, from its choice key. */
function pickedOption(options: readonly Term[], answer: Answer | undefined): Term | undefined {
  if (answer?.kind !== 'choice') return undefined;
  return options.find((option) => figureKey(option) === answer.id);
}

export function chainModeOf(data: DataOf<'figure_equal' | 'figure_expr'>): ArrowChainMode {
  if (data.form === 'figure_equal') return 'equal';
  const [first, second] = data.expr;
  const commonTail = data.expr.length === 2 && first.from === second.from;
  if (commonTail && first.k.equals(Rational.ONE) && second.k.equals(Rational.ONE.neg())) {
    return 'sub';
  }
  if (commonTail && first.k.equals(Rational.ONE) && second.k.equals(Rational.ONE)) {
    return 'parallelogram';
  }
  return 'chain';
}

export interface ArrowChainInput {
  data: DataOf<'figure_equal' | 'figure_expr'>;
  purpose: ScenePurpose;
  studentAnswer?: Answer;
  caught?: MisconceptionId;
}

/** VECTORS §5 `arrow_chain`: arrows on the figure, slid head to tail, then the arrow they make. */
export function arrowChainScene({
  data,
  purpose,
  studentAnswer,
  caught,
}: ArrowChainInput): VectorSceneOf<'arrow_chain'> {
  const copy = thVector.scenes.arrow;
  const { figure, options } = data;
  const mode = chainModeOf(data);
  const target = data.form === 'figure_equal' ? askedValue(data) : null;
  const answerValue =
    data.form === 'figure_equal'
      ? target!
      : data.expr.map((t) => termValue(figure, t)).reduce((a, b) => plus(a, b));
  const answer = optionWithValue(figure, options, answerValue);
  if (!answer) throw new Error('arrowChainScene: no option is the answer');
  const student = pickedOption(options, studentAnswer);
  const remedial = student !== undefined && figureKey(student) !== figureKey(answer);
  const answerSpot = nativeSpot(figure, answer);
  const asked = data.form === 'figure_equal' ? nameOf(data.of) : figureExprText(data.expr);

  const arrows: ChainArrow[] = [];
  const studentArrow = (on: ArrowChainBeat[]) => {
    if (!remedial || !student) return;
    arrows.push({
      label: nameOf(student),
      tone: 'warn',
      on,
      spots: [spot(on[0], nativeSpot(figure, student))],
    });
  };

  let beats: ArrowChainBeat[];
  const captions: Partial<Record<ArrowChainBeat, string>> = {};
  const voice: Partial<Record<ArrowChainBeat, VoiceId>> = {};

  if (data.form === 'figure_equal') {
    const negative = data.negative;
    const ofSpot = nativeSpot(figure, data.of);
    beats = beatsOf<ArrowChainBeat>(
      remedial && 'compare',
      'asked',
      'slide',
      negative && 'flip',
      'result',
      remedial && 'try',
      remedial && 'end',
    );
    const after = (from: ArrowChainBeat) => beats.slice(beats.indexOf(from));
    arrows.push({ label: asked, tone: 'row', on: after('asked'), spots: [spot('asked', ofSpot)] });
    // A copy of the asked arrow slides onto the answer's line, its tail where the answer starts or,
    // for a negative, where it ends, so that turning it round lands it on the answer.
    const ofValue = sub(ofSpot.to, ofSpot.from);
    const tail = negative ? answerSpot.to : answerSpot.from;
    arrows.push({
      label: asked,
      tone: 'row',
      on: beatsOf<ArrowChainBeat>('slide', negative ? undefined : 'result'),
      spots: [spot('asked', ofSpot), spot('slide', { from: tail, to: plus(tail, ofValue) })],
    });
    arrows.push({
      label: nameOf(answer),
      tone: 'good',
      on: beatsOf<ArrowChainBeat>(negative && 'flip', 'result', 'end'),
      spots: [spot(negative ? 'flip' : 'result', answerSpot)],
    });
    studentArrow(beatsOf<ArrowChainBeat>('compare', 'result'));
    const lhs = negative ? `−${asked}` : asked;
    Object.assign(captions, {
      compare: fillTokens(negative ? copy.compare_negative : copy.compare_equal, {
        mine: student ? nameOf(student) : '',
        asked,
      }),
      asked: fillTokens(copy.asked, { asked }),
      slide: fillTokens(copy.slide, { asked }),
      flip: fillTokens(copy.flip, { asked }),
      result: fillTokens(copy.result_equal, { lhs, answer: nameOf(answer) }),
      try: fillTokens(negative ? copy.try_negative : copy.try_equal, { asked }),
      end: negative ? copy.end_negative : copy.end_equal,
    });
    Object.assign(voice, {
      compare: negative ? 'v_arrow.compare_negative' : 'v_arrow.compare_equal',
      asked: 'v_arrow.asked',
      slide: 'v_arrow.slide',
      flip: 'v_arrow.flip',
      result: 'v_arrow.result_equal',
      try: negative ? 'v_arrow.try_negative' : 'v_arrow.try_equal',
      end: negative ? 'v_sort.opposite' : 'v_sort.equal',
    });
  } else {
    const { expr } = data;
    const hasNegative = expr.some((t) => t.k.sign() < 0);
    const isSub = mode === 'sub';
    // Head to tail: each term after the first is slid so that its tail is where the last one ended.
    const natives = expr.map((t) => nativeSpot(figure, t));
    const placed: { from: Vec; to: Vec }[] = [];
    natives.forEach((native, i) => {
      if (i === 0) return placed.push(native);
      const start = placed[i - 1].to;
      placed.push({ from: start, to: plus(start, sub(native.to, native.from)) });
    });
    const moves = !isSub && placed.some((at, i) => !equals(at.from, natives[i].from));
    const negates = !isSub && hasNegative;
    beats = beatsOf<ArrowChainBeat>(
      remedial && 'compare',
      'terms',
      negates && 'negate',
      moves && 'chain',
      'result',
      isSub && 'chain',
      remedial && 'try',
      remedial && 'end',
    );
    const from = (first: ArrowChainBeat) => beats.slice(beats.indexOf(first));
    expr.forEach((t, i) => {
      const tone = TERM_TONES[i] ?? 'third';
      const negative = t.k.sign() < 0;
      if (negative && !isSub) {
        // First as written without its sign, then turned round.
        const plain = { ...t, k: t.k.neg() };
        arrows.push({
          label: nameOf(plain),
          tone,
          on: ['terms'],
          spots: [spot('terms', nativeSpot(figure, plain))],
        });
        arrows.push({
          label: nameOf(t),
          tone,
          on: from('negate'),
          spots: [spot('negate', natives[i]), spot('chain', placed[i])],
        });
        return;
      }
      // A difference keeps both arrows from their common tail, so the second shows unsigned.
      const shown = isSub && negative ? { ...t, k: t.k.neg() } : t;
      arrows.push({
        label: nameOf(shown),
        tone,
        on: from('terms'),
        spots: [
          spot('terms', nativeSpot(figure, shown)),
          ...(moves ? [spot('chain', placed[i])] : []),
        ],
      });
    });
    // A difference runs from the head of what is taken away to the head of what it is taken from.
    const resultSpot = isSub
      ? { from: nativeSpot(figure, { ...expr[1], k: expr[1].k.neg() }).to, to: natives[0].to }
      : { from: placed[0].from, to: placed[placed.length - 1].to };
    arrows.push({
      label: nameOf(answer),
      tone: 'good',
      on: from('result'),
      spots: [spot('result', resultSpot)],
    });
    // When the arrows end away from the answer's own place, it is drawn there too.
    if (!equals(resultSpot.from, answerSpot.from)) {
      arrows.push({
        label: nameOf(answer),
        tone: 'good',
        on: from('result'),
        spots: [spot('result', answerSpot)],
      });
    }
    studentArrow(['compare']);
    const [u, v] = expr;
    const names = {
      asked,
      answer: nameOf(answer),
      u: nameOf(u),
      v: v ? nameOf({ ...v, k: v.k.abs() }) : '',
    };
    const flippedTerm = expr.find((t) => t.k.sign() < 0);
    Object.assign(captions, {
      compare: fillTokens(
        caught === 'V04_GEOM_ADD_JOIN_TIPS' ? copy.compare_join : copy.compare_sub,
        {
          mine: student ? nameOf(student) : '',
          asked,
        },
      ),
      terms: fillTokens(copy.terms, { asked }),
      ...(flippedTerm && {
        negate: fillTokens(copy.negate, {
          name: nameOf({ ...flippedTerm, k: flippedTerm.k.neg() }),
          flipped: nameOf({
            ...flippedTerm,
            k: flippedTerm.k.neg(),
            from: flippedTerm.to,
            to: flippedTerm.from,
          }),
        }),
      }),
      chain: isSub ? fillTokens(copy.check_sub, names) : copy.chain,
      result: fillTokens(isSub ? copy.result_sub : copy.result, names),
      try: fillTokens(copy.try_sum, { asked }),
      end: isSub ? fillTokens(copy.end_sub, names) : copy.end_sum,
    });
    Object.assign(voice, {
      compare: caught === 'V04_GEOM_ADD_JOIN_TIPS' ? 'v_arrow.compare_join' : 'v_arrow.compare_sub',
      terms: 'v_arrow.terms',
      negate: 'v_arrow.negate',
      chain: isSub ? 'v_arrow.check_sub' : 'v_arrow.chain',
      result: isSub ? 'v_arrow.result_sub' : 'v_arrow.result',
      try: 'v_arrow.try_sum',
      end: isSub ? 'v_arrow.result_sub' : 'v_arrow.end_sum',
    });
  }

  const equalForm = data.form === 'figure_equal';
  return scene({
    template: 'arrow_chain',
    params: {
      mode,
      shape: figure.shape,
      points: figure.points.map(({ label, at }) => ({ label, at })),
      outline: [...figure.outline],
      arrows,
      asked,
      answer: nameOf(answer),
      ...(remedial && { student: nameOf(student!) }),
      ...(remedial && {
        try: choiceOf(nameOf(answer), [nameOf(student!)], figure.points[1].at[0]),
      }),
    },
    beats,
    captions,
    voice,
    ms: { slide: 3500, chain: 3500, result: 3000 },
    hint: equalForm
      ? data.negative
        ? { caption: copy.hint_negative, voice: 'v_sort.opposite' }
        : { caption: copy.hint_equal, voice: 'v_sort.equal' }
      : { caption: copy.hint_sum, voice: 'v_arrow.hint_sum' },
    studentAnswer: remedial ? studentAnswer : undefined,
    purpose,
  });
}
