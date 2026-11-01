import { createRng } from '@/lib/core/prng';
import type { Condition } from '@/lib/director/types';
import { nextSkill } from '@/lib/learner/progress';
import type { PretestResult, UnitId } from '@/lib/learner/types';
import { CATALOG } from '@/lib/topics/matrix/misconceptions';
import { SKILLS, type SkillId } from '@/lib/topics/matrix/skills';
import type { MisconceptionId } from '@/lib/topics/matrix/types';
import { runStudent, type SimRun } from './run';
import { buggy, perfect, planned, randomStudent, slipper, type SimStudent } from './students';

// The report of `npm run sim` (PLAN Phase 4). A check on the system: a plan table to compare with, and
// no number here may go in the proposal.

/** The unit choices and planning estimates of RESEARCH §3.1. */
const PLANS: { units: UnitId[]; minutes: number; passAll: Record<Rate, number> }[] = [
  { units: [1, 2, 3, 4, 5], minutes: 55, passAll: { 90: 95, 80: 30, 70: 1 } },
  { units: [2, 3, 4, 5], minutes: 64, passAll: { 90: 100, 80: 86, 70: 22 } },
  { units: [3, 4, 5], minutes: 69, passAll: { 90: 100, 80: 98, 70: 59 } },
  { units: [3, 4], minutes: 75, passAll: { 90: 100, 80: 100, 70: 96 } },
];

type Rate = 90 | 80 | 70;

/** The pre-test each group is assumed to have in RESEARCH §3.1. */
const PRETEST_RIGHT: Record<Rate, number> = { 90: 0.6, 80: 0.4, 70: 0.2 };

const CONDITIONS: Condition[] = ['adaptive', 'fixed'];

const BUG_FIX_PROB = 0.5;

const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;

const percent = (part: number, whole: number): string =>
  whole === 0 ? '–' : `${((100 * part) / whole).toFixed(0)}%`;

const unitLabel = (units: UnitId[]): string =>
  units.length === 1 ? String(units[0]) : `${units[0]}–${units[units.length - 1]}`;

const skillsIn = (units: UnitId[]): SkillId[] =>
  SKILLS.filter(({ unit }) => units.includes(unit)).map(({ id }) => id);

function bugsIn(units: UnitId[]): MisconceptionId[] {
  const open = skillsIn(units);
  return CATALOG.filter(({ skills }) => skills.some((skill) => open.includes(skill))).map(
    ({ id }) => id,
  );
}

interface Cohort {
  name: string;
  make(index: number, units: UnitId[]): SimStudent;
}

const COHORTS: Cohort[] = [
  { name: 'perfect', make: () => perfect() },
  { name: 'slipper(0.1)', make: (index) => slipper(0.1, index + 1000) },
  { name: 'slipper(0.3)', make: (index) => slipper(0.3, index + 2000) },
  {
    name: `buggy(${BUG_FIX_PROB})`,
    make: (index, units) => {
      const bugs = bugsIn(units);
      return buggy(bugs[index % bugs.length], BUG_FIX_PROB, index + 3000);
    },
  },
  { name: 'random', make: (index) => randomStudent(index + 4000) },
];

interface CohortStats {
  rightFirstTry: string;
  skillsPassed: string;
  allPassed: string;
  itemsToMaster: string;
  caught: number;
  resolved: string;
  itemsToResolve: string;
  fixScenes: string;
  reviews: string;
  stuck: string;
  skippedPrereqs: number;
  illegal: number;
}

/** Items in a skill up to the one that passed it, for each pass. */
function itemsToMaster(run: SimRun): number[] {
  const done = new Map<SkillId, number>();
  const passes: number[] = [];
  for (const { ref, outcome } of run.steps) {
    done.set(ref.skill, (done.get(ref.skill) ?? 0) + 1);
    if (outcome.skillPassed) passes.push(done.get(outcome.skillPassed) ?? 0);
  }
  return passes;
}

function summarize(runs: SimRun[], skills: SkillId[]): CohortStats {
  const items = runs.flatMap(({ steps }) => steps);
  const right = items.filter(({ outcome }) => outcome.classification.type === 'correct');
  const states = runs.flatMap(({ profile }) => Object.values(profile.misconceptions));
  const fixes = states.filter(({ status }) => status === 'resolved');
  const per = (count: (run: SimRun) => number) => mean(runs.map(count)).toFixed(1);
  return {
    rightFirstTry: percent(right.length, items.length),
    skillsPassed: `${per(({ profile }) => skills.filter((id) => profile.skills[id]?.passed).length)}/${skills.length}`,
    allPassed: percent(
      runs.filter(({ profile }) => nextSkill(profile) === null).length,
      runs.length,
    ),
    itemsToMaster: mean(runs.flatMap(itemsToMaster)).toFixed(1),
    caught: states.length,
    resolved: percent(fixes.length, states.length),
    itemsToResolve: mean(fixes.map(({ itemsToResolve = 0 }) => itemsToResolve)).toFixed(1),
    fixScenes: per(
      ({ scenes }) => scenes.filter(({ request }) => request.kind === 'remediate').length,
    ),
    reviews: per(
      ({ steps }) =>
        steps.filter(({ turn }) => turn.next && turn.pathStep.kind === 'review').length,
    ),
    stuck: per(({ steps }) => steps.filter(({ turn }) => turn.stuck).length),
    skippedPrereqs: items.filter(({ skippedPrereq }) => skippedPrereq).length,
    illegal: runs.reduce((total, { violations }) => total + violations.length, 0),
  };
}

function cohortSection(
  units: UnitId[],
  students: number,
  items: number,
): {
  lines: string[];
  illegal: number;
} {
  const skills = skillsIn(units);
  const lines = [
    `## Units ${unitLabel(units)} (${skills.length} skills), ${students} students × ${items} items`,
    '',
    '| path | cohort | right first try | skills passed | all passed | items to master | caught | resolved | items to resolve | fix clips | reviews | stuck | prereq skips | illegal |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  let illegal = 0;
  for (const condition of CONDITIONS) {
    for (const cohort of COHORTS) {
      const runs = Array.from({ length: students }, (_, index) =>
        runStudent({
          id: `sim-${index}`,
          student: cohort.make(index, units),
          units,
          condition,
          items,
        }),
      );
      const stats = summarize(runs, skills);
      illegal += stats.illegal;
      lines.push(
        `| ${condition} | ${cohort.name} | ${stats.rightFirstTry} | ${stats.skillsPassed} | ${stats.allPassed} | ${stats.itemsToMaster} | ${stats.caught} | ${stats.resolved} | ${stats.itemsToResolve} | ${stats.fixScenes} | ${stats.reviews} | ${stats.stuck} | ${stats.skippedPrereqs} | ${stats.illegal} |`,
      );
    }
  }
  return { lines: [...lines, ''], illegal };
}

/** What a pre-test of this group finds on these skills, by the assumptions of RESEARCH §3.1. */
function assumedPretest(
  rate: Rate,
  skills: SkillId[],
  seed: number,
): Partial<Record<SkillId, PretestResult>> {
  const rng = createRng(seed);
  const results: Partial<Record<SkillId, PretestResult>> = {};
  for (const skill of skills) {
    if (rng.next() / 2 ** 32 < PRETEST_RIGHT[rate]) {
      results[skill] = { outcome: 'correct' };
    } else if (rng.chance(1, 2)) {
      const bugs = CATALOG.filter((entry) => entry.skills.includes(skill));
      results[skill] = { outcome: 'misconception', caught: [{ id: rng.pick(bugs).id }] };
    } else {
      results[skill] = { outcome: 'other_wrong' };
    }
  }
  return results;
}

/** PLAN Phase 4: compare with the time table of RESEARCH §3.1, on the assumptions it states. */
function planSection(students: number): { lines: string[]; illegal: number } {
  const lines = [
    '## Against the time table of RESEARCH §3.1',
    '',
    'Planned time as that table assumes it: one item a minute, each clip at its limit, half of wrong answers misconceptions.',
    '',
    '| units | skills | minutes | group | passed all: sim | passed all: table | items to master a skill | items the time allows per skill | items done | minutes to pass all |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ];
  let illegal = 0;
  for (const { units, minutes, passAll } of PLANS) {
    const skills = skillsIn(units);
    for (const rate of [90, 80, 70] as const) {
      const runs = Array.from({ length: students }, (_, index) =>
        runStudent({
          id: `plan-${rate}-${index}`,
          student: planned(rate / 100, index + rate * 1000),
          units,
          minutes,
          pretest: assumedPretest(rate, skills, index + rate * 7000),
        }),
      );
      illegal += runs.reduce((total, { violations }) => total + violations.length, 0);
      const done = runs.filter(({ profile }) => nextSkill(profile) === null);
      const itemsDone = mean(runs.map(({ steps }) => steps.length));
      const finishedAt = done.flatMap(({ steps }) =>
        steps.filter(({ outcome }) => outcome.allPassed).map(({ minutes: used }) => used),
      );
      lines.push(
        `| ${unitLabel(units)} | ${skills.length} | ${minutes} | ${rate}% right | ${percent(done.length, runs.length)} | ${passAll[rate]}% | ${mean(runs.flatMap(itemsToMaster)).toFixed(1)} | ${(itemsDone / skills.length).toFixed(1)} | ${itemsDone.toFixed(0)} | ${finishedAt.length > 0 ? mean(finishedAt).toFixed(0) : '–'} |`,
      );
    }
  }
  return { lines: [...lines, ''], illegal };
}

export interface SimReport {
  text: string;
  illegal: number;
}

export function buildReport(students: number, items: number): SimReport {
  const sections = PLANS.map(({ units }) => cohortSection(units, students, items));
  const plan = planSection(students);
  const illegal = sections.reduce((total, section) => total + section.illegal, 0) + plan.illegal;
  const text = [
    '# Simulated learners',
    '',
    'A system check. These are not real students: never use these numbers as evidence (PLAN Phase 4).',
    '',
    `**Illegal transitions: ${illegal}**`,
    '',
    '"prereq skips" are items in a skill with an unfinished prereq. The fixed path walks every skill in order by design (AI_DIRECTOR §3.1), so they are not illegal there. On the adaptive path each one would be.',
    '',
    ...sections.flatMap(({ lines }) => lines),
    ...plan.lines,
  ].join('\n');
  return { text, illegal };
}
