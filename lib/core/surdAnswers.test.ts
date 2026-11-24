import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { restoreAnswer, storeAnswer } from './answerJson';
import { classify } from './classify';
import { parseAnswer, parseSurd } from './parse';
import { Rational } from './rational';
import { Surd } from './surd';
import type { Answer, Diagnostic, Item } from './types';
import { validateItem } from './validate';

// The √ answer kinds of docs/VECTORS.md §3.3–3.4: parsing, storing, classifying and validating.

const s = (text: string) => Surd.parse(text);
const vec = (...parts: string[]): Answer => ({ kind: 'vector', value: parts.map(s) });

describe('parseSurd', () => {
  it.each([
    ['3√2', '3√2'],
    ['-3√2', '-3√2'],
    ['−3√2', '-3√2'],
    ['√2', '√2'],
    ['-√2', '-√2'],
    ['3√2/2', '3/2√2'],
    ['-√3/2', '-1/2√3'],
    ['3/2√2', '3/2√2'],
    ['1/√2', '1/2√2'],
    ['-6/√3', '-2√3'],
    ['√8', '2√2'],
    ['√9', '3'],
    ['2/4', '1/2'],
    ['-1.25', '-5/4'],
    ['๓√๒', '3√2'],
    ['0√5', '0'],
  ])('reads %s as %s', (raw, canonical) => {
    const parsed = parseSurd(raw);
    expect(parsed.ok && parsed.value.toString()).toBe(canonical);
  });

  it.each([
    ['', 'empty'],
    ['√', 'invalid'],
    ['3√', 'invalid'],
    ['√0', 'invalid'],
    ['√-2', 'invalid'],
    ['1.5√2', 'invalid'],
    ['√2√3', 'invalid'],
    ['3√2/0', 'zero_denominator'],
    ['3/2√2/2', 'invalid'],
    ['3 √2', 'invalid'],
    ['√1234567890123456', 'too_large'],
  ])('rejects %j (%s)', (raw, reason) => {
    const parsed = parseSurd(raw);
    expect(parsed.ok ? 'ok' : parsed.reason).toBe(reason);
  });

  it('reads back every value it prints', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -40, max: 40 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 200 }),
        (n, d, r) => {
          const value = Surd.of(Rational.of(n, d), r);
          const parsed = parseSurd(value.toString());
          expect(parsed.ok && parsed.value.equals(value)).toBe(true);
        },
      ),
      { numRuns: 1000 },
    );
  });
});

describe('parseAnswer for √ kinds', () => {
  it('gives a surd answer for a surd item, even for a rational', () => {
    const parsed = parseAnswer('surd', { type: 'number', text: '18' });
    expect(parsed).toEqual({ ok: true, value: { kind: 'surd', value: Surd.rational(18) } });
  });

  it('gives a vector answer, and names the component that failed', () => {
    const parsed = parseAnswer('vector', { type: 'vector', cells: ['1', '√2', '-3/2'] });
    expect(parsed.ok && parsed.value).toEqual(vec('1', '√2', '-3/2'));
    const bad = parseAnswer('vector', { type: 'vector', cells: ['1', '√', '2'] });
    expect(bad).toEqual({ ok: false, reason: 'invalid', cell: [2, 1] });
  });

  it('refuses the wrong raw shape', () => {
    expect(parseAnswer('vector', { type: 'number', text: '1' }).ok).toBe(false);
    expect(parseAnswer('surd', { type: 'vector', cells: ['1'] }).ok).toBe(false);
    expect(parseAnswer('surd', { type: 'undefined' }).ok).toBe(false);
  });

  it('leaves √ out of a scalar item', () => {
    expect(parseAnswer('scalar', { type: 'number', text: '3√2' }).ok).toBe(false);
  });
});

describe('storeAnswer / restoreAnswer for √ kinds', () => {
  it('survives JSON', () => {
    for (const answer of [
      { kind: 'surd', value: s('-3/2√5') } as Answer,
      vec('1/3', '-1/6√6', '0'),
    ]) {
      const stored = JSON.parse(JSON.stringify(storeAnswer(answer)));
      expect(restoreAnswer(stored)).toEqual(answer);
    }
  });
});

function vectorItem(correct: Answer, diagnostics: Diagnostic[] = []): Item {
  return {
    ref: { topic: 'test', skill: 'v', difficulty: 1, seed: 1, gv: 1 },
    kind: 'vector',
    prompt: { key: 'x' },
    data: null,
    grid: { rows: 3, cols: 1 },
    correct,
    diagnostics,
  };
}

describe('classify for √ kinds', () => {
  const item = vectorItem(vec('-10', '7', '9'), [
    { id: 'V20', answer: vec('-10', '-7', '9'), oneOff: true },
    { id: 'V21', answer: vec('10', '-7', '-9') },
  ]);

  it('finds the right answer, misconceptions, slips and shape errors', () => {
    expect(classify(item, vec('-10', '7', '9'))).toEqual({ type: 'correct' });
    expect(classify(item, vec('-10', '-7', '9'))).toEqual({ type: 'misconception', id: 'V20' });
    expect(classify(item, vec('10', '-7', '-9'))).toEqual({ type: 'misconception', id: 'V21' });
    expect(classify(item, vec('-10', '7', '8'))).toEqual({ type: 'slip', cell: [3, 1] });
    expect(classify(item, vec('-10', '7'))).toEqual({ type: 'shape_error' });
    expect(classify(item, vec('1', '2', '3'))).toEqual({ type: 'unknown' });
  });

  it('compares surds by value', () => {
    const surdItem: Item = { ...vectorItem({ kind: 'surd', value: s('3√2') }), kind: 'surd' };
    const typed = parseAnswer('surd', { type: 'number', text: '√18' });
    expect(typed.ok && classify(surdItem, typed.value)).toEqual({ type: 'correct' });
    expect(classify(surdItem, { kind: 'surd', value: s('18') })).toEqual({ type: 'unknown' });
  });
});

describe('validateItem rule 3 for vectors', () => {
  const correct = vec('-10', '7', '9');
  const ruleOf = (item: Item) => {
    const result = validateItem(item);
    return result.ok ? null : result.failure.rule;
  };

  it('rejects a diagnostic one component away', () => {
    expect(ruleOf(vectorItem(correct, [{ id: 'V20', answer: vec('-10', '-7', '9') }]))).toBe(3);
  });

  it('lets a declared one-off diagnostic through, but never one equal to the answer', () => {
    const oneOff = vectorItem(correct, [
      { id: 'V20', answer: vec('-10', '-7', '9'), oneOff: true },
    ]);
    expect(ruleOf(oneOff)).toBeNull();
    const same = vectorItem(correct, [{ id: 'V20', answer: vec('-10', '7', '9'), oneOff: true }]);
    expect(ruleOf(same)).toBe(1);
  });

  it('accepts diagnostics two or more components away', () => {
    expect(ruleOf(vectorItem(correct, [{ id: 'V21', answer: vec('10', '-7', '-9') }]))).toBeNull();
  });
});
