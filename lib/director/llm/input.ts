import { CONFIG } from '@/lib/config';
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

// A number the tutor is told is a number it copies into its words, and then it gets thrown away. So what
// it reads about skills and levels has none: "det 2×2" is "det", det2 is det_small, and level 1 is ง่าย.
const withoutSize = (name: string) => name.replace(/\s*\d+×\d+/, '');
const SKILL_WORDS: Partial<Record<SkillId, string>> = {
  det2: 'det_small',
  det3: 'det_large',
  inv2: 'inverse',
};
const skillWord = (id: SkillId) => SKILL_WORDS[id] ?? id;
const LEVEL_WORDS = { 1: 'ง่าย', 2: 'กลาง', 3: 'ยาก' } as const;
// The clip that draws the diagonals also serves a 2×2, where calling it Sarrus would be wrong.
const sceneWord = (template: string) => (template === 'sarrus' ? 'det_diagonals' : template);
const speedWord = (ms: number) =>
  ms < CONFIG.llm.quickAnswerMs ? 'เร็ว' : ms > CONFIG.llm.slowAnswerMs ? 'ช้า' : 'ปกติ';

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
  const tokens = allowedTokens(item, answer, { revealAllowed: true });
  return {
    trigger: 'after_attempt',
    revealAllowed: true,
    session: { itemsDone: after.itemsDone },
    // What this student said they like, so an example or a turn of phrase can lean towards it.
    interest: theme ? th.themes[theme].name : null,
    lastAttempt: {
      skill: skillWord(item.ref.skill),
      level: LEVEL_WORDS[item.ref.difficulty],
      // It never sees the question, and without this it talks about a B that the item does not have.
      matrices: tokens.includes('bCell') || tokens.includes('dimsB') ? ['A', 'B'] : ['A'],
      result: classification.type,
      ...(classification.type === 'misconception' && {
        misconception: {
          id: classification.id,
          nameTh: th.misconceptionShort[classification.id as keyof typeof th.misconceptionShort],
          ...(classification.variant && { variant: classification.variant }),
        },
      }),
      speed: speedWord(timeMs),
      hintLevel,
    },
    skills: relevantSkills(prepared).map((id) => {
      const state = skillStateOf(after, id);
      return {
        id: skillWord(id),
        nameTh: withoutSize(skillById(id).nameTh),
        mastery: Number(state.pKnown.toFixed(2)),
        level: LEVEL_WORDS[state.level],
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
      ...(scene && { scene: sceneWord(scene.template), beats: scene.beats }),
      next: {
        skill: skillWord(next.skill),
        level: LEVEL_WORDS[next.level],
        purpose: next.purpose,
        ...(next.target && { target: next.target }),
      },
      ruleReason,
    })),
    allowedTokens: tokens,
  };
}
