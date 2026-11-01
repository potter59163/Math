import { describe, expect, it } from 'vitest';
import { CONFIG } from '@/lib/config';
import { restoreAnswer } from '@/lib/core/answerJson';
import { deriveSeed } from '@/lib/core/prng';
import type { Level } from '@/lib/core/types';
import { applyAttempt, applyPretest } from '@/lib/learner/profile';
import type { Student, UnitId } from '@/lib/learner/types';
import { misconceptionAnswer, slipAnswer, unknownAnswer } from '@/lib/sim/answers';
import { answerItem, openItem, settle } from '@/lib/sim/drive';
import { generate } from '@/lib/topics/matrix/generators';
import type { GenerateRequest, MatrixItem, MisconceptionId } from '@/lib/topics/matrix/types';
import { afterAttemptCandidates } from './candidates';
import { currentItem, drawItem } from './items';
import { MAX_NOTE_UNITS } from './pathStep';
import { beginSession, requestHelp, startSession, submitAttempt } from './rules';
import { buildScene, sceneOrNull } from './scene';
import { commitTurn, finishScene, finishTurn, newProfile } from './turn';
import type { Profile } from './types';

const M01: MisconceptionId = 'M01_DIM_SWAP';
const M09: MisconceptionId = 'M09_MULT_ELEMENTWISE';

const student = (units: UnitId[] = [1, 2, 3, 4, 5]): Student => ({
  id: 'ABC123-7',
  units,
});

const roundTrip = (profile: Profile): Profile => JSON.parse(JSON.stringify(profile));

describe('beginSession', () => {
  it('gives the turn for /api/session/start, with or without a clip', () => {
    const withClip = beginSession(newProfile(student([3])));
    expect(withClip.turn).toMatchObject({ trigger: 'session_start', revealAllowed: false });
    expect(withClip.turn?.next).toEqual(withClip.profile.current?.ref);

    const pretested = applyPretest(
      newProfile(student([3])),
      { mult_defined: { outcome: 'correct' } },
      { at: 0 },
    );
    const noClip = beginSession(pretested);
    expect(noClip.turn?.scenes).toEqual([]);
    expect(noClip.turn?.pathStep.kind).toBe('skip_clip');
    expect(noClip.profile.pending).toBeUndefined();
  });

  it('gives no turn when an item is already open', () => {
    const profile = settle(startSession(newProfile(student())));
    expect(beginSession(profile)).toEqual({ profile, turn: null });
  });
});

describe('startSession', () => {
  it('opens the first item and queues its lead clip', () => {
    const profile = startSession(newProfile(student([3])));
    expect(currentItem(profile)?.ref.skill).toBe('mult_defined');
    expect(profile.current?.ref.seed).toBe(deriveSeed('ABC123-7', 0));
    expect(profile.counter).toBe(1);
    expect(profile.pending?.turn.scenes[0].request.kind).toBe('intro');
    expect(profile.path).toHaveLength(1);
    expect(profile.path[0].kind).toBe('start');
  });

  it('changes nothing while an item is open, so a reload keeps the same numbers', () => {
    const profile = settle(startSession(newProfile(student())));
    expect(startSession(profile)).toBe(profile);
  });

  it('changes nothing while a turn is pending', () => {
    const profile = startSession(newProfile(student()));
    expect(startSession(profile)).toBe(profile);
  });

  it('replaces an item from another generator version instead of throwing', () => {
    const open = settle(startSession(newProfile(student())));
    const stale: Profile = {
      ...open,
      current: { ref: { ...open.current!.ref, gv: CONFIG.generatorVersion + 1 }, hintLevel: 2 },
    };
    expect(currentItem(stale)).toBeNull();
    const fresh = startSession(stale);
    expect(fresh.current?.ref.gv).toBe(CONFIG.generatorVersion);
    expect(fresh.current?.hintLevel).toBe(0);
  });

  it('gives two students different numbers', () => {
    const a = startSession(newProfile(student()));
    const b = startSession(newProfile({ ...student(), id: 'ABC123-8' }));
    expect(a.current?.ref.seed).not.toBe(b.current?.ref.seed);
  });
});

describe('submitAttempt', () => {
  it('runs the learner model, decides, and opens the next item', () => {
    const opened = openItem(newProfile(student([3])));
    const before = opened.profile.counter;
    const { profile, outcome, turn } = answerItem(opened.profile, opened.item, opened.item.correct);
    expect(outcome.classification).toEqual({ type: 'correct' });
    expect(profile.itemsDone).toBe(1);
    expect(turn.trigger).toBe('after_attempt');
    expect(turn.revealAllowed).toBe(true);
    expect(turn.next?.seed).toBe(deriveSeed('ABC123-7', before));
    expect(profile.current?.ref).toEqual(turn.next);
    expect(profile.counter).toBe(before + 1);
  });

  it('adds one step to the path, with the note of the chosen candidate', () => {
    const opened = openItem(newProfile(student([3])));
    const steps = opened.profile.path.length;
    const { profile, turn } = answerItem(opened.profile, opened.item, opened.item.correct);
    expect(profile.path).toHaveLength(steps + 1);
    expect(profile.path.at(-1)).toEqual(turn.pathStep);
    expect(turn.pathStep.note.length).toBeLessThanOrEqual(MAX_NOTE_UNITS);
  });

  it('keeps what the feedback screen needs', () => {
    const opened = openItem(newProfile(student([1])));
    const answer = misconceptionAnswer(opened.item, M01)!;
    const { profile } = answerItem(opened.profile, opened.item, answer);
    expect(profile.pending?.closed).toMatchObject({
      ref: opened.item.ref,
      hintLevel: 0,
      openAtSend: [],
      outcome: { classification: { type: 'misconception', id: M01 } },
    });
  });

  it('flags R7 for the teacher', () => {
    let profile = newProfile(student([1]));
    let stuck = false;
    for (let index = 0; index < 3; index += 1) {
      const opened = openItem(profile);
      const result = answerItem(opened.profile, opened.item, unknownAnswer(opened.item));
      ({ profile } = result);
      stuck = result.turn.stuck;
    }
    expect(stuck).toBe(true);
    expect(profile.skills.dim?.stuck).toBe(true);
  });

  it('marks a review, so that the next one waits its turn', () => {
    const opened = openItem(newProfile(student([1])));
    const review = commitTurn(opened.profile, {
      trigger: 'after_attempt',
      candidates: [
        {
          id: 'c1',
          rule: 'R6',
          score: 0.95,
          next: { skill: 'dim', level: 2, purpose: 'review' },
          stepKind: 'review',
          ruleReason: 'x',
        },
      ],
      choice: 'c1',
    });
    expect(review.profile.lastReviewAt).toBe(opened.profile.itemsDone);
  });
});

describe('reload after sending, before pressing on', () => {
  const caught = () => {
    const opened = openItem(newProfile(student([3])));
    const item = generate({ skill: 'mult', difficulty: 1, seed: 8, target: M09 });
    return answerItem(
      { ...opened.profile, skills: { mult_defined: passed(), ...opened.profile.skills } },
      item,
      misconceptionAnswer(item, M09)!,
    );
  };

  it('keeps the turn, the answer and the next item', () => {
    const { profile, turn } = caught();
    const restored = roundTrip(profile);
    expect(restored.pending?.turn).toEqual(turn);
    expect(restored.current?.ref).toEqual(turn.next);
    expect(restored.pending?.closed?.answer).toEqual(profile.pending?.closed?.answer);
  });

  it('rebuilds the compare scene with the student answer, exactly', () => {
    const { profile, turn } = caught();
    const restored = roundTrip(profile);
    const [scene] = restored.pending!.turn.scenes;
    expect(scene.request.kind).toBe('remediate');
    expect(JSON.stringify(buildScene(scene.request))).toBe(
      JSON.stringify(buildScene(turn.scenes[0].request)),
    );
    if (scene.request.kind === 'remediate') {
      const answer = restoreAnswer(scene.request.answer);
      expect(answer).toEqual(misconceptionAnswer(currentMult(), M09));
    }
  });

  it('opens the same next item afterwards', () => {
    const { profile, turn } = caught();
    const after = settle(roundTrip(profile));
    expect(after.current?.ref).toEqual(turn.next);
    expect(after.pending).toBeUndefined();
  });
});

function currentMult(): MatrixItem {
  return generate({ skill: 'mult', difficulty: 1, seed: 8, target: M09 });
}

function passed() {
  return {
    pKnown: 0.99,
    level: 2 as Level,
    attempts: [],
    passed: true,
    wrongStreak: 0,
    stuck: false,
    lastSeen: 0,
  };
}

describe('finishing a turn', () => {
  it('finishScene marks a lead clip as seen, and the item opens', () => {
    const start = startSession(newProfile(student()));
    const after = finishScene(start);
    expect(after.clipsSeen).toEqual(['dim']);
    expect(after.pending).toBeUndefined();
    expect(currentItem(after)?.ref.skill).toBe('dim');
  });

  it('finishScene counts a view of the scene for R1', () => {
    const opened = openItem(newProfile(student([1])));
    const { profile } = answerItem(
      opened.profile,
      opened.item,
      misconceptionAnswer(opened.item, M01)!,
    );
    expect(profile.misconceptions[M01]?.scenesSeen).toBe(0);
    expect(finishScene(profile).misconceptions[M01]?.scenesSeen).toBe(1);
  });

  it('finishTurn only clears the pending turn', () => {
    const opened = openItem(newProfile(student([1])));
    const { profile } = answerItem(opened.profile, opened.item, opened.item.correct);
    const after = finishTurn(profile);
    expect(after.pending).toBeUndefined();
    expect(after.current).toEqual(profile.current);
    expect(finishTurn(after)).toBe(after);
  });
});

describe('R1 through a real session', () => {
  it('plays the scene twice, then tests without it', () => {
    let profile = newProfile(student([1]));
    const scenes: (string | undefined)[] = [];
    for (let index = 0; index < 3; index += 1) {
      const opened = openItem(profile);
      const answer = misconceptionAnswer(opened.item, M01)!;
      const result = answerItem(opened.profile, opened.item, answer);
      // Skip R7: a right answer in between would change the rule under test.
      const quiet: Profile = {
        ...result.profile,
        skills: {
          ...result.profile.skills,
          dim: { ...result.profile.skills.dim!, wrongStreak: 0 },
        },
      };
      scenes.push(result.turn.scenes[0]?.template);
      profile = quiet;
    }
    expect(scenes.slice(0, 2)).toEqual(['dimension_match', 'dimension_match']);
    expect(scenes[2]).toBeUndefined();
  });
});

describe('the seed goes only with the choice (SPEC §6)', () => {
  it('whichever candidate is chosen, the numbers of a same-level item do not change', () => {
    const opened = openItem(newProfile(student([3])));
    const item = generate({ skill: 'mult_defined', difficulty: 1, seed: 5 });
    const answer = misconceptionAnswer(item, 'M08_MULT_DIM_RULE') ?? slipAnswer(item);
    const { profile: after, outcome } = applyAttempt(opened.profile, {
      item,
      answer,
      hintLevel: 0,
      at: 0,
      timeMs: 1,
    });
    const candidates = afterAttemptCandidates(after, { item, answer, outcome });
    expect(candidates.length).toBeGreaterThan(1);
    const seeds = candidates.map(
      ({ id }) =>
        commitTurn(after, { trigger: 'after_attempt', candidates, choice: id }).turn.next?.seed,
    );
    expect(new Set(seeds).size).toBe(1);
    expect(seeds[0]).toBe(deriveSeed('ABC123-7', after.counter));
  });

  it('looking at clips never moves the numbers of the next item', () => {
    const plain = startSession(newProfile(student()));
    const viewed = finishScene(plain);
    expect(viewed.current?.ref).toEqual(plain.current?.ref);
    expect(viewed.counter).toBe(plain.counter);
  });

  it('a fall-back seed is not used twice', () => {
    const profile = newProfile(student());
    const failing = (request: GenerateRequest): MatrixItem => {
      if (request.seed === deriveSeed('ABC123-7', 0)) throw new Error('bad seed');
      return generate(request);
    };
    const draw = drawItem(profile, { skill: 'dim', level: 1, purpose: 'practice' }, failing);
    expect(draw.item.ref.seed).toBe(deriveSeed('ABC123-7', 1));
    expect(draw.counter).toBe(2);
    expect(draw.fellBack).toBe(false);
  });
});

describe('when the generator fails (.claude/rules/director.md)', () => {
  const probeStep = {
    skill: 'mult',
    level: 2,
    purpose: 'probe',
    target: M09,
  } as const;

  it('serves item(s, L) with no target, and never throws', () => {
    const profile = newProfile(student([3]));
    const failing = (request: GenerateRequest): MatrixItem => {
      if (request.target) throw new Error('cannot build');
      return generate(request);
    };
    const draw = drawItem(profile, probeStep, failing);
    expect(draw.fellBack).toBe(true);
    expect(draw.item.ref.target).toBeUndefined();
    expect(draw.item.ref.difficulty).toBe(1);
  });

  it('tells the turn, and the note stops promising a probe', () => {
    const profile = newProfile(student([3]));
    // A level the catalog refuses, which the generator throws on just as a bug would.
    const { turn } = commitTurn(profile, {
      trigger: 'after_attempt',
      candidates: [
        {
          id: 'c1',
          rule: 'R5',
          score: 0.85,
          next: { skill: 'mult', level: 3, purpose: 'probe', target: M09 },
          stepKind: 'probe',
          misconception: M09,
          ruleReason: 'x',
        },
      ],
      choice: 'c1',
    });
    expect(turn.fallback).toBe('generator');
    expect(turn.next?.target).toBeUndefined();
    expect(turn.pathStep.kind).toBe('same_level');
  });
});

describe('sceneOrNull', () => {
  it('gives null for a scene that cannot be built', () => {
    const { ref } = generate({ skill: 'dim', difficulty: 1, seed: 1 });
    expect(sceneOrNull({ kind: 'reveal', ref: { ...ref, gv: 999 } })).toBeNull();
    expect(sceneOrNull({ kind: 'reveal', ref })).not.toBeNull();
  });
});

describe('requestHelp', () => {
  const open = () => openItem(newProfile(student([3])));

  it('keeps the open item, its hint level and the counter', () => {
    const { profile, item } = open();
    const held: Profile = { ...profile, current: { ...profile.current!, hintLevel: 2 } };
    const result = requestHelp(held, item, 0);
    expect(result?.profile.current).toEqual(held.current);
    expect(result?.profile.counter).toBe(held.counter);
    expect(result?.profile.pending).toBeUndefined();
  });

  it('adds a step with its own note, and never reveals', () => {
    const { profile, item } = open();
    const result = requestHelp(profile, item, 0);
    expect(result?.turn).toMatchObject({
      trigger: 'student_request',
      revealAllowed: false,
      next: null,
      pathStep: { kind: 'request', note: 'เปิดคลิปนี้ตามที่ขอ' },
    });
    expect(result?.profile.path).toHaveLength(profile.path.length + 1);
  });

  it('plays another example than the item being worked on', () => {
    const { profile, item } = open();
    for (let nth = 0; nth < 20; nth += 1) {
      const spec = buildScene(requestHelp(profile, item, nth)!.turn.scenes[0].request);
      expect(spec.purpose).toBe('request');
    }
  });
});

describe('a pre-test through the director (SPEC §7.1)', () => {
  it('a right skill can pass in one item, then moves on', () => {
    const start = applyPretest(newProfile(student()), { dim: { outcome: 'correct' } }, { at: 0 });
    const opened = openItem(start);
    expect(opened.item.ref).toMatchObject({ skill: 'dim', difficulty: 2 });
    const { outcome, turn } = answerItem(opened.profile, opened.item, opened.item.correct);
    expect(outcome.skillPassed).toBe('dim');
    expect(turn.next?.skill).toBe('index');
  });

  it('advancing into a skill the pre-test flagged starts with a probe', () => {
    const start = applyPretest(
      newProfile(student()),
      {
        dim: { outcome: 'correct' },
        index: { outcome: 'misconception', caught: [{ id: 'M02_INDEX_SWAP' }] },
      },
      { at: 0 },
    );
    const opened = openItem(start);
    const { turn } = answerItem(opened.profile, opened.item, opened.item.correct);
    expect(turn.next).toMatchObject({ skill: 'index', target: 'M02_INDEX_SWAP' });
    expect(turn.pathStep.note).toBe('ตอน pre-test อ่านแถวหลักสลับ');
  });
});

describe('submitAttempt with hints', () => {
  it('the attached hint of R2 opens with the item', () => {
    const opened = openItem(newProfile(student([1])));
    const { profile } = commitTurn(opened.profile, {
      trigger: 'after_attempt',
      candidates: [
        {
          id: 'c1',
          rule: 'R2',
          score: 0.5,
          next: { skill: 'dim', level: 1, purpose: 'practice', hintLevel: 1 },
          stepKind: 'same_level',
          ruleReason: 'x',
        },
      ],
      choice: 'c1',
    });
    expect(profile.current?.hintLevel).toBe(1);
  });

  it('remembers what was open when the answer was sent', () => {
    const opened = openItem(newProfile(student([1])));
    const caught = answerItem(opened.profile, opened.item, misconceptionAnswer(opened.item, M01)!);
    const next = currentItem(settle(caught.profile))!;
    const result = submitAttempt(settle(caught.profile), {
      item: next,
      answer: next.correct,
      hintLevel: 0,
      at: 0,
      timeMs: 1,
    });
    expect(result.profile.pending?.closed?.openAtSend).toEqual([M01]);
  });
});
