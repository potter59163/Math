import { describe, expect, it, vi } from 'vitest';

// Vectors are switched on for this file only, as NEXT_PUBLIC_TOPICS=matrix,vector does in dev.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_TOPICS = 'matrix,vector';
});

import { nextSkill } from '@/lib/learner/progress';
import type { UnitId } from '@/lib/learner/types';
import { packOfSkill } from '@/lib/topics';
import { CATALOG, probeLevels } from '@/lib/topics/vector/misconceptions';
import { SKILLS } from '@/lib/topics/vector/skills';
import { runStudent } from './run';
import { buggy, perfect, planned, randomStudent } from './students';

// Simulated vector learners, through the same director and learner model as the matrix ones. Their
// results test the system, never real students.

const MATRIX_UNITS: UnitId[] = [1, 2, 3, 4, 5];

describe('a perfect vector student', () => {
  const run = runStudent({
    id: 'VP-1',
    student: perfect(),
    units: MATRIX_UNITS,
    topic: 'vector',
    items: 120,
  });

  it('passes every vector skill, in teaching order, breaking no rule', () => {
    expect(run.violations).toEqual([]);
    for (const { id } of SKILLS) expect(run.profile.skills[id]?.passed, id).toBe(true);
    expect(nextSkill(run.profile)).toBeNull();
    const firstSeen = [...new Set(run.steps.map(({ ref }) => ref.skill))];
    expect(firstSeen).toEqual(SKILLS.map(({ id }) => id));
  });

  it('only ever gets vector items, and no matrix skill is touched', () => {
    expect(run.steps.every(({ ref }) => ref.topic === 'vector')).toBe(true);
    expect(Object.keys(run.profile.skills).every((id) => id.startsWith('v_'))).toBe(true);
  });

  it('plays an intro once per unit and gets no remediation', () => {
    const intros = run.scenes.filter(({ request }) => request.kind === 'intro');
    expect(intros).toHaveLength(5);
    expect(run.scenes.every(({ request }) => ['intro', 'concept'].includes(request.kind))).toBe(
      true,
    );
  });
});

describe('buggy vector students are probed and can be fixed', () => {
  for (const { id, skills } of CATALOG) {
    const skill = skills[0];
    it(`${id} on ${skill}`, () => {
      let caught = 0;
      for (let seed = 0; seed < 6; seed += 1) {
        const { steps, violations, profile } = runStudent({
          id: `VB-${seed}`,
          student: buggy(id, 1, seed),
          units: MATRIX_UNITS,
          topic: 'vector',
          items: 160,
        });
        expect(violations).toEqual([]);
        const index = steps.findIndex(
          ({ outcome }) =>
            outcome.classification.type === 'misconception' && outcome.classification.id === id,
        );
        if (index < 0) continue;
        caught += 1;
        // A clip about it, then a probe of it, as R1 says.
        const { turn } = steps[index];
        expect(turn.candidates.some(({ scene }) => scene?.request.kind === 'remediate')).toBe(true);
        const probed = steps.slice(index + 1).some(({ ref }) => ref.target === id);
        expect(probed || turn.stuck).toBe(true);
        // Fixed after its clip, so the skill is passed in the end.
        expect(profile.skills[skill]?.passed, `${id} seed ${seed}`).toBe(true);
      }
      // V11, V15 and V16 show only at L3 (VECTORS §4.1), and a skill can be passed at L2 first.
      if (!probeLevels(skill, id).every((level) => level === 3)) {
        expect(caught).toBeGreaterThan(0);
      }
    });
  }
});

describe('the whole model on vectors under any answers', () => {
  it('never breaks a rule and never throws', () => {
    for (let seed = 0; seed < 8; seed += 1) {
      for (const student of [randomStudent(seed), planned(0.7, seed)]) {
        const { violations, steps } = runStudent({
          id: `VR-${seed}`,
          student,
          units: MATRIX_UNITS,
          topic: 'vector',
          items: 80,
        });
        expect(violations).toEqual([]);
        expect(steps.every(({ ref }) => packOfSkill(ref.skill).id === 'vector')).toBe(true);
      }
    }
  });

  it('an 85% student reaches mastery of the first unit', () => {
    const { profile } = runStudent({
      id: 'VM-1',
      student: planned(0.85, 3),
      units: MATRIX_UNITS,
      topic: 'vector',
      items: 200,
    });
    expect(profile.skills.v_quantity?.passed).toBe(true);
    expect(profile.skills.v_geom?.passed).toBe(true);
  });
});
