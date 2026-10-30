import { th, type WorkedKey } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { MatrixItem } from '@/lib/topics/matrix/types';
import { hintStep, workedSteps } from '@/lib/topics/matrix/worked';
import type { Profile } from './types';

export interface Hint {
  level: 1 | 2 | 3;
  text: string;
  /** Only hint L3 shows a worked step. */
  latex?: string;
}

const FIRST_STEP_WORDING: Partial<Record<WorkedKey, string>> = th.hintFirstStep;

/** SPEC §9, L2: a misconception this student showed and this item can test, else the first step. */
function pointingHint(item: MatrixItem, caught: Profile['caught']): string {
  const known = item.diagnostics.find(({ id }) => (caught[id] ?? 0) > 0);
  if (known) return th.hints[known.id];
  const [{ labelKey, params }] = workedSteps(item);
  return fillTokens(FIRST_STEP_WORDING[labelKey] ?? th.worked[labelKey], params);
}

/** The hint at one level of the ladder (SPEC §9). All wording comes from th.ts, never an LLM. */
export function hintAt(item: MatrixItem, level: Hint['level'], caught: Profile['caught']): Hint {
  if (level === 1) return { level, text: th.hintL1[item.data.form] };
  if (level === 2) return { level, text: pointingHint(item, caught) };
  const { labelKey, params, latex } = hintStep(item);
  return { level, text: fillTokens(th.worked[labelKey], params), latex };
}
