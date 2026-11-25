import { describe, expect, it } from 'vitest';
import { prepareAttempt } from '@/lib/director/rules';
import { newProfile } from '@/lib/director/turn';
import { misconceptionAnswer } from '@/lib/sim/answers';
import { generate } from '@/lib/topics/matrix/generators';
import { buildDirectorInput } from './input';
import { systemPrompt } from './prompt';

// The prompt and the input for matrices were frozen before the topic packs came in, and the refactor kept
// them to the byte. The prompt has changed on purpose once since: for Claude Sonnet 5.5 on 25 Nov 2026
// (length, short comparisons, the maths words it may use), measured with npm run eval:director. Any
// other change to these snapshots is a change to what every student's tutor is told: run the eval.

const AT = 1_800_000_000_000;

describe('the matrix prompt', () => {
  it('is the frozen text, so any change to it is deliberate', async () => {
    await expect(systemPrompt()).toMatchFileSnapshot('./__snapshots__/matrixPrompt.txt');
  });

  it('is the same with another app name', async () => {
    await expect(systemPrompt('Test')).toMatchFileSnapshot('./__snapshots__/matrixPromptTest.txt');
  });
});

describe('the matrix input', () => {
  it('is the input it was before the topic packs', async () => {
    const student = newProfile({ id: 'secret-user-id', units: [1, 2, 3, 4, 5], theme: 'game' });
    const inputs = (
      [
        ['mult', 1, 3, 'M09_MULT_ELEMENTWISE'],
        ['addsub', 2, 11, 'M05_SUB_REVERSED'],
        ['det2', 1, 7, 'M12_DET2_FORMULA'],
        ['dim', 1, 5, 'M01_DIM_SWAP'],
      ] as const
    ).map(([skill, difficulty, seed, target]) => {
      const item = generate({ skill, difficulty, seed, target });
      const answer = misconceptionAnswer(item, target)!;
      const prepared = prepareAttempt(student, {
        item,
        answer,
        hintLevel: 0,
        timeMs: 41000,
        at: AT,
      });
      return buildDirectorInput(prepared, 41000, 0);
    });
    await expect(JSON.stringify(inputs, null, 2)).toMatchFileSnapshot(
      './__snapshots__/matrixInput.json',
    );
  });
});
