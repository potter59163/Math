import { th, type WorkedKey } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { MatrixItem, MisconceptionId } from '@/lib/topics/matrix/types';
import { hintStep, workedSteps } from '@/lib/topics/matrix/worked';

export interface Hint {
  level: 1 | 2 | 3;
  text: string;
  /** Only hint L3 shows a worked step. */
  latex?: string;
}

const FIRST_STEP_WORDING: Partial<Record<WorkedKey, string>> = th.hintFirstStep;

/** SPEC §9, L2: an open misconception (§7.2) this item can test, else the first step. */
function pointingHint(item: MatrixItem, open: readonly MisconceptionId[]): string {
  const known = item.diagnostics.find(({ id }) => open.includes(id));
  if (known) return th.hints[known.id];
  const [{ labelKey, params }] = workedSteps(item);
  return fillTokens(FIRST_STEP_WORDING[labelKey] ?? th.worked[labelKey], params);
}

/**
 * The hint at one level of the ladder (SPEC §9). All wording comes from th.ts, never an LLM. `open` is
 * the suspected and active misconceptions.
 */
export function hintAt(
  item: MatrixItem,
  level: Hint['level'],
  open: readonly MisconceptionId[],
): Hint {
  if (level === 1) return { level, text: th.hintL1[item.data.form] };
  if (level === 2) return { level, text: pointingHint(item, open) };
  const { labelKey, params, latex } = hintStep(item);
  return { level, text: fillTokens(th.worked[labelKey], params), latex };
}
