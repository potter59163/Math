// Research export (RESEARCH §5). Run by whoever holds the database address: npm run export -- <cohort>
// Writes exports/<table>.csv and exports/research_wide.csv. No name or Google account leaves the
// database: each student becomes S-1, S-2 and so on, in the order they joined.
import { mkdirSync, writeFileSync } from 'node:fs';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Set MONGODB_URI in .env.local');

const cohort = process.argv[2];
const client = new MongoClient(uri);
const db = client.db(process.env.MONGODB_DB || 'kidma');

const all = (collection) => db.collection(collection).find().toArray();

function csv(rows, columns) {
  const cell = (value) => {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return `${[columns.join(','), ...rows.map((row) => columns.map((name) => cell(row[name])).join(','))].join('\n')}\n`;
}

const profiles = (await all('profiles'))
  .filter((row) => row.consent_at && (!cohort || row.cohort === cohort))
  .sort((a, b) => a.created_at - b.created_at);
const aliasOf = new Map(profiles.map(({ _id }, index) => [_id, `S-${index + 1}`]));

mkdirSync('exports', { recursive: true });

async function exportTable(table, columns) {
  const rows = (await all(table))
    .filter((row) => aliasOf.has(row.user_id))
    .map((row) => ({ ...row, id: String(row._id), alias: aliasOf.get(row.user_id) }));
  writeFileSync(`exports/${table}.csv`, csv(rows, ['alias', ...columns]));
  return rows;
}

const attempts = await exportTable('attempts', [
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
]);
const decisions = await exportTable('decisions', [
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
]);
const views = await exportTable('scene_views', [
  'template',
  'purpose',
  'beats_total',
  'beats_seen',
  'replays',
  'skipped',
  'duration_ms',
  'created_at',
]);
const hints = await exportTable('hint_events', ['item_ref', 'level', 'created_at']);
const assessments = await exportTable('assessments', [
  'id',
  'phase',
  'form',
  'score',
  'total',
  'started_at',
  'submitted_at',
]);
const responses = (await all('assessment_responses')).filter((row) =>
  assessments.some(({ id }) => id === row.assessment_id),
);
writeFileSync(
  'exports/assessment_responses.csv',
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
const learners = (await all('learner_profiles')).filter((row) => aliasOf.has(row._id));
writeFileSync(
  'exports/learner_profiles.csv',
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

// One row per student (RESEARCH §5). A form with no item for a misconception leaves its cell blank.
const MISCONCEPTIONS = [
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

const median = (values) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

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
if (wide.length > 0) writeFileSync('exports/research_wide.csv', csv(wide, Object.keys(wide[0])));
await client.close();
console.log(`Exported ${wide.length} students${cohort ? ` from ${cohort}` : ''} to exports/`);
