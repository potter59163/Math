import { describe, expect, it, vi } from 'vitest';

// Vectors are switched on for this file only, as NEXT_PUBLIC_TOPICS=matrix,vector will do in production.
// The route runs as on the server, for one signed-in student whose row is kept in memory.
const server = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_TOPICS = 'matrix,vector';
  return {
    row: null as LearnerRow | null,
    saved: [] as NewAssessment[],
    scoresAsked: [] as string[],
  };
});

vi.mock('@/lib/server/auth', () => ({
  signInConfigured: () => true,
  signedInUserId: async () => 'student-1',
}));
vi.mock('@/lib/server/db', () => ({ database: async () => ({}) }));
vi.mock('@/lib/server/store', () => ({
  createStore: () => ({
    loadLearner: async () => server.row,
    saveLearner: async () => true,
    saveAssessment: async (_userId: string, assessment: NewAssessment) => {
      server.saved.push(assessment);
      return true;
    },
    assessmentScores: async (_userId: string, topic?: string) => {
      server.scoresAsked.push(topic ?? 'matrix');
      return { pre: null, post: null };
    },
  }),
}));

import { CONFIG } from '@/lib/config';
import { newProfile } from '@/lib/director/turn';
import type { Profile } from '@/lib/director/types';
import { applyAttempt } from '@/lib/learner/profile';
import type { NewAssessment } from '@/lib/server/store';
import type { LearnerRow } from '@/lib/server/sync';
import type { AssessmentPhase } from '@/lib/sync/assessment';
import { packOfSkill, type SkillId } from '@/lib/topics';
import { GET, POST } from './route';

const AT = 1_800_000_000_000;

const student = () =>
  newProfile({ id: 'student-1', units: [1, 2, 3, 4, 5], activeTopic: 'vector' });

/** `times` new items of one skill, each answered right and recorded by the learner model. */
function practise(profile: Profile, skill: SkillId, times: number): Profile {
  let next = profile;
  for (let n = 0; n < times; n += 1) {
    const item = packOfSkill(skill).generate({ skill, difficulty: 1, seed: 100 + next.itemsDone });
    ({ profile: next } = applyAttempt(next, {
      item,
      answer: item.correct,
      hintLevel: 0,
      timeMs: 5000,
      at: AT + next.itemsDone * 60_000,
    }));
  }
  return next;
}

/** Sends a test with every item skipped, which is enough to see whether the gate lets it in. */
async function submit(phase: AssessmentPhase, profile: Profile, topic?: string) {
  server.row = { profile, rev: 0, devices: {}, condition: 'adaptive' };
  server.saved = [];
  const query = topic ? `?topic=${topic}` : '';
  const response = await POST(
    new Request(`http://localhost/api/assessment/${phase}${query}`, {
      method: 'POST',
      body: JSON.stringify({ startedAt: AT, answers: [] }),
    }),
    { params: Promise.resolve({ phase }) },
  );
  return { status: response.status, body: await response.json(), saved: server.saved };
}

describe('POST /api/assessment/[phase] with vectors switched on', () => {
  it('takes the matrix pre-test after vector practice alone, and keeps that practice', async () => {
    const practised = practise(student(), 'v_quantity', CONFIG.postTestAfterItems);
    const { status, body, saved } = await submit('pre', practised);
    expect(status).toBe(200);
    expect(saved.map(({ phase }) => phase)).toEqual(['pre']);
    expect(body.profile.itemsDone).toBe(CONFIG.postTestAfterItems);
    expect(body.profile.skills.v_quantity).toEqual(practised.skills.v_quantity);
  });

  it('refuses the matrix post-test after vector practice alone', async () => {
    const practised = practise(student(), 'v_quantity', CONFIG.postTestAfterItems);
    const { status, body, saved } = await submit('post', practised);
    expect(status).toBe(409);
    expect(body).toEqual({ error: 'too_early' });
    expect(saved).toEqual([]);
  });

  it('counts only the matrix items of mixed practice', async () => {
    const mixed = practise(practise(student(), 'dim', 3), 'v_quantity', 7);
    expect(await submit('pre', mixed)).toMatchObject({
      status: 409,
      body: { error: 'already_learning' },
    });
    expect(await submit('post', mixed)).toMatchObject({
      status: 409,
      body: { error: 'too_early' },
    });

    const enough = practise(mixed, 'dim', CONFIG.postTestAfterItems - 3);
    const { status, saved } = await submit('post', enough);
    expect(status).toBe(200);
    expect(saved.map(({ phase }) => phase)).toEqual(['post']);
  });
});

describe('the vector tests', () => {
  it('takes the vector pre-test after matrix practice, and leaves the matrix skills as they were', async () => {
    const practised = practise(student(), 'dim', 3);
    const { status, body, saved } = await submit('pre', practised, 'vector');
    expect(status).toBe(200);
    expect(saved.map(({ topic, phase }) => [topic, phase])).toEqual([['vector', 'pre']]);
    expect(saved[0].responses).toHaveLength(14);
    expect(
      saved[0].responses.every(
        ({ item_ref }) => (item_ref as { topic: string }).topic === 'vector',
      ),
    ).toBe(true);
    expect(body.profile.skills.dim).toEqual(practised.skills.dim);
  });

  it('saves the matrix test as the matrix one, at the address it always had', async () => {
    const { saved } = await submit('pre', student());
    expect(saved.map(({ topic, phase }) => [topic, phase])).toEqual([['matrix', 'pre']]);
  });

  it('refuses the vector pre-test after one vector item', async () => {
    const practised = practise(student(), 'v_quantity', 1);
    expect(await submit('pre', practised, 'vector')).toMatchObject({
      status: 409,
      body: { error: 'already_learning' },
      saved: [],
    });
  });

  it('opens the vector post-test after ten vector items, whatever the matrix practice', async () => {
    const matrixOnly = practise(student(), 'dim', CONFIG.postTestAfterItems);
    expect(await submit('post', matrixOnly, 'vector')).toMatchObject({
      status: 409,
      body: { error: 'too_early' },
    });
    const both = practise(matrixOnly, 'v_quantity', CONFIG.postTestAfterItems);
    const { status, saved } = await submit('post', both, 'vector');
    expect(status).toBe(200);
    expect(saved.map(({ topic, phase }) => [topic, phase])).toEqual([['vector', 'post']]);
  });

  it('knows no other topic', async () => {
    expect(await submit('pre', student(), 'physics')).toMatchObject({
      status: 404,
      body: { error: 'no_such_test' },
    });
  });

  it('serves the vector form and the vector scores when asked for them', async () => {
    const get = (path: string, phase: string) =>
      GET(new Request(`http://localhost${path}`), { params: Promise.resolve({ phase }) });
    const form = await (await get('/api/assessment/pre?topic=vector', 'pre')).json();
    expect(form.refs).toHaveLength(14);
    expect(form.refs.every(({ topic }: { topic: string }) => topic === 'vector')).toBe(true);

    server.scoresAsked = [];
    await get('/api/assessment/status?topic=vector', 'status');
    await get('/api/assessment/status', 'status');
    expect(server.scoresAsked).toEqual(['vector', 'matrix']);
    expect((await get('/api/assessment/status?topic=physics', 'status')).status).toBe(404);
  });
});
