import { describe, expect, it } from 'vitest';
import { th } from '@/lib/content/th';
import { generate } from '@/lib/topics/matrix/generators';
import { CATALOG } from '@/lib/topics/matrix/misconceptions';
import { MAX_NOTE_UNITS, noteFor, pathStepFor, stripNote } from './pathStep';
import type { PathKind, PathStep, PendingTurn } from './types';

const KINDS = Object.keys(th.pathNotes) as PathKind[];
const NEEDS_NAME: PathKind[] = ['probe', 'pretest_probe', 'remediate'];
const DIGIT = /[0-9๐-๙]/;

const everyNote = KINDS.flatMap((kind) =>
  NEEDS_NAME.includes(kind) ? CATALOG.map(({ id }) => noteFor(kind, id)) : [noteFor(kind)],
);

describe('path notes (AI_DIRECTOR §3.2)', () => {
  it('has a short name of at most 16 code units for every ★ misconception', () => {
    for (const { id } of CATALOG) {
      expect(th.misconceptionShort[id].length).toBeLessThanOrEqual(16);
    }
  });

  it.each(everyNote)('stays within 40 code units with no digits: %s', (note) => {
    expect(note.length).toBeLessThanOrEqual(MAX_NOTE_UNITS);
    expect(note).not.toMatch(DIGIT);
    expect(note).not.toMatch(/[{}]/);
  });

  it('reaches the limit exactly at the longest name, so the screen check matters', () => {
    expect(noteFor('remediate', 'M03_TRANSPOSE_WRONG')).toHaveLength(MAX_NOTE_UNITS);
  });

  it('uses the wording of the table', () => {
    expect(noteFor('probe', 'M09_MULT_ELEMENTWISE')).toBe('เพิ่มข้อนี้เพราะเมื่อกี้คูณทีละช่อง');
    expect(noteFor('remediate', 'M09_MULT_ELEMENTWISE')).toBe(
      'พาดูคลิปนี้เพราะเมื่อกี้คูณทีละช่อง',
    );
    expect(noteFor('pretest_probe', 'M20_INV2_RECIPE')).toBe('ตอนแบบทดสอบขาดขั้นอินเวอร์ส');
    expect(noteFor('review')).toBe('เรื่องนี้ผ่านมาสักพัก ขอทบทวนหน่อย');
  });

  it('gives the fixed path no reason (AI_DIRECTOR §3.1)', () => {
    expect(noteFor('fixed')).toBe('');
  });
});

describe('stripNote', () => {
  const step = (kind: PathKind, note: string): PathStep => ({
    kind,
    skill: 'mult',
    level: 1,
    note,
  });
  const probe = generate({ skill: 'mult', difficulty: 1, seed: 1, target: 'M09_MULT_ELEMENTWISE' });
  const clipNote = noteFor('remediate', 'M09_MULT_ELEMENTWISE');
  const remediate = step('remediate', clipNote);
  const open = { ref: probe.ref, hintLevel: 0 as const };
  const pending = {} as PendingTurn;

  it('is empty before the first step', () => {
    expect(stripNote({ path: [] })).toBe('');
  });

  it('shows the latest note', () => {
    expect(stripNote({ path: [step('start', 'a'), step('review', 'b')] })).toBe('b');
  });

  it('says why the clip is coming while the feedback is up', () => {
    expect(stripNote({ path: [remediate], pending, current: open })).toBe(clipNote);
  });

  it('says why this item is here once the clip has played', () => {
    expect(stripNote({ path: [remediate], current: open })).toBe(
      noteFor('probe', 'M09_MULT_ELEMENTWISE'),
    );
  });

  it('goes back to the reason for the item after "ไม่เข้าใจ"', () => {
    const path = [step('review', 'b'), step('request', noteFor('request'))];
    expect(stripNote({ path })).toBe('b');
  });
});

describe('pathStepFor', () => {
  it('reports the real level of the item, which a probe can move', () => {
    const step = pathStepFor(
      {
        stepKind: 'probe',
        misconception: 'M05_SUB_REVERSED',
        next: { skill: 'addsub', level: 2, purpose: 'probe', target: 'M05_SUB_REVERSED' },
      },
      2,
    );
    expect(step).toEqual({
      kind: 'probe',
      skill: 'addsub',
      level: 2,
      note: 'เพิ่มข้อนี้เพราะเมื่อกี้ลบสลับลำดับ',
    });
  });
});
