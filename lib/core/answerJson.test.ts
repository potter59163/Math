import { describe, expect, it } from 'vitest';
import { restoreAnswer, storeAnswer } from './answerJson';
import { Rational } from './rational';
import type { Answer } from './types';

const ANSWERS: Answer[] = [
  {
    kind: 'matrix',
    value: [
      [Rational.of(-3, 2), Rational.of(0)],
      [Rational.of(5), Rational.of(1, 3)],
    ],
  },
  { kind: 'scalar', value: Rational.of(-7, 4) },
  { kind: 'dims', rows: 2, cols: 3 },
  { kind: 'choice', id: 'has_inverse' },
  { kind: 'undefined' },
];

describe('storeAnswer and restoreAnswer', () => {
  it.each(ANSWERS)('bring back the same answer through JSON: $kind', (answer) => {
    const text = JSON.stringify(storeAnswer(answer));
    expect(restoreAnswer(JSON.parse(text))).toEqual(answer);
  });

  it('write numbers the way SPEC §13 stores them', () => {
    expect(storeAnswer(ANSWERS[1])).toEqual({ kind: 'scalar', value: '-7/4' });
  });
});
