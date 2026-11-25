import { thVector } from '@/lib/content/th.vector';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer } from '@/lib/core/types';
import { QUANTITY_KIND, QUANTITY_PARTNER, quantityKey, quantityMatches } from '../solve';
import type { DataOf, Quantity } from '../types';
import { beatsOf, choiceOf, scene } from './build';
import type { QuantityBeat, ScenePurpose, VectorSceneOf } from './types';
import type { VoiceId } from './voice';

const label = (quantity: Quantity): string => thVector.choices[quantityKey(quantity)];

export interface QuantitySortInput {
  data: DataOf<'quantity_kind'>;
  purpose: ScenePurpose;
  /** The quantity a student picked (V01). */
  studentAnswer?: Answer;
}

/** VECTORS §5 `quantity_sort`: cards, "does it need a direction?", then two piles. Intro V1 adds arrows. */
export function quantitySortScene({
  data,
  purpose,
  studentAnswer,
}: QuantitySortInput): VectorSceneOf<'quantity_sort'> {
  const copy = thVector.scenes.sort;
  const { options, ask } = data;
  const [answer] = quantityMatches(data);
  const partner = QUANTITY_PARTNER[answer];
  const vectorOne = QUANTITY_KIND[answer] === 'vector' ? answer : partner;
  const scalarOne = QUANTITY_KIND[answer] === 'vector' ? partner : answer;
  const pair: [number, number] | undefined =
    vectorOne && scalarOne && options.includes(vectorOne) && options.includes(scalarOne)
      ? [options.indexOf(vectorOne), options.indexOf(scalarOne)]
      : undefined;
  const picked =
    studentAnswer?.kind === 'choice'
      ? options.findIndex((quantity) => quantityKey(quantity) === studentAnswer.id)
      : -1;
  const student = picked >= 0 ? picked : undefined;
  const remedial = student !== undefined && pair !== undefined;
  const intro = purpose === 'intro';

  const beats = beatsOf<QuantityBeat>(
    remedial && 'compare',
    !remedial && 'cards',
    'ask',
    'sort',
    pair && 'pair',
    intro && 'arrow',
    intro && 'equal',
    intro && 'opposite',
    remedial && 'try',
    (remedial || purpose !== 'concept') && 'end',
  );

  const mine = student === undefined ? '' : label(options[student]);
  const kindWord = (quantity: Quantity) =>
    QUANTITY_KIND[quantity] === 'vector' ? copy.vectorWord : copy.scalarWord;
  const right = ask === 'vector' ? vectorOne : scalarOne;
  const wrong = ask === 'vector' ? scalarOne : vectorOne;

  const voice: Partial<Record<QuantityBeat, VoiceId>> = {
    compare: 'v_sort.compare',
    cards: 'v_sort.cards',
    ask: 'v_sort.ask',
    sort: 'v_sort.sort',
    pair: 'v_sort.pair',
    arrow: 'v_sort.arrow',
    equal: 'v_sort.equal',
    opposite: 'v_sort.opposite',
    try: ask === 'vector' ? 'v_sort.try_vector' : 'v_sort.try_scalar',
    end: 'v_sort.end',
  };

  return scene({
    template: 'quantity_sort',
    params: {
      cards: options.map((quantity) => ({ label: label(quantity), kind: QUANTITY_KIND[quantity] })),
      ask,
      answer: options.indexOf(answer),
      ...(student !== undefined && { student }),
      ...(pair && { pair }),
      ...(remedial &&
        right &&
        wrong && { try: choiceOf(label(right), [label(wrong)], options.length + student!) }),
    },
    beats,
    captions: {
      compare: fillTokens(copy.compare, {
        mine,
        kind: student === undefined ? '' : kindWord(options[student]),
      }),
      cards: intro ? copy.intro_cards : copy.cards,
      ask: copy.ask,
      sort: copy.sort,
      ...(vectorOne &&
        scalarOne && {
          pair: fillTokens(copy.pair, { vector: label(vectorOne), scalar: label(scalarOne) }),
        }),
      arrow: copy.arrow,
      equal: copy.equal,
      opposite: copy.opposite,
      try: ask === 'vector' ? copy.try_vector : copy.try_scalar,
      end: copy.end,
    },
    voice,
    ms: { sort: 3500, arrow: 4000, equal: 4000, opposite: 4000 },
    hint: { caption: copy.hint, voice: 'v_sort.hint' },
    studentAnswer,
    purpose,
  });
}
