import { th } from '@/lib/content/th';
import { allowedTokens } from '@/lib/director/tokens';
import type { PreparedAttempt } from '@/lib/director/rules';
import { skillStateOf } from '@/lib/learner/profile';
import { CATALOG } from '@/lib/topics/matrix/misconceptions';
import { skillById, SKILLS, type SkillId } from '@/lib/topics/matrix/skills';

// What the tutor is told (AI_DIRECTOR §4.1). Built field by field from the profile, so there is no way
// for anything that identifies a student to come along: no ids, no names, and no seeds or item numbers.

const MAX_SKILLS = 5;
const RECENT_ATTEMPTS = 5;
const MS_PER_SECOND = 1000;

function relevantSkills({ after, attempt }: PreparedAttempt): SkillId[] {
  const current = attempt.item.ref.skill;
  const recent = SKILLS.filter(({ id }) => after.skills[id])
    .sort((a, b) => (after.skills[b.id]?.lastSeen ?? 0) - (after.skills[a.id]?.lastSeen ?? 0))
    .map(({ id }) => id);
  return [...new Set([current, ...skillById(current).prereq, ...recent])].slice(0, MAX_SKILLS);
}

function firstTries(prepared: PreparedAttempt, id: SkillId): string {
  return skillStateOf(prepared.after, id)
    .attempts.slice(-RECENT_ATTEMPTS)
    .map(({ countsCorrect }) => (countsCorrect ? '✓' : '✗'))
    .join('');
}

export function buildDirectorInput(prepared: PreparedAttempt, timeMs: number, hintLevel: number) {
  const { after, outcome, attempt, candidates } = prepared;
  const { item, answer } = attempt;
  const { classification } = outcome;
  const { theme } = after.student;
  return {
    trigger: 'after_attempt',
    revealAllowed: true,
    session: { itemsDone: after.itemsDone },
    // What this student said they like, so an example or a turn of phrase can lean towards it.
    interest: theme ? th.themes[theme].name : null,
    lastAttempt: {
      skill: item.ref.skill,
      level: item.ref.difficulty,
      result: classification.type,
      ...(classification.type === 'misconception' && {
        misconception: {
          id: classification.id,
          nameTh: th.misconceptionShort[classification.id as keyof typeof th.misconceptionShort],
          ...(classification.variant && { variant: classification.variant }),
        },
      }),
      timeSec: Math.round(timeMs / MS_PER_SECOND),
      hintLevel,
    },
    skills: relevantSkills(prepared).map((id) => {
      const state = skillStateOf(after, id);
      return {
        id,
        nameTh: skillById(id).nameTh,
        mastery: Number(state.pKnown.toFixed(2)),
        level: state.level,
        recentFirstTry: firstTries(prepared, id),
      };
    }),
    misconceptions: CATALOG.flatMap(({ id }) => {
      const state = after.misconceptions[id];
      return state
        ? [{ id, nameTh: th.misconceptionShort[id], status: state.status, count: state.count }]
        : [];
    }),
    candidates: candidates.map(({ id, scene, next, ruleReason }) => ({
      id,
      ...(scene && { scene: scene.template, beats: scene.beats }),
      next: {
        skill: next.skill,
        level: next.level,
        purpose: next.purpose,
        ...(next.target && { target: next.target }),
      },
      ruleReason,
    })),
    allowedTokens: allowedTokens(item, answer, { revealAllowed: true }),
  };
}
