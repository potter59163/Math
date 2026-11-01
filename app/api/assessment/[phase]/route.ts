import { restoreAnswer } from '@/lib/core/answerJson';
import type { Answer } from '@/lib/core/types';
import { applyPretest } from '@/lib/learner/profile';
import { fail, notConfigured, ok, readJson, unauthorized } from '@/lib/server/http';
import { assessmentSubmit } from '@/lib/server/schemas';
import { createStore } from '@/lib/server/store';
import { adminClient, signedInUserId, supabaseConfigured } from '@/lib/server/supabase';
import {
  testBlock,
  type AssessmentAnswer,
  type AssessmentForm,
  type AssessmentPhase,
  type AssessmentResult,
  type AssessmentScore,
  type AssessmentStatus,
} from '@/lib/sync/assessment';
import {
  assessmentForm,
  formFor,
  markAssessment,
  pretestResults,
  scoreOf,
} from '@/lib/topics/matrix/assessment';

const PHASES: readonly string[] = ['pre', 'post'];

type Params = { params: Promise<{ phase: string }> };

async function scores(userId: string): Promise<AssessmentStatus> {
  const { data, error } = await adminClient()
    .from('assessments')
    .select('phase, score, total')
    .eq('user_id', userId);
  if (error) throw new Error(`scores: ${error.message}`);
  const of = (phase: AssessmentPhase): AssessmentScore | null => {
    const row = data.find((entry) => entry.phase === phase);
    return row ? { score: row.score as number, total: row.total as number } : null;
  };
  return { pre: of('pre'), post: of('post') };
}

export async function GET(_request: Request, { params }: Params) {
  if (!supabaseConfigured()) return notConfigured();
  const userId = await signedInUserId();
  if (!userId) return unauthorized();

  const { phase } = await params;
  if (phase === 'status') return ok(await scores(userId));
  if (!PHASES.includes(phase)) return fail(404, 'no_such_test');

  const taken = phase as AssessmentPhase;
  const status = await scores(userId);
  return ok<AssessmentForm>({
    phase: taken,
    refs: assessmentForm(formFor(userId, taken)).map(({ ref }) => ref),
    done: status[taken],
  });
}

function answersOf(answers: readonly AssessmentAnswer[]): Map<number, Answer | null> | null {
  try {
    return new Map(
      answers.map(({ itemNo, answer }) => [itemNo, answer ? restoreAnswer(answer) : null]),
    );
  } catch {
    return null;
  }
}

/** Marked here, from the same fixed form, whatever the browser thought of its own answers. */
export async function POST(request: Request, { params }: Params) {
  if (!supabaseConfigured()) return notConfigured();
  const userId = await signedInUserId();
  if (!userId) return unauthorized();

  const { phase } = await params;
  if (!PHASES.includes(phase)) return fail(404, 'no_such_test');
  const taken = phase as AssessmentPhase;

  const parsed = assessmentSubmit.safeParse(await readJson(request));
  if (!parsed.success) return fail(400, 'bad_request');
  const answers = answersOf(parsed.data.answers as AssessmentAnswer[]);
  if (!answers) return fail(400, 'bad_request');

  const client = adminClient();
  const store = createStore(client);
  const row = await store.loadLearner(userId);
  const blocked = testBlock(taken, row?.profile.itemsDone ?? 0);
  if (blocked) return fail(409, blocked);

  const form = formFor(userId, taken);
  const marked = markAssessment(form, answers);
  const { score, total } = scoreOf(marked);

  const { data: created, error } = await client
    .from('assessments')
    .insert({
      user_id: userId,
      phase: taken,
      form,
      score,
      total,
      started_at: new Date(parsed.data.startedAt).toISOString(),
    })
    .select('id')
    .single();
  // The one row each student may have for a phase: a second submit is not a second chance.
  if (error) return fail(409, 'already_taken');

  const times = new Map(parsed.data.answers.map(({ itemNo, timeMs }) => [itemNo, timeMs]));
  const responses = await client.from('assessment_responses').insert(
    marked.map(({ itemNo, item, classification, correct }) => ({
      assessment_id: created.id,
      item_no: itemNo,
      item_ref: item.ref,
      answer: parsed.data.answers.find((entry) => entry.itemNo === itemNo)?.answer ?? null,
      correct,
      misconception: classification?.type === 'misconception' ? classification.id : null,
      variant: classification?.type === 'misconception' ? (classification.variant ?? null) : null,
      time_ms: times.get(itemNo) ?? null,
    })),
  );
  if (responses.error) console.error(`assessment: ${responses.error.message}`);

  const profileColumn = { [`form_${taken}`]: form };
  const noted = await client.from('profiles').update(profileColumn).eq('id', userId);
  if (noted.error) console.error(`assessment: ${noted.error.message}`);

  let profile: AssessmentResult['profile'] = null;
  if (taken === 'pre' && row) {
    const next = applyPretest(row.profile, pretestResults(marked), { at: parsed.data.startedAt });
    if (await store.saveLearner(userId, { profile: next, devices: row.devices }, row.rev)) {
      profile = next;
    }
  }
  return ok<AssessmentResult>({ score, total, profile });
}
