import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { classify } from '@/lib/core/classify';
import { misconceptionAnswer } from '@/lib/sim/answers';
import { packOf } from '@/lib/topics';
import type { TemplateId as MatrixTemplate } from '@/lib/topics/matrix/scenes/types';
import type { VectorTemplate } from '@/lib/topics/vector/scenes/types';
import * as research from './research-export.mjs';
import { exportBeforeVectors } from './research-export.frozen.mjs';
import { matrixClass, withVectors, type Row, type Tables } from './research-export.fixtures';

// The export must give a class that did matrices only exactly what it gave before vectors came in, and
// a class that has started vectors the same files as if it had not (docs/VECTORS.md §6.2).
// research-export.frozen.mjs is the export as it was.

const { researchExport } = research;
const matrix = packOf('matrix');
const MATRIX_SKILLS = matrix.skills.map(({ id }) => id);
const M_CODES = matrix.catalog.map(({ id }) => id);
const vector = packOf('vector');
const VECTOR_SKILLS = vector.skills.map(({ id }) => id);
const V_CODES = vector.catalog.map(({ id }) => id);

// Every clip template of each pack, and no other, so one added to a pack does not compile here until it
// is listed. The vector pack's reveals play the matrices' worked_solution (VECTORS §5).
const MATRIX_TEMPLATES = Object.keys({
  cell_by_cell: 0,
  det_sum: 0,
  row_col_dot: 0,
  dimension_match: 0,
  grid_transform: 0,
  inverse_recipe: 0,
  worked_solution: 0,
  cell_locator: 0,
  transpose_flip: 0,
  sarrus: 0,
} satisfies Record<MatrixTemplate, 0>);
const VECTOR_TEMPLATES = Object.keys({
  quantity_sort: 0,
  arrow_chain: 0,
  component_steps: 0,
  parallel_scale: 0,
  magnitude_box: 0,
  unit_shrink: 0,
  dot_pairs: 0,
  angle_fan: 0,
  cross_cover: 0,
  area_volume: 0,
} satisfies Record<VectorTemplate, 0>);

/**
 * The template of every clip a pack plays, built through the pack as the director builds them: each
 * unit's intro, each skill's concept clip and solution at each level, and the clip of each mistake.
 */
function templatesPlayed(topic: 'matrix' | 'vector'): Set<string> {
  const pack = packOf(topic);
  const played = new Set<string>();
  for (const { id } of pack.units) played.add(pack.scenes.intro(id, { seed: 1 }).template);
  for (const { id: skill } of pack.skills) {
    for (const level of pack.levelsOf(skill)) {
      played.add(pack.scenes.concept(skill, { seed: 1, level }).template);
      const item = pack.generate({ skill, difficulty: level, seed: 1 });
      played.add(pack.scenes.reveal(item).template);
    }
  }
  for (const { id, skills } of pack.catalog) {
    for (const skill of skills) {
      for (const variant of pack.variantsOf(id)) {
        for (const level of pack.probeLevels(skill, id, variant)) {
          const item = pack.generate({
            skill,
            difficulty: level,
            seed: 1,
            target: id,
            targetVariant: variant,
          });
          const answer = misconceptionAnswer(item, id, variant);
          if (!answer) continue;
          const caught = classify(item, answer);
          if (caught.type !== 'misconception') continue;
          played.add(pack.scenes.remediate(item, answer, caught).template);
        }
      }
    }
  }
  return played;
}

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

/** As `decisionRow` writes it. Every one the store writes has its candidates; a test may leave them out. */
const decisionOf = (candidates: fc.Arbitrary<Row[]>, optional = ['candidates']) =>
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
    optional,
  );

const matrixCandidates = fc.array(
  candidateOf(fc.constantFrom(...MATRIX_SKILLS), fc.constantFrom(...M_CODES)),
  { maxLength: 4 },
);

/** As `writeLogs` stores a clip view. A row from before views named their topic has none. */
const viewOf = (topic: string, template: fc.Arbitrary<string>, optional = ['topic']) =>
  record(
    {
      _id: id,
      user_id: user,
      topic: fc.constant(topic),
      template,
      purpose: fc.constantFrom('intro', 'concept', 'remediate', 'request', 'reveal'),
      beats_total: fc.nat(8),
      beats_seen: fc.nat(8),
      replays: fc.nat(3),
      skipped: fc.boolean(),
      duration_ms: fc.nat(90_000),
      created_at: day,
    },
    optional,
  );

const sceneView = viewOf('matrix', fc.constantFrom(...MATRIX_TEMPLATES));

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

const vectorRef = record(
  {
    topic: fc.constant('vector'),
    skill: fc.constantFrom(...VECTOR_SKILLS),
    difficulty: level,
    seed: fc.nat(),
    target: fc.constantFrom(...V_CODES),
    gv: fc.constant(1),
  },
  ['target'],
);

// Each turn's candidates are all in the topic being learnt (lib/director/candidates.ts).
const vectorDecision = decisionOf(
  fc.array(candidateOf(fc.constantFrom(...VECTOR_SKILLS), fc.constantFrom(...V_CODES)), {
    minLength: 1,
    maxLength: 4,
  }),
  [],
);

/**
 * A vector clip: in a template of the vector pack's own, or a solution, whose template matrices play
 * too, so that only the topic it names tells it apart.
 */
const vectorView = fc.oneof(
  viewOf('vector', fc.constantFrom(...VECTOR_TEMPLATES)),
  viewOf('vector', fc.constant('worked_solution'), []),
);

/** Somewhere to put each one: a row's place among the others, or an entry's place in its map. */
const placed = <T>(what: fc.Arbitrary<T>, maxLength: number) =>
  fc.array(fc.tuple(fc.nat(), what), { maxLength });

/** What a class adds once vectors are on: rows in the shared collections and entries in the maps. */
const vectorWork = fc.record({
  attempts: placed(attemptOf(vectorRef), 6),
  decisions: placed(vectorDecision, 6),
  views: placed(vectorView, 4),
  hints: placed(hintOf(vectorRef), 4),
  skills: placed(fc.tuple(fc.nat(), fc.constantFrom(...VECTOR_SKILLS), skillState), 6),
  misconceptions: placed(fc.tuple(fc.nat(), fc.constantFrom(...V_CODES), misconceptionState), 6),
});
type VectorWork = typeof vectorWork extends fc.Arbitrary<infer T> ? T : never;

/** `rows` with `extra` put in among them. The rows that were there keep their order. */
function among(rows: Row[], extra: [number, Row][]): Row[] {
  const mixed = [...rows];
  for (const [at, row] of extra) mixed.splice(at % (mixed.length + 1), 0, row);
  return mixed;
}

/** A map's entries with those of `extra` that are this learner's put in among them. */
function amongEntries(map: unknown, extra: [number, [number, string, Row]][], mine: Predicate) {
  if (map === undefined) return undefined;
  const entries = Object.entries(map as Row);
  for (const [at, [learner, key, value]] of extra) {
    if (mine(learner)) entries.splice(at % (entries.length + 1), 0, [key, value]);
  }
  return Object.fromEntries(entries);
}
type Predicate = (learner: number) => boolean;

/** The class after it has also done this vector work. A map that a profile lacks stays out. */
function withWork(tables: Tables, work: VectorWork): Tables {
  const learners = tables.learner_profiles.length;
  return {
    ...tables,
    attempts: among(tables.attempts, work.attempts),
    decisions: among(tables.decisions, work.decisions),
    scene_views: among(tables.scene_views, work.views),
    hint_events: among(tables.hint_events, work.hints),
    learner_profiles: tables.learner_profiles.map((row, index) => {
      const profile = row.profile as Row;
      const mine = (learner: number) => learner % learners === index;
      const skills = amongEntries(profile.skills, work.skills, mine);
      const misconceptions = amongEntries(profile.misconceptions, work.misconceptions, mine);
      return {
        ...row,
        profile: {
          ...profile,
          ...(skills && { skills }),
          ...(misconceptions && { misconceptions }),
        },
      };
    }),
  };
}

/** Files in the order they are written, then the count the script prints. */
const outputOf = ({ files, students }: { files: Map<string, string>; students: number }) => ({
  files: [...files],
  students,
});

/** One cell of research_wide.csv, for the student with this alias. */
function wideCell(files: Map<string, string>, alias: string, column: string): string | undefined {
  const [header, ...rows] = (files.get('research_wide.csv') ?? '').trimEnd().split('\n');
  const row = rows.find((line) => line.startsWith(`${alias},`))?.split(',');
  return row?.[header.split(',').indexOf(column)];
}

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

  it('gives a class that has started vectors what it would have got without them', () => {
    fc.assert(
      fc.property(matrixTables, vectorWork, cohort, (tables, work, room) => {
        expect(outputOf(researchExport(withWork(tables, work), room))).toEqual(
          outputOf(exportBeforeVectors(tables, room)),
        );
      }),
    );
  });

  it('leaves out the vector work the export used to count', () => {
    const before = exportBeforeVectors(withVectors()).files;
    const after = researchExport(withVectors()).files;
    // The old export counted S-1's vector answers, clips, skills, hint, fix and decisions as matrix work.
    for (const [column, counted, kept] of [
      ['items_done', '6', '4'],
      ['skills_reached', '5', '3'],
      ['skills_mastered', '2', '1'],
      ['scenes_viewed', '6', '3'],
      ['hints_used', '4', '3'],
      ['reveals', '2', '1'],
      ['misconceptions_resolved', '3', '2'],
      ['median_items_to_resolve', '3', '4.5'],
      ['llm_decisions', '2', '1'],
      ['fallback_rate', String(4 / 7), '0.5'],
      ['minutes_in_app', '4.1', '2.3'],
    ]) {
      expect([column, wideCell(before, 'S-1', column)]).toEqual([column, counted]);
      expect([column, wideCell(after, 'S-1', column)]).toEqual([column, kept]);
    }
    for (const name of [
      'attempts.csv',
      'decisions.csv',
      'hint_events.csv',
      'learner_profiles.csv',
    ]) {
      expect(before.get(name)).toMatch(/v_quantity/);
      expect(after.get(name)).not.toMatch(/v_[a-z]|V\d\d_/);
    }
    const vectorClip = new RegExp(VECTOR_TEMPLATES.join('|'));
    expect(before.get('scene_views.csv')).toMatch(vectorClip);
    expect(after.get('scene_views.csv')).not.toMatch(vectorClip);
    expect(outputOf(researchExport(withVectors()))).toEqual(
      outputOf(researchExport(matrixClass())),
    );
  });

  it('keeps a row that names no topic, which is a matrix row from before topics', () => {
    const tables = matrixClass();
    const attempts = researchExport(tables).files.get('attempts.csv') ?? '';
    expect(attempts).toContain('S-1,5,"{""skill"":""det2"",""difficulty"":1,""seed"":9,""gv"":2}"');
    expect(wideCell(researchExport(tables).files, 'S-1', 'items_done')).toBe('4');
  });

  it('keeps a clip view that names matrices, as the server logs them now, to the byte', () => {
    const tables = matrixClass();
    const named = {
      ...tables,
      scene_views: tables.scene_views.map((row, index) =>
        index % 2 === 0 ? { ...row, topic: 'matrix' } : row,
      ),
    };
    expect(named.scene_views.filter((row) => row.topic === 'matrix')).toHaveLength(3);
    expect(outputOf(researchExport(named))).toEqual(outputOf(exportBeforeVectors(tables)));
  });

  it('has a pre/post column for every misconception of the matrix catalog, in its order', () => {
    expect(research.MISCONCEPTIONS).toEqual(M_CODES);
  });

  it('keeps the skills of the matrix pack, which no vector skill is', () => {
    expect(research.MATRIX_SKILLS).toEqual(MATRIX_SKILLS);
    expect(VECTOR_SKILLS.filter((skill) => MATRIX_SKILLS.includes(skill))).toEqual([]);
    expect(V_CODES.filter((code) => M_CODES.includes(code))).toEqual([]);
  });

  it('leaves out the clips of the vector pack’s own templates, which no matrix clip plays', () => {
    expect(research.VECTOR_TEMPLATES).toEqual(VECTOR_TEMPLATES);
    expect(MATRIX_TEMPLATES.filter((template) => VECTOR_TEMPLATES.includes(template))).toEqual([]);
    // What the packs really play: each its own, and vectors the matrices' worked_solution too.
    expect([...templatesPlayed('matrix')].sort()).toEqual([...MATRIX_TEMPLATES].sort());
    expect([...templatesPlayed('vector')].sort()).toEqual(
      [...VECTOR_TEMPLATES, 'worked_solution'].sort(),
    );
  });
});
