// Made-up rows in the shapes lib/server/store.ts writes, for the research export's tests: a class of
// matrix students as the trial left them, and the same class once vectors are switched on.

export type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;

const at = (time: string): Date => new Date(`2026-11-13T${time}+07:00`);

export function matrixRef(skill: string, difficulty: number, seed: number, target?: string) {
  return { topic: 'matrix', skill, difficulty, seed, ...(target && { target }), gv: 2 };
}

export function vectorRef(skill: string, difficulty: number, seed: number, target?: string) {
  return { topic: 'vector', skill, difficulty, seed, ...(target && { target }), gv: 1 };
}

interface AttemptRef {
  skill: string;
  difficulty: number;
  target?: string;
}

/** A first answer as `attemptRow` stores it: right unless `fields` says otherwise. */
function attempt(user: string, seq: number, ref: AttemptRef, time: string, fields: Row): Row {
  return {
    _id: `attempt-${user}-${seq}`,
    user_id: user,
    device_id: 'device-1',
    seq,
    item_ref: ref,
    skill: ref.skill,
    difficulty: ref.difficulty,
    kind: 'matrix',
    target: ref.target ?? null,
    answer: null,
    classification: 'correct',
    misconception: null,
    variant: null,
    wrong_cells: null,
    time_ms: 10_000,
    hint_level: 0,
    xp: 10,
    created_at: at(time),
    ...fields,
  };
}

function candidate(id: string, skill: string, level: number, fields: Row = {}): Row {
  return {
    id,
    rule: 'R5',
    score: 0.8,
    next: { skill, level, purpose: 'practice' },
    ruleReason: 'ฝึกต่อในระดับเดิม',
    stepKind: 'same_level',
    ...fields,
  };
}

/** A decision as `decisionRow` stores it. */
function decision(user: string, n: number, time: string, fields: Row): Row {
  return {
    _id: `decision-${user}-${n}`,
    user_id: user,
    attempt_id: null,
    trigger: 'after_attempt',
    mode: 'rules',
    candidates: [],
    choice: 'c1',
    message: null,
    path_note: 'ฝึกอีกข้อให้แม่นขึ้น',
    narration: null,
    reason: 'R5',
    latency_ms: null,
    fallback_reason: 'disabled',
    created_at: at(time),
    ...fields,
  };
}

function sceneView(user: string, n: number, time: string, fields: Row): Row {
  return {
    _id: `scene-${user}-${n}`,
    user_id: user,
    template: 'worked_solution',
    purpose: 'reveal',
    beats_total: 3,
    beats_seen: 3,
    replays: 0,
    skipped: false,
    duration_ms: 12_000,
    created_at: at(time),
    ...fields,
  };
}

function hint(user: string, n: number, time: string, itemRef: Row | null, level: number): Row {
  return {
    _id: `hint-${user}-${n}`,
    user_id: user,
    item_ref: itemRef,
    level,
    created_at: at(time),
  };
}

function skill(lastSeen: number, passed: boolean, times: number[], fields: Row = {}): Row {
  return {
    pKnown: passed ? 0.96 : 0.42,
    level: 1,
    attempts: times.map((timeMs, index) => ({
      level: 1,
      countsCorrect: passed || index > 0,
      clean: passed,
      timeMs,
    })),
    passed,
    wrongStreak: passed ? 0 : 1,
    stuck: false,
    lastSeen,
    ...fields,
  };
}

function misconception(status: string, openedAtItem: number, fields: Row = {}): Row {
  return {
    status,
    count: 1,
    fixStreak: status === 'resolved' ? 2 : 0,
    scenesSeen: status === 'suspected' ? 0 : 1,
    openedAtItem,
    openedAtMs: at('09:20:00').getTime(),
    lastCaughtAtItem: openedAtItem,
    rewarded: status === 'resolved',
    ...fields,
  };
}

function response(assessment: string, itemNo: number, skillId: string, fields: Row): Row {
  return {
    _id: `response-${assessment}-${itemNo}`,
    assessment_id: assessment,
    item_no: itemNo,
    item_ref: matrixRef(skillId, 1, 900 + itemNo),
    answer: { kind: 'scalar', value: '0' },
    correct: false,
    misconception: null,
    variant: null,
    time_ms: 30_000,
    ...fields,
  };
}

function assessment(id: string, user: string, phase: string, form: string, score: number): Row {
  return {
    _id: id,
    user_id: user,
    phase,
    form,
    score,
    total: 14,
    started_at: at(phase === 'pre' ? '09:06:00' : '10:30:00'),
    submitted_at: at(phase === 'pre' ? '09:24:00' : '10:49:00'),
  };
}

/**
 * Four accounts, not in the order they joined: A and B are in m5-1, C never gave consent and D is in
 * another room. Each kind of row has one for a stranger too, which no export may keep.
 */
export function matrixClass(): Tables {
  const multRef = matrixRef('mult', 2, 7, 'M09_MULT_ELEMENTWISE');
  return {
    profiles: [
      {
        _id: 'acct-b',
        display_name: 'ต้นกล้า',
        avatar: 'cat',
        show_on_leaderboard: true,
        condition: 'fixed',
        consent_at: at('09:05:00'),
        cohort: 'm5-1',
        form_pre: 'B',
        created_at: at('09:05:00'),
        updated_at: at('09:30:00'),
      },
      {
        _id: 'acct-a',
        display_name: 'มายด์',
        avatar: 'owl',
        show_on_leaderboard: false,
        condition: 'adaptive',
        consent_at: at('09:01:00'),
        cohort: 'm5-1',
        form_pre: 'A',
        form_post: 'B',
        created_at: at('09:01:00'),
        updated_at: at('10:50:00'),
      },
      {
        _id: 'acct-c',
        display_name: 'ยังไม่ยินยอม',
        avatar: 'fox',
        show_on_leaderboard: false,
        condition: 'adaptive',
        cohort: 'm5-1',
        created_at: at('09:02:00'),
        updated_at: at('09:02:00'),
      },
      {
        _id: 'acct-d',
        display_name: 'ห้องอื่น',
        avatar: 'dog',
        show_on_leaderboard: true,
        condition: 'adaptive',
        consent_at: at('09:03:00'),
        cohort: 'm5-2',
        form_pre: 'A',
        created_at: at('09:03:00'),
        updated_at: at('09:45:00'),
      },
    ],
    attempts: [
      attempt('acct-a', 1, matrixRef('dim', 1, 101), '09:31:00', {
        kind: 'dims',
        answer: { kind: 'dims', rows: 2, cols: 3 },
        time_ms: 8_200,
      }),
      attempt('acct-a', 2, multRef, '09:33:00', {
        answer: {
          kind: 'matrix',
          value: [
            ['2', '0'],
            ['-3/2', '4'],
          ],
        },
        classification: 'misconception',
        misconception: 'M09_MULT_ELEMENTWISE',
        time_ms: 41_000,
        hint_level: 1,
        xp: 0,
      }),
      attempt('acct-a', 4, matrixRef('addsub', 1, 55), '09:37:00', {
        answer: {
          kind: 'matrix',
          value: [
            ['1', '2'],
            ['3', '5'],
          ],
        },
        classification: 'slip',
        wrong_cells: [[2, 2]],
        time_ms: 15_000,
        xp: 2,
      }),
      // A row from before topics would name none, and it is a matrix row.
      attempt(
        'acct-a',
        5,
        { skill: 'det2', difficulty: 1, seed: 9, gv: 2 } as AttemptRef,
        '09:40:00',
        {
          kind: 'scalar',
          answer: { kind: 'scalar', value: '-7' },
          classification: 'misconception',
          misconception: 'M12_DET2_FORMULA',
          variant: 'sum',
          time_ms: 12_500,
          xp: 0,
        },
      ),
      attempt('acct-b', 1, matrixRef('det2', 1, 31), '09:35:00', {
        kind: 'scalar',
        answer: { kind: 'scalar', value: '11' },
        classification: 'unknown',
        time_ms: 52_000,
        hint_level: 2,
        xp: 0,
      }),
      attempt('acct-c', 1, matrixRef('dim', 1, 3), '09:32:00', {
        kind: 'dims',
        answer: { kind: 'dims', rows: 3, cols: 2 },
      }),
      attempt('acct-d', 1, matrixRef('transpose', 2, 44), '09:36:00', {
        answer: { kind: 'matrix', value: [['1', '4']] },
        classification: 'shape_error',
        xp: 0,
      }),
      attempt('stranger', 1, matrixRef('dim', 1, 5), '09:34:00', {}),
    ],
    decisions: [
      decision('acct-a', 1, '09:30:00', {
        trigger: 'session_start',
        candidates: [
          candidate('c1', 'dim', 1, {
            rule: 'start',
            score: 1,
            scene: { template: 'dimension_match', beats: ['grid', 'count', 'name'] },
            ruleReason: 'เริ่มบทแรก',
            stepKind: 'concept',
          }),
        ],
        reason: 'start',
      }),
      decision('acct-a', 2, '09:33:00', {
        attempt_id: 'attempt-acct-a-2',
        mode: 'llm',
        candidates: [
          candidate('c1', 'mult', 2, {
            rule: 'R1',
            score: 0.9,
            scene: { template: 'cell_by_cell', beats: ['setup', 'cell', 'compare'] },
            next: { skill: 'mult', level: 2, purpose: 'probe', target: 'M09_MULT_ELEMENTWISE' },
            ruleReason: 'เจอ "คูณทีละช่อง" ครั้งแรก, มีคลิปแก้',
            stepKind: 'remediate',
            misconception: 'M09_MULT_ELEMENTWISE',
          }),
          candidate('c2', 'mult', 1),
        ],
        message: 'ดูคลิปนี้ก่อนนะ แล้ว "ลองใหม่" อีกที',
        path_note: 'พาดูคลิปนี้เพราะเมื่อกี้คูณทีละช่อง',
        narration: { compare: 'ดูแถวนี้, แล้วคูณกับหลักนี้' },
        reason: 'R1, scene first',
        latency_ms: 1_830,
        fallback_reason: null,
      }),
      decision('acct-a', 3, '09:37:00', {
        attempt_id: 'attempt-acct-a-4',
        candidates: [candidate('c1', 'addsub', 1), candidate('c2', 'scalar', 1)],
        latency_ms: 4_000,
        fallback_reason: 'timeout',
      }),
      decision('acct-a', 4, '09:40:00', {
        attempt_id: 'attempt-acct-a-5',
        candidates: [candidate('c1', 'det2', 1)],
        fallback_reason: 'generator',
      }),
      decision('acct-b', 1, '09:31:00', {
        trigger: 'session_start',
        mode: 'fixed',
        candidates: [candidate('c1', 'dim', 1, { rule: 'fixed', score: 1, stepKind: 'concept' })],
        reason: 'fixed',
        fallback_reason: null,
      }),
      decision('acct-c', 1, '09:32:00', { candidates: [candidate('c1', 'dim', 1)] }),
      decision('stranger', 1, '09:34:00', { candidates: [candidate('c1', 'dim', 1)] }),
    ],
    scene_views: [
      sceneView('acct-a', 1, '09:31:00', {
        template: 'dimension_match',
        purpose: 'intro',
        beats_total: 5,
        beats_seen: 5,
        duration_ms: 21_000,
      }),
      sceneView('acct-a', 2, '09:34:00', {
        template: 'cell_by_cell',
        purpose: 'remediate',
        beats_total: 6,
        beats_seen: 4,
        replays: 1,
        duration_ms: 30_500,
      }),
      sceneView('acct-a', 3, '09:38:00', {}),
      sceneView('acct-b', 1, '09:32:00', {
        template: 'dimension_match',
        purpose: 'intro',
        beats_total: 5,
        beats_seen: 0,
        skipped: true,
        duration_ms: 1_500,
      }),
      sceneView('stranger', 1, '09:35:00', {}),
    ],
    hint_events: [
      hint('acct-a', 1, '09:32:30', multRef, 1),
      hint('acct-a', 2, '09:32:50', multRef, 2),
      // `before.current?.ref ?? null` in lib/server/sync.ts: a hint row may have no item.
      hint('acct-a', 3, '09:39:00', null, 1),
      hint('acct-d', 1, '09:36:30', matrixRef('transpose', 2, 44), 1),
      hint('stranger', 1, '09:34:30', matrixRef('dim', 1, 5), 1),
    ],
    assessments: [
      assessment('asm-a-pre', 'acct-a', 'pre', 'A', 6),
      assessment('asm-a-post', 'acct-a', 'post', 'B', 11),
      assessment('asm-b-pre', 'acct-b', 'pre', 'B', 4),
      assessment('asm-c-pre', 'acct-c', 'pre', 'A', 9),
      assessment('asm-d-pre', 'acct-d', 'pre', 'A', 7),
    ],
    assessment_responses: [
      response('asm-a-pre', 1, 'dim', { misconception: 'M01_DIM_SWAP' }),
      response('asm-a-pre', 2, 'mult', { misconception: 'M09_MULT_ELEMENTWISE', variant: 'cells' }),
      response('asm-a-pre', 3, 'addsub', { misconception: 'M04_ADD_DIM_MISMATCH' }),
      response('asm-a-pre', 4, 'det2', { correct: true, time_ms: null }),
      response('asm-a-post', 1, 'dim', { misconception: 'M01_DIM_SWAP' }),
      response('asm-a-post', 2, 'mult', { correct: true }),
      response('asm-b-pre', 1, 'det2', { misconception: 'M12_DET2_FORMULA', variant: 'sum' }),
      response('asm-c-pre', 1, 'addsub', { misconception: 'M05_SUB_REVERSED' }),
      response('asm-d-pre', 1, 'transpose', { misconception: 'M03_TRANSPOSE_WRONG' }),
      response('asm-gone', 1, 'dim', { misconception: 'M01_DIM_SWAP' }),
    ],
    learner_profiles: [
      {
        _id: 'acct-a',
        profile: {
          student: { id: 'acct-a', units: [1, 2, 3], theme: 'game' },
          counter: 9,
          xp: 140,
          combo: 0,
          bestCombo: 3,
          itemsDone: 4,
          skills: {
            dim: skill(1, true, [8_200]),
            mult: skill(2, false, [41_000], { level: 2 }),
            addsub: skill(3, false, [15_000]),
            det2: skill(0, false, [], { pretestCorrect: false }),
          },
          misconceptions: {
            M09_MULT_ELEMENTWISE: misconception('resolved', 2, {
              count: 2,
              itemsToResolve: 3,
              msToResolve: 240_000,
            }),
            M01_DIM_SWAP: misconception('active', 0, { lastCaughtAtItem: 4, fromPretest: true }),
            M12_DET2_FORMULA: misconception('resolved', 0, {
              itemsToResolve: 6,
              msToResolve: 300_000,
              relapses: 1,
              fromPretest: true,
            }),
          },
          clipsSeen: ['dim', 'mult'],
          lastReviewAt: 0,
          path: [
            {
              kind: 'remediate',
              skill: 'mult',
              level: 2,
              note: 'พาดูคลิปนี้เพราะเมื่อกี้คูณทีละช่อง',
            },
          ],
          current: { ref: matrixRef('mult', 2, 12, 'M09_MULT_ELEMENTWISE'), hintLevel: 0 },
          activity: [{ day: '2026-11-13', items: 4, xp: 140 }],
        },
        rev: 12,
        devices: { 'device-1': 9 },
        updated_at: at('09:41:00'),
      },
      {
        _id: 'acct-b',
        profile: {
          student: { id: 'acct-b', units: [1, 2, 3, 4, 5] },
          counter: 2,
          xp: 0,
          combo: 0,
          bestCombo: 0,
          itemsDone: 1,
          skills: { det2: skill(1, false, [52_000]) },
          misconceptions: {
            M12_DET2_FORMULA: misconception('suspected', 0, { fromPretest: true }),
          },
          clipsSeen: ['dim'],
          lastReviewAt: 0,
          path: [],
        },
        rev: 3,
        devices: { 'device-1': 2 },
        updated_at: at('09:36:00'),
      },
      {
        _id: 'acct-c',
        profile: {
          student: { id: 'acct-c', units: [1, 2, 3, 4, 5] },
          counter: 1,
          xp: 10,
          combo: 1,
          bestCombo: 1,
          itemsDone: 1,
          skills: { dim: skill(1, false, [10_000]) },
          misconceptions: {},
          clipsSeen: [],
          lastReviewAt: 0,
          path: [],
        },
        rev: 1,
        devices: {},
        updated_at: at('09:32:00'),
      },
      {
        _id: 'acct-d',
        profile: {
          student: { id: 'acct-d', units: [1], theme: 'music' },
          counter: 1,
          xp: 0,
          combo: 0,
          bestCombo: 0,
          itemsDone: 1,
          skills: { transpose: skill(1, false, [10_000]) },
          misconceptions: {
            M03_TRANSPOSE_WRONG: misconception('active', 0, { fromPretest: true }),
          },
          clipsSeen: [],
          lastReviewAt: 0,
          path: [],
        },
        rev: 2,
        devices: {},
        updated_at: at('09:36:00'),
      },
    ],
  };
}

/** `rows` with `extra[i]` put in before row i, so the rows that were there keep their order. */
function among(rows: Row[], extra: Record<number, Row[]>): Row[] {
  return [
    ...rows.flatMap((row, index) => [...(extra[index] ?? []), row]),
    ...(extra[rows.length] ?? []),
  ];
}

/** A map keyed by id with `extra` taking turns with what is there, as two topics practised in turn leave it. */
function alternate(map: unknown, extra: Row): Row {
  const mine = Object.entries(map as Row);
  const theirs = Object.entries(extra);
  return Object.fromEntries(
    Array.from({ length: Math.max(mine.length, theirs.length) }, (_, index) =>
      [theirs[index], mine[index]].filter((entry) => entry !== undefined),
    ).flat(),
  );
}

/**
 * The same class once vectors are on: every matrix row as it was, with vector work among them. Only what
 * a row says is a vector's is added, so the running totals (xp, itemsDone) stay as they were.
 */
export function withVectors(): Tables {
  const tables = matrixClass();
  const magnitude = vectorRef('v_magnitude', 1, 5, 'V09_MAG_NO_ROOT');
  const vectorMaps: Record<string, { skills: Row; misconceptions: Row }> = {
    'acct-a': {
      skills: {
        v_points: skill(5, true, [9_000]),
        v_magnitude: skill(6, false, [30_000]),
      },
      misconceptions: {
        V09_MAG_NO_ROOT: misconception('resolved', 5, { itemsToResolve: 1, msToResolve: 60_000 }),
        V05_POINTS_REVERSED: misconception('suspected', 0, { fromPretest: false }),
      },
    },
    'acct-b': {
      skills: { v_quantity: skill(2, true, [7_000]) },
      misconceptions: {
        V01_QUANTITY_MIX: misconception('resolved', 1, { itemsToResolve: 2, msToResolve: 90_000 }),
      },
    },
  };
  return {
    ...tables,
    attempts: among(tables.attempts, {
      1: [
        attempt('acct-a', 10, vectorRef('v_points', 1, 3), '10:01:00', {
          kind: 'vector',
          answer: { kind: 'vector', value: ['3', '-1'] },
          time_ms: 9_000,
        }),
      ],
      3: [
        attempt('acct-a', 11, magnitude, '10:03:00', {
          kind: 'surd',
          answer: { kind: 'surd', value: '25' },
          classification: 'misconception',
          misconception: 'V09_MAG_NO_ROOT',
          time_ms: 30_000,
          xp: 0,
        }),
      ],
      5: [
        attempt('acct-b', 5, vectorRef('v_quantity', 1, 8), '10:02:00', {
          kind: 'choice',
          answer: { kind: 'choice', id: 'vector' },
          time_ms: 7_000,
        }),
      ],
    }),
    decisions: among(tables.decisions, {
      2: [
        decision('acct-a', 10, '10:00:00', {
          trigger: 'session_start',
          candidates: [
            candidate('c1', 'v_quantity', 1, {
              rule: 'start',
              score: 1,
              scene: { template: 'quantity_sort', beats: ['compare', 'cards', 'ask'] },
              stepKind: 'concept',
            }),
          ],
          reason: 'start',
        }),
        decision('acct-a', 11, '10:01:00', {
          attempt_id: 'attempt-acct-a-10',
          candidates: [candidate('c1', 'v_points', 1), candidate('c2', 'v_magnitude', 1)],
          latency_ms: 4_000,
          fallback_reason: 'timeout',
        }),
        decision('acct-a', 12, '10:03:00', {
          attempt_id: 'attempt-acct-a-11',
          mode: 'llm',
          candidates: [
            candidate('c1', 'v_magnitude', 1, {
              rule: 'R1',
              scene: { template: 'magnitude_box', beats: ['box', 'square', 'root'] },
              next: { skill: 'v_magnitude', level: 1, purpose: 'probe', target: 'V09_MAG_NO_ROOT' },
              stepKind: 'remediate',
              misconception: 'V09_MAG_NO_ROOT',
            }),
            candidate('c2', 'v_points', 1),
          ],
          // The tutor's pick, not the rules' first.
          choice: 'c2',
          latency_ms: 2_100,
          fallback_reason: null,
        }),
      ],
      5: [
        decision('acct-b', 10, '10:02:00', {
          trigger: 'student_request',
          mode: 'fixed',
          candidates: [candidate('c1', 'v_quantity', 1, { rule: 'request' })],
          fallback_reason: null,
        }),
      ],
    }),
    scene_views: among(tables.scene_views, {
      2: [
        sceneView('acct-a', 10, '10:00:30', {
          template: 'quantity_sort',
          purpose: 'intro',
          beats_total: 6,
          beats_seen: 6,
          duration_ms: 25_000,
        }),
        sceneView('acct-a', 11, '10:03:30', {
          template: 'magnitude_box',
          purpose: 'remediate',
          beats_total: 7,
          beats_seen: 5,
          replays: 1,
          duration_ms: 28_000,
        }),
      ],
      4: [
        sceneView('acct-b', 10, '10:00:40', {
          template: 'quantity_sort',
          purpose: 'intro',
          beats_total: 6,
          beats_seen: 0,
          skipped: true,
          duration_ms: 2_000,
        }),
      ],
    }),
    hint_events: among(tables.hint_events, {
      2: [hint('acct-a', 10, '10:02:40', magnitude, 1)],
      5: [hint('acct-b', 10, '10:01:30', vectorRef('v_quantity', 1, 8), 2)],
    }),
    learner_profiles: tables.learner_profiles.map((row) => {
      const extra = vectorMaps[row._id as string];
      if (!extra) return row;
      const profile = row.profile as Row;
      return {
        ...row,
        profile: {
          ...profile,
          skills: alternate(profile.skills, extra.skills),
          misconceptions: alternate(profile.misconceptions, extra.misconceptions),
        },
      };
    }),
  };
}
