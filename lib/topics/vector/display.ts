import { thVector } from '@/lib/content/th.vector';
import { Rational } from '@/lib/core/rational';
import { surdText } from '@/lib/core/surd';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer } from '@/lib/core/types';
import type { WorkedLine } from '@/lib/topics/types';
import type { Given } from './format';
import { figureExpr, num, term } from './latex';
import type { PointLabel, Slot, VectorItem } from './types';
import type { Step } from './worked';

// How a vector item is shown on screen, worked out here so the components only place it. Every number
// is the engine's: the givens, the arrows over named vectors, and the words around an answer box.

const slot = (part: Slot): string => (typeof part === 'string' ? part : num(part));

const AXES = ['\\mathbf{i}', '\\mathbf{j}', '\\mathbf{k}'];

/** 2i − j + 3k with bold unit vectors, leaving out zero components and writing ±1 as a bare sign. */
function ijkLatex(parts: readonly Slot[]): string {
  const pieces = parts.flatMap((part, index) => {
    if (typeof part === 'string') return [{ negative: false, body: `${part}${AXES[index]}` }];
    if (part.isZero()) return [];
    const size = part.abs();
    const coeff = size.equals(Rational.ONE) ? '' : num(size);
    return [{ negative: part.sign() < 0, body: `${coeff}${AXES[index]}` }];
  });
  if (pieces.length === 0) return '\\mathbf{0}';
  return pieces
    .map(({ negative, body }, index) =>
      index === 0 ? `${negative ? '-' : ''}${body}` : `${negative ? '-' : '+'} ${body}`,
    )
    .join(' ');
}

/** A point as A(1, −2, 3), a vector as a column in square brackets or as ai + bj + ck. */
export function givenLatex({ label, kind, value, notation }: Given): string {
  if (kind === 'point') return `${label}\\left(${value.map(slot).join(', ')}\\right)`;
  if (notation === 'ijk') return `${label} = ${ijkLatex(value)}`;
  return `${label} = \\begin{bmatrix} ${value.map(slot).join(' \\\\ ')} \\end{bmatrix}`;
}

const FIGURE_KEY = /^(2|1\/2)?([A-DMN])([A-DMN])$/;
const SCALES: Record<string, Rational> = {
  '': Rational.ONE,
  '2': Rational.of(2),
  '1/2': Rational.of(1, 2),
};

/** A choice naming a vector of the figure, such as "1/2BC", with its arrow; null for any other choice. */
export function choiceLatex(labelKey: string): string | null {
  const match = FIGURE_KEY.exec(labelKey);
  if (!match) return null;
  const [, scale = '', from, to] = match;
  const k = SCALES[scale];
  const body = term({ k, from: from as PointLabel, to: to as PointLabel });
  return scale === '1/2' ? body.replace('\\frac{1}{2}', '\\tfrac{1}{2}') : body;
}

export type PromptPart = { text: string } | { latex: string };

/** The question in pieces: plain words, and the named vectors of a figure with arrows over them. */
export function promptParts({ prompt, data }: VectorItem): PromptPart[] {
  const latexOf: Record<string, string> = {};
  if (data.form === 'figure_equal') latexOf.v = term(data.of);
  if (data.form === 'figure_expr') latexOf.expr = figureExpr(data.expr);

  const template = thVector.prompts[prompt.key];
  const parts: PromptPart[] = [];
  let at = 0;
  for (const match of template.matchAll(/\{\{(\w+)\}\}/g)) {
    const [whole, name] = match;
    const before = template.slice(at, match.index);
    at = match.index + whole.length;
    if (latexOf[name]) {
      if (before) parts.push({ text: before });
      parts.push({ latex: latexOf[name] });
    } else {
      parts.push({ text: before + fillTokens(whole, prompt.params) });
    }
  }
  parts.push({ text: template.slice(at) });
  // Neighbouring words are one piece, so a screen reader reads them as one.
  return parts.reduce<PromptPart[]>((joined, part) => {
    const last = joined[joined.length - 1];
    if (last && 'text' in last && 'text' in part) last.text += part.text;
    else if (!('text' in part) || part.text) joined.push({ ...part });
    return joined;
  }, []);
}

export interface AnswerAffix {
  before?: string;
  after?: string;
}

/** θ = □ องศา on an angle item, k = □ where the item asks for an unknown. Null for the rest. */
export function answerAffix({ data }: Pick<VectorItem, 'data'>): AnswerAffix | null {
  const { answer } = thVector;
  switch (data.form) {
    case 'angle':
      return { before: answer.angle, after: answer.degrees };
    case 'parallel':
      return { before: fillTokens(answer.unknown, { x: data.ask }) };
    case 'perp':
    case 'perp_property':
      return { before: fillTokens(answer.unknown, { x: 'k' }) };
    default:
      return null;
  }
}

/**
 * The simplest form of a right answer typed some other way, such as 2√2 for √8 (VECTORS §3.3), or null
 * when every box already shows it.
 */
export function simplifiedForm(typed: readonly string[], answer: Answer): string | null {
  const parts =
    answer.kind === 'surd' ? [answer.value] : answer.kind === 'vector' ? answer.value : null;
  if (!parts || typed.length !== parts.length) return null;
  const shown = parts.map(surdText);
  const asShown = (text: string, i: number) =>
    text === parts[i].toString() || text.replace('-', '−') === shown[i];
  if (typed.every(asShown)) return null;
  return answer.kind === 'vector' ? `(${shown.join(', ')})` : shown[0];
}

/**
 * One worked step in words and a formula. A step with no formula that picks a choice names it, so a
 * solution never ends on "this one" without saying which.
 */
export function workedLine({ labelKey, params, latex, value }: Step): WorkedLine {
  const text = fillTokens(thVector.worked[labelKey], params);
  if (latex || value?.kind !== 'choice') return { text, latex };
  const label = thVector.choices[value.id as keyof typeof thVector.choices];
  const arrow = choiceLatex(value.id);
  return arrow ? { text, latex: arrow } : { text: label ? `${text}: ${label}` : text, latex };
}
