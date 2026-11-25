import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { packOf } from '@/lib/topics';
import { exportBeforeVectors } from './research-export.frozen.mjs';
import { MISCONCEPTIONS, researchExport } from './research-export.mjs';
import type { Row, Tables } from './research-export.fixtures';

// The export must give a class that did matrices only exactly what it gave before vectors came in.
// research-export.frozen.mjs is that export, kept as it was.

const matrix = packOf('matrix');
const MATRIX_SKILLS = matrix.skills.map(({ id }) => id);
const M_CODES = matrix.catalog.map(({ id }) => id);

const USERS = ['u-1', 'u-2', 'u-3', 'u-4', 'u-5'];
const ASSESSMENTS = ['t-1', 't-2', 't-3', 't-4', 't-5', 't-6'];
// Mostly the whole class, as `npm run export` with no cohort gives.
const cohort = fc.oneof(
  { arbitrary: fc.constant(undefined), weight: 3 },
  { arbitrary: fc.constantFrom('m5-1', 'm5-2', 'nobody'), weight: 1 },
);

/** Plain objects, as MongoDB returns them, with every key there unless `optional` names it. */
function record(model: Record<string, fc.Arbitrary<unknown>>, optional: string[] = []) {
  const requiredKeys = Object.keys(model).filter((key) => !optional.includes(key));
  return fc.record(model, { requiredKeys, noNullPrototype: true }) as fc.Arbitrary<Row>;
}

const map = (key: fc.Arbitrary<string>, value: fc.Arbitrary<unknown>) =>
  fc.dictionary(key, value, { noNullPrototype: true }) as fc.Arbitrary<Row>;

const day = fc.date({
  min: new Date('2026-11-01T00:00:00Z'),
  max: new Date('2026-12-31T00:00:00Z'),
  noInvalidDate: true,
});
// A few join times only, so that some students joined at the same moment.
const joined = fc.constantFrom(...[1, 2, 3].map((n) => new Date(`2026-11-1${n}T09:00:00+07:00`)));
// What a CSV cell has to quote (commas, quotes, line breaks), and Thai with its marks.
const text = fc.string({
  unit: fc.constantFrom('a', 'B', ' ', ',', '"', '\n', 'ก', '่', '1'),
  maxLength: 8,
});
const id = fc.string({ unit: fc.constantFrom('a', 'b', '1', '2'), minLength: 1, maxLength: 5 });
const user = fc.constantFrom(...USERS, 'stranger');
const level = fc.constantFrom(1, 2, 3);

const storedAnswer = fc.oneof(
  record({
    kind: fc.constant('matrix'),
    value: fc.array(fc.array(text, { maxLength: 3 }), { maxLength: 3 }),
  }),
  record({ kind: fc.constant('scalar'), value: fc.constantFrom('-3/2', '0', '12') }),
  record({ kind: fc.constant('dims'), rows: fc.nat(4), cols: fc.nat(4) }),
  record({ kind: fc.constant('choice'), id: text }),
  fc.constant({ kind: 'undefined' }),
);

/** As `assemble` builds it, except that a row from before topics would name none. */
const matrixRef = record(
  {
    topic: fc.constant('matrix'),
    skill: fc.constantFrom(...MATRIX_SKILLS),
    difficulty: level,
    seed: fc.nat(),
    target: fc.constantFrom(...M_CODES),
    gv: fc.constant(2),
  },
  ['topic', 'target'],
);

/** As `attemptRow` in lib/server/store.ts writes it. */
const attemptOf = (ref: fc.Arbitrary<Row>) =>
  fc
    .tuple(
      ref,
      record({
        _id: id,
        user_id: user,
        device_id: fc.constantFrom('d-1', 'd-2'),
        seq: fc.nat(99),
        kind: fc.constantFrom('matrix', 'scalar', 'dims', 'choice'),
        answer: storedAnswer,
        classification: fc.constantFrom(
          'correct',
          'misconception',
          'slip',
          'shape_error',
          'unknown',
        ),
        misconception: fc.option(text, { nil: null }),
        variant: fc.option(text, { nil: null }),
        wrong_cells: fc.option(fc.array(fc.tuple(fc.nat(3), fc.nat(3)), { maxLength: 1 }), {
          nil: null,
        }),
        time_ms: fc.nat(600_000),
        hint_level: fc.constantFrom(0, 1, 2, 3),
        xp: fc.nat(30),
        created_at: day,
      }),
    )
    .map(([item_ref, row]): Row => ({
      ...row,
      item_ref,
      skill: item_ref.skill,
      difficulty: item_ref.difficulty,
      target: item_ref.target ?? null,
    }));

const candidateOf = (skill: fc.Arbitrary<string>, misconception: fc.Arbitrary<string>) =>
  record(
    {
      id: fc.constantFrom('c1', 'c2', 'c3', 'c4'),
      rule: fc.constantFrom('R1', 'R2', 'R5', 'R7', 'start', 'request', 'fixed'),
      score: fc.double({ min: 0, max: 1, noNaN: true }),
      scene: record({ template: text, beats: fc.array(text, { maxLength: 3 }) }),
      next: record(
        {
          skill,
          level,
          purpose: fc.constantFrom('practice', 'probe', 'review', 'challenge', 'resume'),
          target: misconception,
        },
        ['target'],
      ),
      ruleReason: text,
      stepKind: fc.constantFrom('probe', 'remediate', 'same_level', 'concept'),
      misconception,
    },
    ['scene', 'misconception'],
  );

/** As `decisionRow` writes it. Every one the store writes has its candidates; this may have none. */
const decisionOf = (candidates: fc.Arbitrary<Row[]>) =>
  record(
    {
      _id: id,
      user_id: user,
      attempt_id: fc.option(id, { nil: null }),
      trigger: fc.constantFrom('session_start', 'after_attempt', 'student_request'),
      mode: fc.constantFrom('rules', 'fixed', 'llm'),
      candidates,
      choice: fc.constantFrom('c1', 'c2', 'c3', 'c4'),
      message: fc.option(text, { nil: null }),
      path_note: text,
      narration: fc.option(map(text, text), { nil: null }),
      reason: text,
      latency_ms: fc.option(fc.nat(9_000), { nil: null }),
      fallback_reason: fc.constantFrom(null, 'generator', 'disabled', 'timeout', 'schema_invalid'),
      created_at: day,
    },
    ['candidates'],
  );

const matrixCandidates = fc.array(
  candidateOf(fc.constantFrom(...MATRIX_SKILLS), fc.constantFrom(...M_CODES)),
  { maxLength: 4 },
);

const sceneView = record({
  _id: id,
  user_id: user,
  template: fc.constantFrom('cell_by_cell', 'dimension_match', 'sarrus', 'worked_solution'),
  purpose: fc.constantFrom('intro', 'concept', 'remediate', 'request', 'reveal'),
  beats_total: fc.nat(8),
  beats_seen: fc.nat(8),
  replays: fc.nat(3),
  skipped: fc.boolean(),
  duration_ms: fc.nat(90_000),
  created_at: day,
});

const hintOf = (ref: fc.Arbitrary<Row | null>) =>
  record({ _id: id, user_id: user, item_ref: ref, level: level, created_at: day });

const assessment = record({
  _id: fc.constantFrom(...ASSESSMENTS),
  user_id: user,
  phase: fc.constantFrom('pre', 'post'),
  form: fc.constantFrom('A', 'B'),
  score: fc.nat(14),
  total: fc.integer({ min: 1, max: 14 }),
  started_at: day,
  submitted_at: day,
});

const response = record({
  _id: id,
  assessment_id: fc.constantFrom(...ASSESSMENTS, 'gone'),
  item_no: fc.integer({ min: 1, max: 14 }),
  item_ref: matrixRef,
  answer: fc.option(storedAnswer, { nil: null }),
  correct: fc.boolean(),
  misconception: fc.option(fc.constantFrom(...M_CODES), { nil: null }),
  variant: fc.option(text, { nil: null }),
  time_ms: fc.option(fc.nat(90_000), { nil: null }),
});

const skillState = record(
  {
    pKnown: fc.double({ min: 0, max: 1, noNaN: true }),
    level,
    attempts: fc.array(
      record({ level, countsCorrect: fc.boolean(), clean: fc.boolean(), timeMs: fc.nat(90_000) }),
      { maxLength: 3 },
    ),
    passed: fc.boolean(),
    wrongStreak: fc.nat(4),
    stuck: fc.boolean(),
    lastSeen: fc.nat(40),
    pretestCorrect: fc.boolean(),
  },
  ['pretestCorrect'],
);

const misconceptionState = record(
  {
    status: fc.constantFrom('suspected', 'active', 'resolved'),
    count: fc.nat(5),
    fixStreak: fc.nat(3),
    variant: text,
    scenesSeen: fc.nat(3),
    openedAtItem: fc.nat(40),
    openedAtMs: fc.nat(),
    lastCaughtAtItem: fc.nat(40),
    itemsToResolve: fc.nat(20),
    msToResolve: fc.nat(900_000),
    relapses: fc.nat(2),
    rewarded: fc.boolean(),
    fromPretest: fc.boolean(),
  },
  ['variant', 'itemsToResolve', 'msToResolve', 'relapses', 'fromPretest'],
);

/** A profile as the app keeps it. The app always gives it both maps; here they may be missing. */
const matrixProfile = record(
  {
    student: record(
      {
        id: text,
        units: fc.subarray([1, 2, 3, 4, 5]),
        theme: fc.constantFrom('shop', 'game', 'sport', 'music', 'food'),
        activeTopic: fc.constant('matrix'),
      },
      ['theme', 'activeTopic'],
    ),
    counter: fc.nat(60),
    xp: fc.nat(900),
    combo: fc.nat(5),
    bestCombo: fc.nat(9),
    itemsDone: fc.nat(40),
    skills: map(fc.constantFrom(...MATRIX_SKILLS), skillState),
    misconceptions: map(fc.constantFrom(...M_CODES), misconceptionState),
    clipsSeen: fc.subarray(MATRIX_SKILLS),
    lastReviewAt: fc.nat(40),
    path: fc.array(
      record({
        kind: fc.constantFrom('probe', 'worked', 'level_up'),
        skill: fc.constantFrom(...MATRIX_SKILLS),
        level,
        note: text,
      }),
      { maxLength: 2 },
    ),
    current: record({ ref: matrixRef, hintLevel: fc.constantFrom(0, 1, 2, 3) }),
  },
  ['student', 'skills', 'misconceptions', 'current'],
);

const account = record(
  {
    _id: fc.constantFrom(...USERS),
    display_name: text,
    condition: fc.constantFrom('adaptive', 'fixed'),
    // Now and then someone who never gave consent, whom no export may keep.
    consent_at: fc.option(day, { nil: undefined, freq: 5 }),
    cohort: fc.constantFrom('m5-1', 'm5-2'),
    form_pre: fc.constantFrom('A', 'B'),
    form_post: fc.constantFrom('A', 'B'),
    created_at: joined,
  },
  ['cohort', 'form_pre', 'form_post'],
);

const byId = (row: Row) => row._id;

/** Every collection the export reads, from a class that has done matrices only. */
const matrixTables = record({
  profiles: fc.uniqueArray(account, { selector: byId, minLength: 1, maxLength: USERS.length }),
  attempts: fc.array(attemptOf(matrixRef), { maxLength: 12 }),
  decisions: fc.array(decisionOf(matrixCandidates), { maxLength: 8 }),
  scene_views: fc.array(sceneView, { maxLength: 6 }),
  hint_events: fc.array(hintOf(fc.option(matrixRef, { nil: null })), { maxLength: 6 }),
  assessments: fc.uniqueArray(assessment, { selector: byId, maxLength: ASSESSMENTS.length }),
  assessment_responses: fc.array(response, { maxLength: 10 }),
  learner_profiles: fc.uniqueArray(
    record({ _id: user, profile: matrixProfile, rev: fc.nat(50), updated_at: day }),
    { selector: byId, maxLength: USERS.length + 1 },
  ),
}) as fc.Arbitrary<Tables>;

/** Files in the order they are written, then the count the script prints. */
const outputOf = ({ files, students }: { files: Map<string, string>; students: number }) => ({
  files: [...files],
  students,
});

describe('the research export', () => {
  it('gives a class that did matrices only what it gave before vectors', () => {
    fc.assert(
      fc.property(matrixTables, cohort, (tables, room) => {
        expect(outputOf(researchExport(tables, room))).toEqual(
          outputOf(exportBeforeVectors(tables, room)),
        );
      }),
    );
  });

  it('has a pre/post column for every misconception of the matrix catalog, in its order', () => {
    expect(MISCONCEPTIONS).toEqual(M_CODES);
  });
});
