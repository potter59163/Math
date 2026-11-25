// The research files of RESEARCH §5, worked out from the database's rows with no database or disk, so
// tests can hold them to what they were (research-export.test.ts). scripts/export-data.mjs does the
// reading and the writing. No name or Google account gets in: each student becomes S-1, S-2 and so on,
// in the order they joined.

/** Every collection the export reads. */
export const COLLECTIONS = [
  'profiles',
  'attempts',
  'decisions',
  'scene_views',
  'hint_events',
  'assessments',
  'assessment_responses',
  'learner_profiles',
];

function csv(rows, columns) {
  const cell = (value) => {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return `${[columns.join(','), ...rows.map((row) => columns.map((name) => cell(row[name])).join(','))].join('\n')}\n`;
}

// Vectors share these collections and the one flat profile, but the research is about matrices, so the
// files keep matrix work alone (docs/VECTORS.md §6.2). Ids never collide across topics, and the lists
// below are the packs' own, which research-export.test.ts keeps them in step with.

/** The matrix skills (lib/topics/matrix/skills.ts). */
export const MATRIX_SKILLS = [
  'dim',
  'index',
  'transpose',
  'addsub',
  'scalar',
  'mult_defined',
  'mult',
  'mult_noncomm',
  'det2',
  'det3',
  'det_props',
  'invertible',
  'inv2',
];

// The matrix catalog. research_wide.csv has one row per student (RESEARCH §5), with a pre and a post
// column for each: a form with no item for a misconception leaves its cell blank.
export const MISCONCEPTIONS = [
  'M01_DIM_SWAP',
  'M02_INDEX_SWAP',
  'M03_TRANSPOSE_WRONG',
  'M04_ADD_DIM_MISMATCH',
  'M05_SUB_REVERSED',
  'M07_SCALAR_PARTIAL',
  'M08_MULT_DIM_RULE',
  'M09_MULT_ELEMENTWISE',
  'M10_MULT_ROW_ROW',
  'M11_MULT_COMMUTATIVE',
  'M12_DET2_FORMULA',
  'M13_DET3_SIGN',
  'M14_DET_SCALAR_LINEAR',
  'M15_DET_ADDITIVE',
  'M18_INV_SINGULAR',
  'M19_INV_ZERO_ENTRY',
  'M20_INV2_RECIPE',
  'M21_INV_RECIPROCAL',
];
const ON_TEST = new Set(
  MISCONCEPTIONS.filter(
    (id) => !['M04_ADD_DIM_MISMATCH', 'M15_DET_ADDITIVE', 'M18_INV_SINGULAR'].includes(id),
  ),
);

/** The vector pack's own clip templates (lib/topics/vector/scenes/types.ts). */
export const VECTOR_TEMPLATES = [
  'quantity_sort',
  'arrow_chain',
  'component_steps',
  'parallel_scale',
  'magnitude_box',
  'unit_shrink',
  'dot_pairs',
  'angle_fan',
  'cross_cover',
  'area_volume',
];

const MATRIX_SKILL_IDS = new Set(MATRIX_SKILLS);
const M_CODES = new Set(MISCONCEPTIONS);
const VECTOR_TEMPLATE_IDS = new Set(VECTOR_TEMPLATES);

/** An item ref from before topics names none, and it is a matrix one. */
const isMatrixRef = (ref) => (ref?.topic ?? 'matrix') === 'matrix';

/** A decision is in the topic of the step it chose: every candidate of a turn is in the same one. */
function isMatrixDecision({ candidates, choice }) {
  const chosen = candidates?.find(({ id }) => id === choice) ?? candidates?.[0];
  const skill = chosen?.next?.skill;
  return skill === undefined || MATRIX_SKILL_IDS.has(skill);
}

/** The entries of a map keyed by id that `ids` has, in the order they were. */
const only = (ids, map) =>
  map && Object.fromEntries(Object.entries(map).filter(([id]) => ids.has(id)));

/** The learner model of matrices: the flat skill and misconception maps without another topic's ids. */
const matrixPart = (profile) => ({
  ...profile,
  skills: only(MATRIX_SKILL_IDS, profile.skills),
  misconceptions: only(M_CODES, profile.misconceptions),
});

const median = (values) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/**
 * The files for exports/, by name, from `tables`: each collection of COLLECTIONS as MongoDB returns it.
 * `cohort` keeps one class. research_wide.csv is left out when there is no one to export.
 */
export function researchExport(tables, cohort) {
  const all = (collection) => tables[collection] ?? [];
  const files = new Map();

  const profiles = all('profiles')
    .filter((row) => row.consent_at && (!cohort || row.cohort === cohort))
    .sort((a, b) => a.created_at - b.created_at);
  const aliasOf = new Map(profiles.map(({ _id }, index) => [_id, `S-${index + 1}`]));

  function exportTable(table, columns, isMatrix = () => true) {
    const rows = all(table)
      .filter((row) => aliasOf.has(row.user_id) && isMatrix(row))
      .map((row) => ({ ...row, id: String(row._id), alias: aliasOf.get(row.user_id) }));
    files.set(`${table}.csv`, csv(rows, ['alias', ...columns]));
    return rows;
  }
  const ofMatrixItem = (row) => isMatrixRef(row.item_ref);

  const attempts = exportTable(
    'attempts',
    [
      'seq',
      'item_ref',
      'skill',
      'difficulty',
      'kind',
      'target',
      'answer',
      'classification',
      'misconception',
      'variant',
      'wrong_cells',
      'time_ms',
      'hint_level',
      'xp',
      'created_at',
    ],
    ofMatrixItem,
  );
  const decisions = exportTable(
    'decisions',
    [
      'trigger',
      'mode',
      'candidates',
      'choice',
      'message',
      'path_note',
      'narration',
      'reason',
      'latency_ms',
      'fallback_reason',
      'created_at',
    ],
    isMatrixDecision,
  );
  // A clip view names no topic, but one of the vector pack's own templates is a vector clip. Vector
  // reveals play worked_solution, which matrices play too, so those are all kept.
  const views = exportTable(
    'scene_views',
    [
      'template',
      'purpose',
      'beats_total',
      'beats_seen',
      'replays',
      'skipped',
      'duration_ms',
      'created_at',
    ],
    (row) => !VECTOR_TEMPLATE_IDS.has(row.template),
  );
  const hints = exportTable('hint_events', ['item_ref', 'level', 'created_at'], ofMatrixItem);
  // Only the matrix test is wired into the app (docs/VECTORS.md §6.1).
  const assessments = exportTable('assessments', [
    'id',
    'phase',
    'form',
    'score',
    'total',
    'started_at',
    'submitted_at',
  ]);
  const responses = all('assessment_responses').filter((row) =>
    assessments.some(({ id }) => id === row.assessment_id),
  );
  files.set(
    'assessment_responses.csv',
    csv(responses, [
      'assessment_id',
      'item_no',
      'item_ref',
      'answer',
      'correct',
      'misconception',
      'variant',
      'time_ms',
    ]),
  );
  const learners = all('learner_profiles')
    .filter((row) => aliasOf.has(row._id))
    .map((row) => ({ ...row, profile: matrixPart(row.profile) }));
  files.set(
    'learner_profiles.csv',
    csv(
      learners.map(({ _id, profile }) => ({
        alias: aliasOf.get(_id),
        // The profile holds the account id as its seed source, so that one field stays behind.
        profile: {
          ...profile,
          student: { units: profile.student?.units, theme: profile.student?.theme },
        },
      })),
      ['alias', 'profile'],
    ),
  );

  const wide = profiles.map(({ _id: id, condition, form_pre, form_post }) => {
    const mine = (rows) => rows.filter((row) => row.user_id === id);
    const test = (phase) => mine(assessments).find((row) => row.phase === phase);
    const pre = test('pre');
    const post = test('post');
    const profile = learners.find((row) => row._id === id)?.profile ?? {};
    const skills = Object.values(profile.skills ?? {});
    const states = Object.values(profile.misconceptions ?? {});
    const myDecisions = mine(decisions);
    const llm = myDecisions.filter((row) => row.mode === 'llm').length;
    const fallbacks = myDecisions.filter(
      (row) => row.fallback_reason && row.fallback_reason !== 'generator',
    ).length;
    const ms =
      mine(attempts).reduce((sum, row) => sum + row.time_ms, 0) +
      mine(views).reduce((sum, row) => sum + row.duration_ms, 0);
    const row = {
      alias: aliasOf.get(id),
      condition,
      form_pre,
      form_post,
      pre_score: pre?.score,
      pre_total: pre?.total,
      pre_pct: pre ? (100 * pre.score) / pre.total : null,
      post_score: post?.score,
      post_total: post?.total,
      post_pct: post ? (100 * post.score) / post.total : null,
      units_enabled: profile.student?.units?.length,
      minutes_in_app: Math.round(ms / 6000) / 10,
      items_done: mine(attempts).length,
      skills_reached: skills.filter((state) => state.attempts?.length > 0).length,
      skills_mastered: skills.filter((state) => state.passed).length,
      scenes_viewed: mine(views).length,
      hints_used: mine(hints).length,
      reveals: mine(views).filter((row) => row.purpose === 'reveal').length,
      misconceptions_resolved: states.filter((state) => state.status === 'resolved').length,
      median_items_to_resolve: median(states.flatMap((state) => state.itemsToResolve ?? [])),
      llm_decisions: llm,
      fallback_rate: myDecisions.length > 0 ? fallbacks / myDecisions.length : null,
    };
    for (const [phase, sat] of [
      ['pre', pre],
      ['post', post],
    ]) {
      const caught = new Set(
        responses
          .filter((response) => response.assessment_id === sat?.id && response.misconception)
          .map((response) => response.misconception),
      );
      for (const m of MISCONCEPTIONS) {
        row[`${phase}_${m.slice(0, 3)}`] = !sat || !ON_TEST.has(m) ? null : caught.has(m) ? 1 : 0;
      }
    }
    return row;
  });
  if (wide.length > 0) files.set('research_wide.csv', csv(wide, Object.keys(wide[0])));
  return { files, students: wide.length };
}
