import { describe, expect, it, vi } from 'vitest';

// Vectors are switched on for this file only, as NEXT_PUBLIC_TOPICS=matrix,vector does in dev.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_TOPICS = 'matrix,vector';
});

import { CONFIG } from '@/lib/config';
import { currentItem } from '@/lib/director/items';
import { MAX_NOTE_UNITS, stripNote } from '@/lib/director/pathStep';
import { startSession, submitAttempt } from '@/lib/director/rules';
import { workedRequest, buildScene } from '@/lib/director/scene';
import { finishScene, newProfile } from '@/lib/director/turn';
import type { Profile } from '@/lib/director/types';
import { buildDirectorInput } from '@/lib/director/llm/input';
import { prepareAttempt } from '@/lib/director/rules';
import { feedbackFor } from '@/lib/practice/feedback';
import { hintAt } from '@/lib/practice/hints';
import { Surd } from '@/lib/core/surd';
import { misconceptionAnswer } from '@/lib/sim/answers';
import { activeTopicOf, packOfSkill } from '@/lib/topics';
import { generate } from '@/lib/topics/vector/generators';

const DIGIT = /[0-9๐-๙]/;
const AT = 1_800_000_000_000;

const settled = (profile: Profile): Profile => {
  let next = profile;
  while (next.pending?.turn.scenes.length) next = finishScene(next);
  return next;
};

const vectorStudent = (id = 'VEC-1') =>
  newProfile({ id, units: [1, 2, 3, 4, 5], activeTopic: 'vector' });

describe('with vectors as the active topic', () => {
  it('is switched on here', () => {
    expect(CONFIG.topics).toEqual(['matrix', 'vector']);
    expect(activeTopicOf(vectorStudent().student)).toBe('vector');
  });

  it('starts on the first vector skill, after a worked example as its lead clip', () => {
    const started = startSession(vectorStudent());
    const [clip] = started.pending?.turn.scenes ?? [];
    expect(clip?.request.kind).toBe('intro');
    expect(clip?.template).toBe('worked_solution');
    const item = currentItem(settled(started));
    expect(item?.ref).toMatchObject({ topic: 'vector', skill: 'v_quantity', difficulty: 1 });
  });

  it('catches a misconception, offers its clip and a probe, and notes why in a line with no digits', () => {
    const item = generate({
      skill: 'v_magnitude',
      difficulty: 1,
      seed: 5,
      target: 'V09_MAG_NO_ROOT',
    });
    const answer = misconceptionAnswer(item, 'V09_MAG_NO_ROOT')!;
    const profile = settled(startSession(vectorStudent('VEC-2')));
    const {
      profile: after,
      outcome,
      turn,
    } = submitAttempt(profile, {
      item,
      answer,
      hintLevel: 0,
      timeMs: 30_000,
      at: AT,
    });
    expect(outcome.classification).toMatchObject({ type: 'misconception', id: 'V09_MAG_NO_ROOT' });
    expect(feedbackFor(outcome.classification, 'vector').detail).toContain('ลืมถอดราก');

    const remediate = turn.candidates.find(({ scene }) => scene?.request.kind === 'remediate');
    expect(remediate?.scene?.template).toBe('worked_solution');
    for (const { next } of turn.candidates) {
      expect(packOfSkill(next.skill).id).toBe('vector');
      if (next.target) {
        expect(packOfSkill(next.skill).probeLevels(next.skill, next.target)).toContain(next.level);
      }
    }
    expect(turn.next?.target).toBe('V09_MAG_NO_ROOT');

    const note = stripNote(after);
    expect(note).toContain('ลืมถอดราก');
    expect(note.length).toBeLessThanOrEqual(MAX_NOTE_UNITS);
    expect(note).not.toMatch(DIGIT);
    expect(turn.message).not.toMatch(/แถว|หลัก/);

    // "ดูวิธีทำ" opens a worked solution of this very item.
    const spec = buildScene(workedRequest(item, answer, outcome.classification));
    expect(spec.template).toBe('worked_solution');
  });

  it('words a slip on a vector as a component', () => {
    const item = generate({ skill: 'v_points', difficulty: 2, seed: 3 });
    if (item.correct.kind !== 'vector') throw new Error('v_points answers with a vector');
    const value = item.correct.value.map((part, i) => (i === 2 ? part.addSame(Surd.of(7))! : part));
    const profile = settled(startSession(vectorStudent('VEC-3')));
    const { outcome } = submitAttempt(profile, {
      item,
      answer: { kind: 'vector', value },
      hintLevel: 0,
      timeMs: 30_000,
      at: AT,
    });
    expect(outcome.classification).toEqual({ type: 'slip', cell: [3, 1] });
    expect(feedbackFor(outcome.classification, 'vector').detail).toBe('ผิดแค่องค์ประกอบที่ 3');
  });

  it('gives hints from the vector copy', () => {
    const item = generate({ skill: 'v_dot', difficulty: 1, seed: 2 });
    expect(hintAt(item, 1, []).text.length).toBeGreaterThan(0);
    expect(hintAt(item, 2, ['V14_DOT_AS_DET']).text).toContain('คู่ตำแหน่งเดียวกัน');
    expect(hintAt(item, 3, []).latex).toBeDefined();
  });

  it('tells the tutor about vectors only, with no digit in a skill or level', () => {
    const item = generate({
      skill: 'v_magnitude',
      difficulty: 1,
      seed: 5,
      target: 'V09_MAG_NO_ROOT',
    });
    const answer = misconceptionAnswer(item, 'V09_MAG_NO_ROOT')!;
    const prepared = prepareAttempt(settled(startSession(vectorStudent('VEC-4'))), {
      item,
      answer,
      hintLevel: 0,
      timeMs: 30_000,
      at: AT,
    });
    const input = buildDirectorInput(prepared, 30_000, 0);
    expect(input.lastAttempt.skill).toBe('v_magnitude');
    expect(input.skills.every(({ id }) => id.startsWith('v_'))).toBe(true);
    expect(input.misconceptions.every(({ id }) => id.startsWith('V'))).toBe(true);
    expect(JSON.stringify(input.skills.map(({ nameTh, level }) => [nameTh, level]))).not.toMatch(
      DIGIT,
    );
  });
});
