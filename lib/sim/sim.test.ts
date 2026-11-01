import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { deriveSeed } from '@/lib/core/prng';
import type { Answer, Level } from '@/lib/core/types';
import { MAX_NOTE_UNITS } from '@/lib/director/pathStep';
import { newProfile } from '@/lib/director/turn';
import type { NextTurn, Profile } from '@/lib/director/types';
import { applyPretest } from '@/lib/learner/profile';
import { isUnlocked, nextSkill } from '@/lib/learner/progress';
import type { SkillState, UnitId } from '@/lib/learner/types';
import { CATALOG } from '@/lib/topics/matrix/misconceptions';
import { SKILLS, skillById, type SkillId } from '@/lib/topics/matrix/skills';
import type { MatrixItem, MisconceptionId } from '@/lib/topics/matrix/types';
import { misconceptionAnswer, slipAnswer, unknownAnswer } from './answers';
import { answerItem, openItem } from './drive';
import { checkStep, checkTurn } from './invariants';
import { buildReport } from './report';
import { runStudent } from './run';
import { buggy, perfect, planned, randomStudent, slipper, type SimStudent } from './students';

const ALL: UnitId[] = [1, 2, 3, 4, 5];

const unitsOf = (skill: SkillId): UnitId[] => [skillById(skill).unit];

/** M11 lives in two skills: a bug that is never fixed on `mult` would never reach `mult_noncomm`. */
function bugOnlyOn(skill: SkillId, student: SimStudent): SimStudent {
  return {
    ...student,
    answer: (item) => (item.ref.skill === skill ? student.answer(item) : item.correct),
  };
}

describe('buggy students get a probe within one item of being caught', () => {
  // The rule has one exception, written down here: on the third wrong answer in a row, R7 (.97) beats
  // R1 (.90), so the next item is an L1 item after the worked solution, with no target.
  for (const { id, skills } of CATALOG) {
    for (const skill of skills) {
      it(`${id} on ${skill}`, () => {
        let catches = 0;
        let exceptions = 0;
        for (let seed = 0; seed < 25; seed += 1) {
          const { steps } = runStudent({
            id: `S-${seed}`,
            student: bugOnlyOn(skill, buggy(id, 0, seed)),
            units: unitsOf(skill),
            items: 60,
          });
          steps.forEach(({ outcome, turn, ref }) => {
            const { classification } = outcome;
            if (classification.type !== 'misconception' || classification.id !== id) return;
            if (ref.skill !== skill) return;
            catches += 1;
            // chosenScene drops a clip it cannot build, so nothing else would notice one failing.
            expect(turn.candidates.some(({ scene }) => scene?.request.kind === 'remediate')).toBe(
              true,
            );
            if (turn.stuck) {
              exceptions += 1;
              expect(turn.next?.target).toBeUndefined();
              expect(turn.next?.difficulty).toBe(1);
              expect(turn.scenes[0]?.template).toBe('worked_solution');
            } else {
              expect(turn.next?.target).toBe(id);
            }
          });
        }
        expect(catches).toBeGreaterThan(0);
        // Never fixing means being caught again and again, so the exception must really come up.
        if (catches >= 3) expect(exceptions).toBeGreaterThan(0);
      });
    }
  }
});

describe('a perfect student', () => {
  it.each<[string, UnitId[]]>([
    ['all units', ALL],
    ['Unit 3', [3]],
    ['Units 3–5', [3, 4, 5]],
  ])('never gets a remediation scene: %s', (_, units) => {
    const { scenes, steps } = runStudent({ id: 'P-1', student: perfect(), units, items: 80 });
    expect(scenes.length).toBeGreaterThan(0);
    for (const { request } of scenes) expect(['intro', 'concept']).toContain(request.kind);
    expect(steps.every(({ ref }) => ref.target === undefined)).toBe(true);
  });

  it('plays each lead clip once, intro first in each unit', () => {
    const { scenes } = runStudent({ id: 'P-1', student: perfect(), units: ALL, items: 60 });
    expect(scenes.map(({ request }) => request.kind)).toEqual([
      'intro',
      'concept',
      'concept',
      'intro',
      'concept',
      'intro',
      'concept',
      'concept',
      'intro',
      'concept',
      'concept',
      'intro',
      'concept',
    ]);
  });

  it('passes three items a skill, as in the first row of the table', () => {
    const { steps, profile } = runStudent({ id: 'P-1', student: perfect(), units: [3], items: 9 });
    expect(steps.map(({ ref }) => ref.skill)).toEqual([
      'mult_defined',
      'mult_defined',
      'mult_defined',
      'mult',
      'mult',
      'mult',
      'mult_noncomm',
      'mult_noncomm',
      'mult_noncomm',
    ]);
    // mult_noncomm L1 is a two-way choice, which BKT trusts less, so it may need more than three.
    expect(profile.skills.mult_defined?.passed).toBe(true);
    expect(profile.skills.mult?.passed).toBe(true);
  });
});

describe('advancing', () => {
  const students = (seed: number): SimStudent[] => [
    perfect(),
    slipper(0.2, seed),
    buggy('M08_MULT_DIM_RULE', 0.5, seed),
    randomStudent(seed),
    planned(0.8, seed),
  ];

  it('never reaches a skill with an unfinished prereq', () => {
    for (let seed = 0; seed < 10; seed += 1) {
      for (const student of students(seed)) {
        const { steps } = runStudent({ id: `A-${seed}`, student, units: ALL, items: 60 });
        expect(steps.filter(({ skippedPrereq }) => skippedPrereq)).toEqual([]);
      }
    }
  });

  it('counts a prereq in a closed unit as passed', () => {
    // det_props needs scalar, and inv2 needs scalar too, both in the closed Unit 2.
    const { steps } = runStudent({ id: 'A-1', student: perfect(), units: [3, 4, 5], items: 40 });
    const seen = new Set(steps.map(({ ref }) => ref.skill));
    expect(seen).toContain('det_props');
    expect(seen).toContain('inv2');
    expect(steps.filter(({ skippedPrereq }) => skippedPrereq)).toEqual([]);
  });

  it('holds back a skill until its prereq has really passed', () => {
    const { steps } = runStudent({
      id: 'A-1',
      student: buggy('M01_DIM_SWAP', 0, 1),
      units: [1],
      items: 40,
    });
    expect(steps.every(({ ref }) => ref.skill === 'dim')).toBe(true);
  });
});

describe('reviews (SPEC §7.4)', () => {
  const run = runStudent({ id: 'R-1', student: slipper(0.05, 7), units: ALL, items: 120 });
  const reviewsBeforeAllPassed = () => {
    const end = run.steps.findIndex(({ outcome }) => outcome.allPassed);
    const steps = end < 0 ? run.steps : run.steps.slice(0, end);
    return steps.flatMap(({ turn }, index) => (turn.pathStep.kind === 'review' ? [index] : []));
  };

  it('really happen', () => {
    expect(reviewsBeforeAllPassed().length).toBeGreaterThan(0);
  });

  it('come at L2 and name a passed skill', () => {
    for (const { turn } of run.steps) {
      if (turn.pathStep.kind !== 'review' || !turn.next) continue;
      expect(turn.next.difficulty).toBe(2);
      expect(turn.next.target).toBeUndefined();
    }
  });

  it('are at least 6 items apart while there are skills left', () => {
    const reviews = reviewsBeforeAllPassed();
    for (let index = 1; index < reviews.length; index += 1) {
      expect(reviews[index] - reviews[index - 1]).toBeGreaterThanOrEqual(6);
    }
  });

  it('choose a skill not seen in the last 10 items', () => {
    for (const index of reviewsBeforeAllPassed()) {
      const skill = run.steps[index].turn.next!.skill;
      const recent = run.steps.slice(Math.max(index - 9, 0), index + 1);
      expect(recent.some(({ ref }) => ref.skill === skill)).toBe(false);
    }
  });

  it('do not happen while a misconception is being fixed', () => {
    const { steps } = runStudent({
      id: 'R-2',
      student: buggy('M09_MULT_ELEMENTWISE', 0, 3),
      units: [3],
      items: 60,
    });
    expect(steps.some(({ ref }) => ref.skill === 'mult')).toBe(true);
    const whileOpen = steps.filter(
      ({ outcome, turn }) =>
        outcome.classification.type === 'misconception' && turn.pathStep.kind === 'review',
    );
    expect(whileOpen).toEqual([]);
  });

  it('take the student back to the skill in progress afterwards', () => {
    const backs = run.steps.filter(({ turn }) => turn.pathStep.kind === 'back');
    expect(backs.length).toBeGreaterThan(0);
  });

  it('a misconception found on a review is fixed before going back', () => {
    const answered = (item: MatrixItem): Answer =>
      item.ref.skill === 'mult_defined' && item.ref.difficulty === 2
        ? (misconceptionAnswer(item, 'M08_MULT_DIM_RULE') ?? item.correct)
        : item.correct;
    const student: SimStudent = { label: 'relapses', answer: answered, onScene: () => {} };
    const passing: Profile = {
      ...newProfile({ id: 'R-3', classCode: 'SIMSIM', seatNo: 1, units: [3] }),
      skills: { mult_defined: passedState(0) },
      itemsDone: 20,
      clipsSeen: ['mult_defined', 'mult'],
    };
    let profile = passing;
    const skills: SkillId[] = [];
    for (let index = 0; index < 6; index += 1) {
      const opened = openItem(profile);
      skills.push(opened.item.ref.skill);
      ({ profile } = answerItem(opened.profile, opened.item, student.answer(opened.item)));
    }
    expect(skills[0]).toBe('mult');
    const caught = profile.misconceptions.M08_MULT_DIM_RULE;
    if (caught) {
      const firstReview = skills.indexOf('mult_defined');
      expect(skills[firstReview + 1]).toBe('mult_defined');
    }
  });
});

function passedState(lastSeen: number): SkillState {
  return {
    pKnown: 0.99,
    level: 2,
    attempts: [],
    passed: true,
    wrongStreak: 0,
    stuck: false,
    lastSeen,
  };
}

describe('R7', () => {
  const alwaysWrong: SimStudent = {
    label: 'always wrong',
    answer: unknownAnswer,
    onScene: () => {},
  };

  it('fires on every third wrong answer, not on all of them', () => {
    const { steps } = runStudent({ id: 'W-1', student: alwaysWrong, units: [3], items: 12 });
    const fired = steps.flatMap(({ turn }, index) => (turn.stuck ? [index + 1] : []));
    expect(fired).toEqual([3, 6, 9, 12]);
  });

  it('opens the worked solution, then an L1 item', () => {
    const { steps } = runStudent({ id: 'W-1', student: alwaysWrong, units: [3], items: 3 });
    const { turn } = steps[2];
    expect(turn.scenes[0]?.template).toBe('worked_solution');
    expect(turn.next?.difficulty).toBe(1);
    expect(turn.pathStep.kind).toBe('worked');
    expect(turn.candidates[0]).toMatchObject({ rule: 'R7', score: 0.97 });
  });

  it('leaves a flag for the teacher until a right answer', () => {
    const { profile } = runStudent({ id: 'W-1', student: alwaysWrong, units: [3], items: 3 });
    expect(profile.skills.mult_defined?.stuck).toBe(true);
    const opened = openItem(profile);
    const after = answerItem(opened.profile, opened.item, opened.item.correct);
    expect(after.profile.skills.mult_defined?.stuck).toBe(false);
  });

  it('keeps a stuck student working, however long it goes on', () => {
    const { profile, steps, violations } = runStudent({
      id: 'W-1',
      student: alwaysWrong,
      units: [3],
      items: 200,
    });
    expect(steps).toHaveLength(200);
    expect(new Set(steps.map(({ ref }) => ref.skill))).toEqual(new Set(['mult_defined']));
    expect(profile.xp).toBe(0);
    expect(violations).toEqual([]);
  });
});

describe('the table of SPEC §7.3, through the director', () => {
  const M03: MisconceptionId = 'M03_TRANSPOSE_WRONG';

  /** At `transpose`, the one typed skill whose items are all a plain matrix, so ผ is always a slip. */
  function atTranspose(pretestRight: boolean): Profile {
    const start: Profile = {
      ...newProfile({ id: 'T-1', classCode: 'SIMSIM', seatNo: 1, units: [1] }),
      skills: { dim: passedState(0), index: passedState(0) },
      clipsSeen: ['dim', 'index', 'transpose'],
    };
    return pretestRight
      ? applyPretest(start, { transpose: { outcome: 'correct' } }, { at: 0 })
      : start;
  }

  it.each<[string, boolean, string, Level[], string[], number]>([
    ['0.15', false, 'ถถถ', [1, 1, 2], ['0.796', '0.988', '0.999'], 3],
    ['0.15', false, 'ผถถถ', [1, 1, 1, 2], ['0.166', '0.814', '0.989', '0.999'], 4],
    ['0.15', false, 'ถถMถถ', [1, 1, 2, 2, 2], ['0.796', '0.988', '0.913', '0.996', '1.000'], 5],
    [
      '0.15',
      false,
      'ถถผผถถ',
      [1, 1, 2, 2, 1, 2],
      ['0.796', '0.988', '0.913', '0.595', '0.969', '0.998'],
      6,
    ],
    ['0.60', true, 'ถ', [2], ['0.970'], 1],
    ['0.60', true, 'ผถถถ', [2, 1, 1, 2], ['0.266', '0.887', '0.994', '1.000'], 4],
  ])('from %s (pre-test right: %s): %s', (_, pretestRight, script, levels, known, passAt) => {
    let profile = atTranspose(pretestRight);
    const seenLevels: Level[] = [];
    const seenKnown: string[] = [];
    let passedAt = 0;
    [...script].forEach((mark, index) => {
      const opened = openItem(profile);
      expect(opened.item.ref.skill).toBe('transpose');
      seenLevels.push(opened.item.ref.difficulty);
      const answer =
        mark === 'ถ'
          ? opened.item.correct
          : mark === 'M'
            ? misconceptionAnswer(opened.item, M03)!
            : slipAnswer(opened.item);
      const result = answerItem(opened.profile, opened.item, answer);
      ({ profile } = result);
      seenKnown.push(profile.skills.transpose!.pKnown.toFixed(3));
      if (passedAt === 0 && result.outcome.skillPassed === 'transpose') passedAt = index + 1;
    });
    expect(seenLevels).toEqual(levels);
    expect(seenKnown).toEqual(known);
    expect(passedAt).toBe(passAt);
  });

  it('holds the M row until the misconception is fixed, then pays for the fix', () => {
    let profile = atTranspose(false);
    const notes: string[] = [];
    let resolved: string | null = null;
    for (const mark of 'ถถMถถ') {
      const opened = openItem(profile);
      const answer = mark === 'M' ? misconceptionAnswer(opened.item, M03)! : opened.item.correct;
      const result = answerItem(opened.profile, opened.item, answer);
      ({ profile } = result);
      notes.push(result.turn.pathStep.note);
      resolved = result.outcome.resolved ?? resolved;
    }
    expect(notes[2]).toBe('พาดูคลิปนี้เพราะเมื่อกี้หมุนแทนการสะท้อน');
    expect(notes[3]).toBe('เพิ่มข้อนี้เพราะเมื่อกี้หมุนแทนการสะท้อน');
    expect(resolved).toBe(M03);
    expect(profile.misconceptions[M03]?.status).toBe('resolved');
    expect(profile.xp).toBe(4 * 10 + 20);
  });
});

describe('after passing every open skill', () => {
  it.each<[string, UnitId[]]>([
    ['Unit 3', [3]],
    ['Unit 4', [4]],
    ['Units 3–5', [3, 4, 5]],
  ])('there are still items to do: %s', (_, units) => {
    const { steps, profile } = runStudent({ id: 'D-1', student: perfect(), units, items: 70 });
    expect(steps).toHaveLength(70);
    expect(nextSkill(profile)).toBeNull();
    const end = steps.findIndex(({ outcome }) => outcome.allPassed);
    expect(end).toBeGreaterThan(0);
    for (const { turn } of steps.slice(end)) {
      expect(turn.next).not.toBeNull();
      expect(turn.pathStep.kind).toBe('review');
    }
  });

  it('reviews every skill in turn, not the same one', () => {
    const { steps } = runStudent({ id: 'D-1', student: perfect(), units: [3], items: 40 });
    const end = steps.findIndex(({ outcome }) => outcome.allPassed);
    const reviewed = steps.slice(end + 1, end + 7).map(({ ref }) => ref.skill);
    expect(new Set(reviewed).size).toBe(3);
  });
});

describe('two students who answer differently', () => {
  const route = (steps: ReturnType<typeof runStudent>['steps']) =>
    steps.map(({ ref }) => `${ref.skill}:${ref.difficulty}:${ref.target ?? ''}`);

  it('take different paths, on different numbers', () => {
    const right = runStudent({ id: 'A-1', student: perfect(), units: [1], items: 15 });
    const bugged = runStudent({
      id: 'A-2',
      student: buggy('M01_DIM_SWAP', 0, 1),
      units: [1],
      items: 15,
    });
    expect(route(right.steps)).not.toEqual(route(bugged.steps));
    const notes = (run: typeof right) => run.steps.map(({ turn }) => turn.pathStep.note);
    expect(notes(right)).not.toEqual(notes(bugged));
    const seeds = (run: typeof right) => run.steps.map(({ ref }) => ref.seed);
    expect(seeds(right).filter((seed) => seeds(bugged).includes(seed))).toEqual([]);
  });

  it('even two who answer alike get different numbers', () => {
    const one = runStudent({ id: 'A-1', student: perfect(), units: [1], items: 5 });
    const two = runStudent({ id: 'A-2', student: perfect(), units: [1], items: 5 });
    expect(route(one.steps)).toEqual(route(two.steps));
    expect(one.steps[0].ref.seed).toBe(deriveSeed('A-1', 0));
    expect(two.steps[0].ref.seed).toBe(deriveSeed('A-2', 0));
    expect(one.steps[0].ref.seed).not.toBe(two.steps[0].ref.seed);
  });
});

describe('every note along every path', () => {
  it('is at most 40 code units with no digits', () => {
    for (let seed = 0; seed < 6; seed += 1) {
      for (const student of [
        perfect(),
        slipper(0.2, seed),
        randomStudent(seed),
        planned(0.7, seed),
        ...CATALOG.map(({ id }) => buggy(id, 0.3, seed)),
      ]) {
        const { profile } = runStudent({ id: `N-${seed}`, student, units: ALL, items: 45 });
        for (const { note } of profile.path) {
          expect(note.length).toBeLessThanOrEqual(MAX_NOTE_UNITS);
          expect(note).not.toMatch(/[0-9๐-๙]/);
          expect(note.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('fixing a misconception', () => {
  it.each(
    CATALOG.flatMap(({ id, skills }) =>
      skills.map((skill): [MisconceptionId, SkillId] => [id, skill]),
    ),
  )('%s on %s can reach resolved', (id, skill) => {
    const resolved = Array.from({ length: 30 }, (_, seed) =>
      runStudent({
        id: `F-${seed}`,
        student: buggy(id, 1, seed),
        units: unitsOf(skill),
        items: 50,
      }),
    ).filter(({ profile }) => profile.misconceptions[id]?.status === 'resolved');
    expect(resolved.length).toBeGreaterThan(0);
    for (const { profile } of resolved) {
      expect(profile.misconceptions[id]?.itemsToResolve).toBeGreaterThan(0);
      expect(profile.misconceptions[id]?.rewarded).toBe(true);
    }
  });

  it('a misconception caught does not stop the student for good', () => {
    const { profile } = runStudent({
      id: 'F-1',
      student: buggy('M01_DIM_SWAP', 1, 1),
      units: [1],
      items: 30,
    });
    expect(profile.skills.dim?.passed).toBe(true);
    expect(profile.skills.index?.passed).toBe(true);
  });
});

describe('the whole model under any answers', () => {
  it('never breaks a rule and never throws', () => {
    const skillsOpen = fc.subarray(ALL, { minLength: 1 });
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 - 1 }), skillsOpen, (seed, units) => {
        const { violations, steps } = runStudent({
          id: `X-${seed}`,
          student: randomStudent(seed),
          units,
          items: 20,
        });
        expect(violations).toEqual([]);
        expect(steps).toHaveLength(20);
      }),
      { numRuns: 1000 },
    );
  });

  it('never breaks a rule on the fixed path', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 - 1 }), (seed) => {
        const { violations } = runStudent({
          id: `X-${seed}`,
          student: randomStudent(seed),
          units: [3, 4, 5],
          condition: 'fixed',
          items: 20,
        });
        expect(violations).toEqual([]);
      }),
      { numRuns: 200 },
    );
  });

  it('is deterministic', () => {
    const once = () =>
      JSON.stringify(
        runStudent({ id: 'D-1', student: planned(0.7, 42), units: ALL, items: 40 }).profile,
      );
    expect(once()).toBe(once());
  });
});

describe('the checks themselves', () => {
  const base = (): Profile => newProfile({ id: 'C-1', classCode: 'SIMSIM', seatNo: 1, units: [3] });

  const turnWith = (extra: Partial<NextTurn>): NextTurn => ({
    trigger: 'after_attempt',
    mode: 'rules',
    revealAllowed: true,
    candidates: [
      {
        id: 'c1',
        rule: 'R5',
        score: 0.8,
        next: { skill: 'mult_defined', level: 1, purpose: 'practice' },
        stepKind: 'same_level',
        ruleReason: 'x',
      },
    ],
    choice: 'c1',
    reason: 'x',
    scenes: [],
    next: null,
    pathStep: { kind: 'same_level', skill: 'mult_defined', level: 1, note: 'ฝึก' },
    stuck: false,
    ...extra,
  });

  it('find a status change SPEC §7.2 does not have', () => {
    const after: Profile = {
      ...base(),
      misconceptions: {
        M09_MULT_ELEMENTWISE: {
          status: 'active',
          count: 1,
          fixStreak: 0,
          scenesSeen: 0,
          openedAtItem: 0,
          openedAtMs: 0,
          lastCaughtAtItem: 0,
          rewarded: false,
        },
      },
    };
    expect(checkStep(base(), after).map(({ kind }) => kind)).toEqual(['status']);
  });

  it('find a level that jumps or leaves its range', () => {
    const state = (level: Level): SkillState => ({ ...passedState(0), level, passed: false });
    const at = (skills: Profile['skills']): Profile => ({ ...base(), skills });
    expect(
      checkStep(at({ mult: state(1) }), at({ mult: state(3) })).map(({ kind }) => kind),
    ).toEqual(['level']);
    expect(
      checkStep(at({ det2: state(2) }), at({ det2: state(3) })).map(({ kind }) => kind),
    ).toEqual(['level']);
  });

  it('find a pass that was taken back', () => {
    const before: Profile = { ...base(), skills: { mult: passedState(1) } };
    const after: Profile = { ...base(), skills: { mult: { ...passedState(1), passed: false } } };
    expect(checkStep(before, after).map(({ kind }) => kind)).toEqual(['latch']);
  });

  it('find an advance past an unfinished prereq', () => {
    const next = { topic: 'matrix', skill: 'mult', difficulty: 1, seed: 1, gv: 2 } as const;
    expect(checkTurn(base(), turnWith({ next })).map(({ kind }) => kind)).toEqual(['advance']);
    expect(isUnlocked(base(), 'mult')).toBe(false);
  });

  it('let the fixed path walk past a prereq, as it is meant to', () => {
    const next = { topic: 'matrix', skill: 'mult', difficulty: 1, seed: 1, gv: 2 } as const;
    const fixed = turnWith({
      next,
      mode: 'fixed',
      pathStep: { kind: 'fixed', skill: 'mult', level: 1, note: '' },
    });
    expect(checkTurn(base(), fixed)).toEqual([]);
  });

  it('find a note with a digit or too long', () => {
    const step = (note: string) => ({
      pathStep: { kind: 'same_level', skill: 'mult_defined', level: 1, note } as const,
    });
    expect(checkTurn(base(), turnWith(step('ข้อ 3'))).map(({ kind }) => kind)).toEqual(['note']);
    expect(checkTurn(base(), turnWith(step('ก'.repeat(41)))).map(({ kind }) => kind)).toEqual([
      'note',
    ]);
  });

  it('find an item the skill cannot have', () => {
    const next = { topic: 'matrix', skill: 'det2', difficulty: 3, seed: 1, gv: 2 } as const;
    const kinds = checkTurn(base(), turnWith({ next })).map(({ kind }) => kind);
    expect(kinds).toContain('item');
  });

  it('find a choice that is not the top candidate', () => {
    const [only] = turnWith({}).candidates;
    const second = { ...only, id: 'c2' as const, score: 0.5 };
    const turn = turnWith({ candidates: [only, second], choice: 'c2' });
    expect(checkTurn(base(), turn).map(({ kind }) => kind)).toEqual(['candidates']);
  });
});

describe('buildReport', () => {
  it('reports no illegal transitions on a small run, and says what the numbers are not', () => {
    const { text, illegal } = buildReport(2, 12);
    expect(illegal).toBe(0);
    expect(text).toContain('**Illegal transitions: 0**');
    expect(text).toContain('never use these numbers as evidence');
    for (const label of ['1–5', '2–5', '3–5', '3–4']) expect(text).toContain(`Units ${label}`);
  });
});

describe('SKILLS', () => {
  it('still list prereqs first, which is what nextSkill relies on', () => {
    const seen = new Set<SkillId>();
    for (const { id, prereq } of SKILLS) {
      for (const needed of prereq) expect(seen.has(needed)).toBe(true);
      seen.add(id);
    }
  });
});
