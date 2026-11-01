import { describe, expect, it } from 'vitest';
import { th } from '@/lib/content/th';
import { generate } from '@/lib/topics/matrix/generators';
import type { MatrixItem } from '@/lib/topics/matrix/types';
import { prepareAttempt, commitAttempt, submitAttempt } from './rules';
import { misconceptionAnswer } from '@/lib/sim/answers';
import { newProfile } from './turn';
import type { Profile } from './types';

const AT = 1_800_000_000_000;

const student = (id: string): Profile => newProfile({ id, units: [1, 2, 3, 4, 5] });

const multItem = (seed: number): MatrixItem =>
  generate({ skill: 'mult', difficulty: 1, seed, target: 'M09_MULT_ELEMENTWISE' });

const allLines = Object.values(th.tutor.messages).flat();

describe("the rules' own words", () => {
  it('always has something to say', () => {
    for (let seed = 1; seed < 40; seed += 1) {
      const item = multItem(seed);
      const { turn } = submitAttempt(student(`s${seed}`), {
        item,
        answer: item.correct,
        hintLevel: 0,
        timeMs: 1,
        at: AT,
      });
      expect(turn.message).toBeTruthy();
    }
  });

  it('says the same line again for the same student and item, as a reload and the server need', () => {
    const item = multItem(1);
    const event = { item, answer: item.correct, hintLevel: 0 as const, timeMs: 1, at: AT };
    expect(submitAttempt(student('a'), event).turn.message).toBe(
      submitAttempt(student('a'), event).turn.message,
    );
  });

  it('does not say the same line to everyone', () => {
    const item = multItem(1);
    const event = { item, answer: item.correct, hintLevel: 0 as const, timeMs: 1, at: AT };
    const lines = new Set(
      Array.from({ length: 30 }, (_, n) => submitAttempt(student(`s${n}`), event).turn.message),
    );
    expect(lines.size).toBeGreaterThan(1);
  });

  it("points at the student's own cell when they were caught, with numbers from the engine", () => {
    const item = multItem(3);
    const answer = misconceptionAnswer(item, 'M09_MULT_ELEMENTWISE')!;
    const prepared = prepareAttempt(student('a'), {
      item,
      answer,
      hintLevel: 0,
      timeMs: 1,
      at: AT,
    });
    const { turn } = commitAttempt(prepared);
    expect(turn.message).toMatch(/แถว \d+ หลัก \d+/);
    expect(turn.message).not.toContain('{{');
  });

  it('never leaves a token unfilled', () => {
    for (let seed = 1; seed < 60; seed += 1) {
      const item = multItem(seed);
      const answer = misconceptionAnswer(item, 'M09_MULT_ELEMENTWISE') ?? item.correct;
      const { turn } = submitAttempt(student(`s${seed}`), {
        item,
        answer,
        hintLevel: 0,
        timeMs: 1,
        at: AT,
      });
      expect(turn.message).not.toMatch(/[{}]/);
    }
  });

  it("gives the tutor's words way when it has some", () => {
    const item = multItem(1);
    const prepared = prepareAttempt(student('a'), {
      item,
      answer: item.correct,
      hintLevel: 0,
      timeMs: 1,
      at: AT,
    });
    expect(commitAttempt(prepared, undefined, { message: 'คำของคิว' }).turn.message).toBe(
      'คำของคิว',
    );
  });

  it('stays silent for the control group, which sees no tutor (AI_DIRECTOR §3.1)', () => {
    const item = generate({ skill: 'dim', difficulty: 1, seed: 1 });
    const { turn } = submitAttempt(
      student('a'),
      { item, answer: item.correct, hintLevel: 0, timeMs: 1, at: AT },
      'fixed',
    );
    expect(turn.message).toBeUndefined();
  });

  it('never calls a student clever or not, so praise stays on the thinking', () => {
    for (const line of allLines) expect(line).not.toMatch(/เก่ง|โง่|ฉลาด/);
  });
});
