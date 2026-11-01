import { CONFIG } from '@/lib/config';
import { MAX_NOTE_UNITS } from '@/lib/director/pathStep';
import type { NextTurn, Profile } from '@/lib/director/types';
import { isLegalStatusChange } from '@/lib/learner/misconceptionStatus';
import { isUnlocked } from '@/lib/learner/progress';
import { CATALOG, probeLevels } from '@/lib/topics/matrix/misconceptions';
import { SKILLS, skillById } from '@/lib/topics/matrix/skills';

// What `npm run sim` counts as an illegal transition: a step that SPEC §7.2 does not have, an advance
// past an unfinished prereq, or a skill level that jumps or leaves its range. The checks on the turn
// itself catch anything else that should never be possible.

export interface Violation {
  kind: 'status' | 'level' | 'latch' | 'advance' | 'item' | 'note' | 'candidates';
  detail: string;
}

const DIGIT = /[0-9๐-๙]/;

/** Changes to the learner model from one answer. */
export function checkStep(before: Profile, after: Profile): Violation[] {
  const found: Violation[] = [];

  for (const { id } of CATALOG) {
    const from = before.misconceptions[id]?.status;
    const to = after.misconceptions[id]?.status;
    if (!isLegalStatusChange(from, to)) {
      found.push({ kind: 'status', detail: `${id}: ${from ?? 'none'} → ${to ?? 'none'}` });
    }
  }

  for (const { id, maxLevel } of SKILLS) {
    const from = before.skills[id]?.level ?? 1;
    const to = after.skills[id]?.level ?? 1;
    if (Math.abs(to - from) > 1 || to < 1 || to > maxLevel) {
      found.push({ kind: 'level', detail: `${id}: L${from} → L${to}, max L${maxLevel}` });
    }
    if (before.skills[id]?.passed && !after.skills[id]?.passed) {
      found.push({ kind: 'latch', detail: `${id} stopped being passed` });
    }
  }
  return found;
}

/** One decision, on the profile it was made from. */
export function checkTurn(profile: Profile, turn: NextTurn): Violation[] {
  const found: Violation[] = [];
  const { candidates, choice, fallback, mode, next, pathStep } = turn;

  if (candidates.length < 1 || candidates.length > CONFIG.llm.maxCandidates) {
    found.push({ kind: 'candidates', detail: `${candidates.length} candidates` });
  }
  candidates.forEach(({ id, score }, index) => {
    if (id !== `c${index + 1}`) found.push({ kind: 'candidates', detail: `id ${id} at ${index}` });
    if (index > 0 && score > candidates[index - 1].score) {
      found.push({ kind: 'candidates', detail: `${id} outranks the one before it` });
    }
  });
  if (candidates[0]?.id !== choice) {
    found.push({ kind: 'candidates', detail: `rules chose ${choice}, not the top one` });
  }

  if (pathStep.note.length > MAX_NOTE_UNITS || DIGIT.test(pathStep.note)) {
    found.push({ kind: 'note', detail: pathStep.note });
  }
  if (mode === 'fixed' && pathStep.note !== '') {
    found.push({ kind: 'note', detail: `the fixed path gave a reason: ${pathStep.note}` });
  }

  // A student never sees this go wrong, but it means a generator bug, which should fail loudly here.
  if (fallback) found.push({ kind: 'item', detail: `fell back on ${next?.skill}` });

  if (next) {
    const { skill, difficulty, target, targetVariant } = next;
    if (difficulty > skillById(skill).maxLevel) {
      found.push({ kind: 'item', detail: `${skill} has no L${difficulty}` });
    }
    if (target && !probeLevels(skill, target, targetVariant).includes(difficulty)) {
      found.push({ kind: 'item', detail: `${target} cannot be probed on ${skill} L${difficulty}` });
    }
    if (mode === 'fixed' && target) {
      found.push({ kind: 'item', detail: `the fixed path probed ${target}` });
    }
    // The fixed path walks every skill in order by design (AI_DIRECTOR §3.1).
    if (mode === 'rules' && !isUnlocked(profile, skill)) {
      found.push({ kind: 'advance', detail: `${skill} with its prereqs unfinished` });
    }
  }
  return found;
}
