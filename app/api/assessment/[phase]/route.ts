import { restoreAnswer } from '@/lib/core/answerJson';
import type { Answer } from '@/lib/core/types';
import { applyPretest } from '@/lib/learner/profile';
import { signedInUserId, signInConfigured } from '@/lib/server/auth';
import { database } from '@/lib/server/db';
import { fail, notConfigured, ok, readJson, unauthorized } from '@/lib/server/http';
import { assessmentSubmit } from '@/lib/server/schemas';
import { createStore } from '@/lib/server/store';
import {
  testBlock,
  type AssessmentAnswer,
  type AssessmentForm,
  type AssessmentPhase,
  type AssessmentResult,
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

export async function GET(_request: Request, { params }: Params) {
  if (!signInConfigured()) return notConfigured();
  const userId = await signedInUserId();
  if (!userId) return unauthorized();

  const { phase } = await params;
  const store = createStore(await database());
  if (phase === 'status') return ok(await store.assessmentScores(userId));
  if (!PHASES.includes(phase)) return fail(404, 'no_such_test');

  const taken = phase as AssessmentPhase;
  const status = await store.assessmentScores(userId);
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
  if (!signInConfigured()) return notConfigured();
  const userId = await signedInUserId();
  if (!userId) return unauthorized();

  const { phase } = await params;
  if (!PHASES.includes(phase)) return fail(404, 'no_such_test');
  const taken = phase as AssessmentPhase;

  const parsed = assessmentSubmit.safeParse(await readJson(request));
  if (!parsed.success) return fail(400, 'bad_request');
  const answers = answersOf(parsed.data.answers as AssessmentAnswer[]);
  if (!answers) return fail(400, 'bad_request');

  const store = createStore(await database());
  const row = await store.loadLearner(userId);
  const blocked = testBlock(taken, row?.profile.itemsDone ?? 0);
  if (blocked) return fail(409, blocked);

  const form = formFor(userId, taken);
  const marked = markAssessment(form, answers);
  const { score, total } = scoreOf(marked);

  const given = new Map(parsed.data.answers.map((entry) => [entry.itemNo, entry]));
  const saved = await store.saveAssessment(userId, {
    phase: taken,
    form,
    score,
    total,
    startedAt: parsed.data.startedAt,
    responses: marked.map(({ itemNo, item, classification, correct }) => ({
      item_no: itemNo,
      item_ref: item.ref,
      answer: given.get(itemNo)?.answer ?? null,
      correct,
      misconception: classification?.type === 'misconception' ? classification.id : null,
      variant: classification?.type === 'misconception' ? (classification.variant ?? null) : null,
      time_ms: given.get(itemNo)?.timeMs ?? null,
    })),
  });
  if (!saved) return fail(409, 'already_taken');

  let profile: AssessmentResult['profile'] = null;
  if (taken === 'pre' && row) {
    const next = applyPretest(row.profile, pretestResults(marked), { at: parsed.data.startedAt });
    if (await store.saveLearner(userId, { profile: next, devices: row.devices }, row.rev)) {
      profile = next;
    }
  }
  return ok<AssessmentResult>({ score, total, profile });
}
