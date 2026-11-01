import type { Answer } from '@/lib/core/types';
import { currentItem } from '@/lib/director/items';
import { beginSession, requestHelp } from '@/lib/director/rules';
import { newProfile } from '@/lib/director/turn';
import type { Condition, NextTurn, Profile } from '@/lib/director/types';
import { applyPretest } from '@/lib/learner/profile';
import type { AttemptOutcome, PretestResult, SkillState, UnitId } from '@/lib/learner/types';
import { misconceptionAnswer, slipAnswer, unknownAnswer } from '@/lib/sim/answers';
import { answerItem, openItem } from '@/lib/sim/drive';
import type { SkillId } from '@/lib/topics/matrix/skills';
import type { MatrixItem, MisconceptionId } from '@/lib/topics/matrix/types';

/** How to answer one item. A bug the item cannot show is answered right, and the table says so. */
export type Mark = 'right' | 'slip' | 'unknown' | { bug: MisconceptionId };

export interface Scenario {
  key: string;
  title: string;
  units: UnitId[];
  condition?: Condition;
  /** Passed long ago, clip seen. */
  passed?: SkillId[];
  /** Items done before the script, which is what makes a review due. */
  itemsDone?: number;
  pretest?: Partial<Record<SkillId, PretestResult>>;
  script: Mark[];
  /** Ends on "ไม่เข้าใจ" instead of an answer. */
  pressHelp?: boolean;
}

const right = (count: number): Mark[] => Array.from({ length: count }, () => 'right');

const M09: Mark = { bug: 'M09_MULT_ELEMENTWISE' };

export const SCENARIOS: Scenario[] = [
  {
    key: 'start',
    title: 'session_start: first visit, all units',
    units: [1, 2, 3, 4, 5],
    script: [],
  },
  { key: 'start-3', title: 'session_start: Unit 3 only', units: [3], script: [] },
  {
    key: 'start-pre-right',
    title: 'session_start: right on the pre-test (L2, no clip)',
    units: [3],
    pretest: { mult_defined: { outcome: 'correct' } },
    script: [],
  },
  {
    key: 'start-pre-bug',
    title: 'session_start: misconception on the pre-test (probe first)',
    units: [3],
    pretest: {
      mult_defined: { outcome: 'misconception', caught: [{ id: 'M08_MULT_DIM_RULE' }] },
    },
    script: [],
  },
  {
    key: 'r1-first',
    title: 'R1: first catch of M09',
    units: [3],
    passed: ['mult_defined'],
    script: [M09],
  },
  {
    key: 'r1-again',
    title: 'R1: caught a second time',
    units: [3],
    passed: ['mult_defined'],
    script: [M09, M09],
  },
  {
    key: 'r1-worked',
    title: 'R1: M05, whose scene is the worked solution',
    units: [2],
    script: [...right(2), { bug: 'M05_SUB_REVERSED' }, { bug: 'M05_SUB_REVERSED' }],
  },
  {
    key: 'r1-seen',
    title: 'R1: scene seen twice, so test first (.92), after R7 has gone',
    units: [3],
    passed: ['mult_defined'],
    script: [M09, M09, M09, M09],
  },
  {
    key: 'r2',
    title: 'R2: slip',
    units: [3],
    passed: ['mult_defined'],
    script: ['slip'],
  },
  {
    key: 'r3',
    title: 'R3: wrong for no known reason',
    units: [3],
    passed: ['mult_defined'],
    script: ['unknown'],
  },
  {
    key: 'r4',
    title: 'R4: pass, go to the next skill with its clip',
    units: [3],
    passed: ['mult_defined'],
    script: right(3),
  },
  { key: 'r4-det2', title: 'R4: det2 has no L3, so one path', units: [4], script: right(3) },
  {
    key: 'r4-done',
    title: 'R4: every skill passed, still items to do',
    units: [3],
    passed: ['mult_defined', 'mult'],
    script: right(8),
  },
  {
    key: 'r5',
    title: 'R5: right, not passed yet: one path',
    units: [3],
    passed: ['mult_defined'],
    script: right(1),
  },
  {
    key: 'r5-probe',
    title: 'R5: right, misconception still open',
    units: [3],
    passed: ['mult_defined'],
    script: [M09, 'right'],
  },
  {
    key: 'r5-fixed',
    title: 'R5: fixed by the second probe (+20 XP)',
    units: [3],
    passed: ['mult_defined'],
    script: [M09, 'right', 'right'],
  },
  {
    key: 'r6',
    title: 'R6: a review is due',
    units: [3],
    passed: ['mult_defined'],
    itemsDone: 20,
    script: right(1),
  },
  {
    key: 'r6-back',
    title: 'R6: right on the review, back to the skill in progress',
    units: [3],
    passed: ['mult_defined'],
    itemsDone: 20,
    script: right(2),
  },
  {
    key: 'r7',
    title: 'R7: third wrong answer in a row',
    units: [3],
    passed: ['mult_defined'],
    script: ['unknown', 'unknown', 'unknown'],
  },
  {
    key: 'r7-m',
    title: 'R7: over R1, on the third catch',
    units: [3],
    passed: ['mult_defined'],
    script: [M09, M09, M09],
  },
  {
    key: 'help',
    title: 'student_request: "ไม่เข้าใจ"',
    units: [3],
    passed: ['mult_defined'],
    script: [],
    pressHelp: true,
  },
  { key: 'fixed', title: 'Fixed path: first item', units: [3], condition: 'fixed', script: [] },
  {
    key: 'fixed-wrong',
    title: 'Fixed path: wrong answer',
    units: [3],
    condition: 'fixed',
    script: ['unknown'],
  },
];

export interface LabStep {
  item: MatrixItem;
  answer: Answer;
  outcome: AttemptOutcome;
  turn: NextTurn;
}

export interface LabRun {
  profile: Profile;
  steps: LabStep[];
  /** The decision on show: the latest one. */
  turn: NextTurn | null;
}

export function answerFor(item: MatrixItem, mark: Mark): Answer {
  if (mark === 'right') return item.correct;
  if (mark === 'slip') return slipAnswer(item);
  if (mark === 'unknown') return unknownAnswer(item);
  return misconceptionAnswer(item, mark.bug) ?? item.correct;
}

function passedLongAgo(): SkillState {
  return {
    pKnown: 0.99,
    level: 2,
    attempts: [],
    passed: true,
    wrongStreak: 0,
    stuck: false,
    lastSeen: 0,
  };
}

function startOf({ units, passed = [], itemsDone = 0, pretest }: Scenario): Profile {
  const fresh = newProfile({ id: 'DEV-1', classCode: 'DEVDEV', seatNo: 1, units });
  const skills = Object.fromEntries(passed.map((id) => [id, passedLongAgo()]));
  const seeded: Profile = { ...fresh, skills, clipsSeen: passed, itemsDone };
  return pretest ? applyPretest(seeded, pretest, { at: 0 }) : seeded;
}

/** The same functions the session screen calls, so this shows what a student would get. */
export function runScenario(scenario: Scenario, extra: Mark[]): LabRun {
  const { condition = 'adaptive', pressHelp = false } = scenario;
  let { profile, turn } = beginSession(startOf(scenario), condition);
  const steps: LabStep[] = [];

  for (const mark of [...scenario.script, ...extra]) {
    const opened = openItem(profile, condition);
    const answer = answerFor(opened.item, mark);
    const result = answerItem(opened.profile, opened.item, answer, {
      condition,
      at: steps.length * 60_000,
    });
    steps.push({ item: opened.item, answer, outcome: result.outcome, turn: result.turn });
    ({ profile, turn } = result);
  }

  if (pressHelp) {
    const opened = openItem(profile, condition);
    const helped = requestHelp(opened.profile, opened.item, 0);
    if (helped) ({ profile, turn } = helped);
  }
  return { profile, steps, turn };
}

/** The item a next answer would go to. */
export function nextItemOf(profile: Profile): MatrixItem | null {
  return currentItem(profile);
}
