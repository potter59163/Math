import { describe, expect, it } from 'vitest';
import { CONFIG } from '@/lib/config';
import {
  changeFor,
  findStudent,
  handleOf,
  render,
  RULES as SCRIPT_RULES,
  summarize,
} from './photo-reports.mjs';

// The part of `npm run photos` that decides what Potter is shown and what a command writes. The
// command itself (scripts/review-photos.mjs) only reads the database and applies it.

const RULES = { ...CONFIG.photoReports };

/** A row of the list, as the script (plain JavaScript) builds it. */
interface SummaryRow {
  handle: string;
  name: string;
  group: string;
  state: string;
  reports: number;
  takedowns: number;
  last: string | null;
}
const NOW = new Date('2026-11-27T05:00:00.000Z');
const DAY = 86_400_000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);

const owner = (id: string, more: Record<string, unknown> = {}) => ({
  _id: id,
  display_name: `ชื่อ ${id.slice(0, 2)}`,
  show_on_leaderboard: true,
  photo_at: ago(3),
  photo_key: `key-of-${id}`,
  show_photo: true,
  ...more,
});
const report = (photo: string, reporter: string, days = 0) => ({
  _id: `${photo}:${reporter}`,
  photo_key: photo,
  owner_id: 'whoever',
  reporter_id: reporter,
  created_at: ago(days),
});

describe('the rules the command runs by', () => {
  it('are the ones the app runs by', () => {
    expect(SCRIPT_RULES).toEqual(RULES);
  });
});

describe('summarize', () => {
  const tables = {
    profiles: [
      owner('aaaaaaaa-1111'),
      owner('bbbbbbbb-2222', { show_photo: false, photo_reported_at: ago(1), photo_takedowns: 1 }),
      owner('cccccccc-3333', { show_photo: false, photo_locked: true, photo_takedowns: 2 }),
      owner('dddddddd-4444'),
      owner('eeeeeeee-5555', { cohort: 'm5-1' }),
    ],
    reports: [
      report('key-of-aaaaaaaa-1111', 'r1'),
      report('key-of-aaaaaaaa-1111', 'r2', 2),
      report('key-of-bbbbbbbb-2222', 'r1', 1),
      report('key-of-bbbbbbbb-2222', 'r2', 1),
      report('key-of-bbbbbbbb-2222', 'r3', 1),
      // Of a photo its owner has since replaced: not held against the one they have now.
      report('an-older-key-of-eeeeeeee', 'r1', 20),
    ],
  };

  it('lists whoever was reported, came down or is locked, the most reported first', () => {
    const rows: SummaryRow[] = summarize(tables, NOW, RULES).rows;
    expect(
      rows.map(({ handle, state, reports, takedowns }) => [handle, state, reports, takedowns]),
    ).toEqual([
      ['bbbbbbbb', 'taken down', 3, 1],
      ['aaaaaaaa', 'shown', 2, 0],
      ['cccccccc', 'locked', 0, 2],
    ]);
    expect(rows[1].last).toBe(NOW.toISOString());
  });

  it('can also list every photo that is on the board, to find one nobody reported yet', () => {
    const rows: SummaryRow[] = summarize(tables, NOW, RULES, { everyone: true }).rows;
    expect(rows.map(({ handle, state }) => [handle, state])).toEqual([
      ['bbbbbbbb', 'taken down'],
      ['aaaaaaaa', 'shown'],
      ['cccccccc', 'locked'],
      ['dddddddd', 'shown'],
      ['eeeeeeee', 'shown'],
    ]);
    expect(rows[4].group).toBe('m5-1');
  });

  it('never names a reporter, by id or otherwise', () => {
    const summary = summarize(tables, NOW, RULES);
    const text = JSON.stringify(summary) + render(summary);
    for (const reporter of ['r1', 'r2', 'r3']) expect(text).not.toContain(`"${reporter}"`);
    expect(summary.busiest).toEqual([
      { reporter: 'A', count: 2 },
      { reporter: 'B', count: 2 },
      { reporter: 'C', count: 1 },
    ]);
  });

  it('points at a few students who used up all their reports together', () => {
    const photos = ['p1', 'p2', 'p3', 'p4', 'p5'];
    const gang = {
      profiles: photos.map((photo) => owner(`${photo}-owner-id`, { photo_key: photo })),
      reports: photos.flatMap((photo) => ['g1', 'g2', 'g3'].map((who) => report(photo, who))),
    };
    const text = render(summarize(gang, NOW, RULES));
    expect(text).toContain('3 reporters used all 5 of their reports this week');
    expect(render(summarize(tables, NOW, RULES))).not.toContain('used all');
  });

  it('keeps its columns apart, however long a class label is', () => {
    const long = {
      profiles: [owner('aaaaaaaa-1111', { cohort: 'ห้องเรียนพิเศษ-2569-ก' })],
      reports: [report('key-of-aaaaaaaa-1111', 'r1')],
    };
    const row = render(summarize(long, NOW, RULES)).split('\n')[1];
    expect(row).toMatch(/^aaaaaaaa {2}shown {7}1\/3 {6}0\/2 {9}ห้องเรียนพิเศษ-2569-ก {2}ชื่อ aa$/);
  });

  it('says so when there is nothing to look at', () => {
    const text = render(summarize({ profiles: [owner('aaaaaaaa-1111')], reports: [] }, NOW, RULES));
    expect(text).toContain('No photo has been reported.');
  });
});

describe('findStudent', () => {
  const profiles = [owner('aaaaaaaa-1111'), owner('aaaaaaab-2222'), owner('bbbbbbbb-3333')];

  it('finds the one student a handle means', () => {
    expect(findStudent(profiles, handleOf('bbbbbbbb-3333')).profile?._id).toBe('bbbbbbbb-3333');
    expect(findStudent(profiles, 'aaaaaaab').profile?._id).toBe('aaaaaaab-2222');
  });

  it('refuses a handle that means nobody, more than one, or too little to tell', () => {
    expect(findStudent(profiles, 'cccccccc').error).toContain('No student');
    expect(findStudent(profiles, 'aaaaaaa').error).toContain('2 students');
    expect(findStudent(profiles, 'aaa').error).toContain('at least 6');
    expect(findStudent(profiles, undefined).error).toContain('at least 6');
  });
});

describe('changeFor', () => {
  it('takes a photo down as enough reports would, and locks at the same count', () => {
    expect(changeFor('hide', owner('a'), NOW, RULES)).toEqual({
      $set: { show_photo: false, photo_reported_at: NOW, photo_takedowns: 1 },
    });
    expect(changeFor('hide', owner('a', { photo_takedowns: 1 }), NOW, RULES)).toEqual({
      $set: { show_photo: false, photo_reported_at: NOW, photo_takedowns: 2, photo_locked: true },
    });
  });

  it('locks, and clears everything a report can leave on a student', () => {
    expect(changeFor('lock', owner('a'), NOW, RULES)).toEqual({
      $set: { show_photo: false, photo_locked: true },
    });
    expect(changeFor('clear', owner('a'), NOW, RULES)).toEqual({
      $unset: { photo_reported_at: '', photo_takedowns: '', photo_locked: '' },
    });
    expect(changeFor('delete', owner('a'), NOW, RULES)).toBeNull();
  });
});
