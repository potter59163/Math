import { countDiffCells, diagnosticsCollide, matchesDiagnostic } from './classify';
import type { Answer, DiagnosticAnswer, Item } from './types';

export interface ValidationFailure {
  /** Rule number in MISCONCEPTIONS §2, or 0 for a malformed item. */
  rule: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  detail: string;
}

export type ValidationResult = { ok: true } | { ok: false; failure: ValidationFailure };

/** Rules 5 and 6 depend on the topic, so each topic supplies its own. */
export type TopicRules = (item: Item) => ValidationFailure | null;

function label(diagnostic: { id: string; variant?: string }): string {
  return diagnostic.variant === undefined
    ? diagnostic.id
    : `${diagnostic.id}:${diagnostic.variant}`;
}

function checkOptions(item: Item): ValidationFailure | null {
  if (item.kind !== 'choice') return null;
  const ids = new Set(item.options?.map((option) => option.id) ?? []);
  const answers: DiagnosticAnswer[] = [item.correct, ...item.diagnostics.map((d) => d.answer)];
  for (const answer of answers) {
    if (answer.kind !== 'choice' || !ids.has(answer.id)) {
      return { rule: 0, detail: 'choice answers must be listed in options' };
    }
  }
  return null;
}

function checkTarget(item: Item): ValidationFailure | null {
  const { target, targetVariant } = item.ref;
  if (target === undefined) return null;
  const first = item.diagnostics[0];
  if (first?.id !== target) {
    return { rule: 4, detail: `target ${target} has no diagnostic listed first` };
  }
  if (targetVariant !== undefined && first.variant !== targetVariant) {
    return { rule: 4, detail: `target variant ${targetVariant} has no diagnostic listed first` };
  }
  return null;
}

function checkDiagnosticAgainstCorrect(
  answer: DiagnosticAnswer,
  correct: Answer,
  name: string,
): ValidationFailure | null {
  if (matchesDiagnostic(answer, correct)) {
    return { rule: 1, detail: `${name} equals the correct answer` };
  }
  if (answer.kind === 'matrix' && correct.kind === 'matrix') {
    const distance = countDiffCells(answer.value, correct.value);
    if (distance !== null && distance < 2) {
      return { rule: 3, detail: `${name} is ${distance} cell away from the correct answer` };
    }
  }
  return null;
}

/** Rules 1–4 of MISCONCEPTIONS §2, then the topic's rules. */
export function validateItem(item: Item, topicRules?: TopicRules): ValidationResult {
  const failure = (): ValidationFailure | null => {
    const options = checkOptions(item);
    if (options) return options;

    for (const diagnostic of item.diagnostics) {
      const problem = checkDiagnosticAgainstCorrect(
        diagnostic.answer,
        item.correct,
        label(diagnostic),
      );
      if (problem) return problem;
    }

    for (let i = 0; i < item.diagnostics.length; i += 1) {
      for (let j = i + 1; j < item.diagnostics.length; j += 1) {
        const [a, b] = [item.diagnostics[i], item.diagnostics[j]];
        if (diagnosticsCollide(a.answer, b.answer)) {
          return { rule: 2, detail: `${label(a)} collides with ${label(b)}` };
        }
      }
    }

    return checkTarget(item) ?? topicRules?.(item) ?? null;
  };

  const found = failure();
  return found ? { ok: false, failure: found } : { ok: true };
}
