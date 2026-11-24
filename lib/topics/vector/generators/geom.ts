import type { Rng } from '@/lib/core/prng';
import { figureExprText, figureKey } from '../format';
import { solve } from '../solve';
import type { ItemBody, PointLabel, Probe, SkillGenerator, Term, VectorData } from '../types';
import {
  figureOptions,
  figureTerms,
  HALF,
  ONE,
  parallelogram,
  reversed,
  term,
  TWO,
  vertex,
  whole,
  wrongForm,
} from './sample';

/** L1: head to tail along the sides, AB + BC or AB + BC + CD. */
function chain(rng: Rng): VectorData {
  const figure = parallelogram(rng);
  const start = rng.int(0, 3);
  const step = rng.pick([1, -1]);
  const length = rng.pick([2, 3]);
  const path = Array.from({ length: length + 1 }, (_, i) => vertex(start, i * step));
  const expr = path.slice(0, -1).map((from, i) => whole(from, path[i + 1]));
  const answer = whole(path[0], path[length]);
  return {
    form: 'figure_expr',
    figure,
    expr,
    options: figureOptions(rng, figure, answer, reversed(answer), figureTerms(figure)),
  };
}

/** P with its neighbours Q (next) and R (previous) and the opposite vertex S. */
function corner(rng: Rng): { p: PointLabel; q: PointLabel; r: PointLabel; s: PointLabel } {
  const start = rng.int(0, 3);
  const step = rng.pick([1, -1]);
  return {
    p: vertex(start),
    q: vertex(start, step),
    r: vertex(start, -step),
    s: vertex(start, 2 * step),
  };
}

/** L2: two sides from one corner, PQ + PR = PS or PQ − PR = RQ. */
function fromCorner(rng: Rng, { target }: Probe): VectorData {
  const figure = parallelogram(rng);
  const { p, q, r, s } = corner(rng);
  const add =
    target === 'V04_GEOM_ADD_JOIN_TIPS'
      ? true
      : target === 'V03_GEOM_SUB_DIRECTION'
        ? false
        : rng.chance(1, 2);
  if (add) {
    // The lure joins the two tips, QR, which is what V04 draws.
    return {
      form: 'figure_expr',
      figure,
      expr: [whole(p, q), whole(p, r)],
      options: figureOptions(rng, figure, whole(p, s), whole(q, r), figureTerms(figure)),
    };
  }
  return {
    form: 'figure_expr',
    figure,
    expr: [whole(p, q), term(ONE.neg(), p, r)],
    options: figureOptions(rng, figure, whole(r, q), whole(q, r), figureTerms(figure)),
  };
}

/** L3: with M the midpoint of QS, PQ + ½QS = PM and differences that end at M. */
function withMidpoint(rng: Rng, { target }: Probe): VectorData {
  const { p, q, s } = corner(rng);
  const figure = parallelogram(rng, [q, s]);
  const minus = (from: PointLabel, to: PointLabel) => term(ONE.neg(), from, to);
  const templates: { expr: Term[]; answer: Term }[] = [
    { expr: [whole(p, q), term(HALF, q, s)], answer: whole(p, 'M') },
    { expr: [whole(p, 'M'), minus(p, q)], answer: whole(q, 'M') },
    { expr: [whole(p, s), minus(p, 'M')], answer: whole('M', s) },
    { expr: [whole(p, q), minus(p, 'M')], answer: whole('M', q) },
  ];
  const { expr, answer } = rng.pick(
    target === 'V03_GEOM_SUB_DIRECTION' ? templates.slice(1) : templates,
  );
  return {
    form: 'figure_expr',
    figure,
    expr,
    options: figureOptions(
      rng,
      figure,
      answer,
      reversed(answer),
      figureTerms(figure, [ONE, HALF, TWO]),
      // Halves and doubles of the sides at M look right and are not.
      [term(HALF, answer.to, answer.from), term(TWO, answer.from, answer.to)],
    ),
  };
}

export const geom: SkillGenerator = {
  sample(rng, level, probe) {
    if (level === 1) return chain(rng);
    return level === 2 ? fromCorner(rng, probe) : withMidpoint(rng, probe);
  },

  body(data): ItemBody {
    if (data.form !== 'figure_expr') throw wrongForm('v_geom', data.form);
    return {
      kind: 'choice',
      prompt: { key: 'figure_expr', params: { expr: figureExprText(data.expr) } },
      data,
      options: data.options.map((t) => ({ id: figureKey(t), labelKey: figureKey(t) })),
      correct: solve(data),
    };
  },
};
