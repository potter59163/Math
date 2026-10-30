import { describe, expect, it } from 'vitest';
import { parseAnswer, parseNumber } from './parse';
import { Rational } from './rational';

describe('parseNumber', () => {
  it.each([
    ['-3', '-3'],
    ['3', '3'],
    ['-3/2', '-3/2'],
    ['2/4', '1/2'],
    ['0.5', '1/2'],
    ['-1.25', '-5/4'],
    ['1.50', '3/2'],
    ['.5', '1/2'],
    ['-.5', '-1/2'],
    ['−3', '-3'],
    ['–3', '-3'],
    ['−3/2', '-3/2'],
    ['๓', '3'],
    ['-๓/๒', '-3/2'],
    ['๐.๕', '1/2'],
    ['๑๒', '12'],
    [' 7 ', '7'],
    ['1 / 2', '1/2'],
    ['- 3', '-3'],
    ['3/-2', '-3/2'],
    ['0', '0'],
    ['-0', '0'],
    ['0/5', '0'],
    ['007', '7'],
  ])('accepts %j as %s', (raw, expected) => {
    const result = parseNumber(raw);
    expect(result).toEqual({ ok: true, value: Rational.parse(expected) });
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    // Mixed numbers must not collapse into another number when spaces are stripped.
    ['1 1/2', 'invalid'],
    ['๑ ๑/๒', 'invalid'],
    ['-1 1/2', 'invalid'],
    ['1 2', 'invalid'],
    ['1. 5', 'invalid'],
    // Repeating decimals have no exact typed form.
    ['0.333...', 'invalid'],
    ['0.(3)', 'invalid'],
    ['1.2.3', 'invalid'],
    ['1/2/3', 'invalid'],
    ['0.5/2', 'invalid'],
    ['abc', 'invalid'],
    ['--3', 'invalid'],
    ['+3', 'invalid'],
    ['1/', 'invalid'],
    ['/2', 'invalid'],
    ['.', 'invalid'],
    ['-', 'invalid'],
    ['1.', 'invalid'],
    ['1e3', 'invalid'],
    ['5/0', 'zero_denominator'],
    ['5/-0', 'zero_denominator'],
    ['1000000001', 'too_large'],
    ['12345678901234567890', 'too_large'],
    ['0.00000000001', 'too_large'],
    ['1/12345678901234567890', 'too_large'],
  ])('rejects %j as %s', (raw, reason) => {
    expect(parseNumber(raw)).toEqual({ ok: false, reason });
  });

  it('counts an unreduced fraction as the same number', () => {
    const a = parseNumber('2/4');
    const b = parseNumber('1/2');
    expect(a).toEqual(b);
  });
});

describe('parseAnswer', () => {
  const n = (text: string) => Rational.parse(text);

  it('parses every cell of a matrix', () => {
    expect(
      parseAnswer('matrix', {
        type: 'matrix',
        cells: [
          ['1', '-1/2'],
          ['๓', '0.5'],
        ],
      }),
    ).toEqual({
      ok: true,
      value: {
        kind: 'matrix',
        value: [
          [n('1'), n('-1/2')],
          [n('3'), n('1/2')],
        ],
      },
    });
  });

  it('reports the 1-based cell that failed', () => {
    expect(
      parseAnswer('matrix', {
        type: 'matrix',
        cells: [
          ['1', '2'],
          ['', '4'],
        ],
      }),
    ).toEqual({ ok: false, reason: 'empty', cell: [2, 1] });
    expect(parseAnswer('matrix', { type: 'matrix', cells: [['1 1/2']] })).toEqual({
      ok: false,
      reason: 'invalid',
      cell: [1, 1],
    });
  });

  it('rejects jagged or empty matrices', () => {
    expect(parseAnswer('matrix', { type: 'matrix', cells: [['1', '2'], ['3']] })).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(parseAnswer('matrix', { type: 'matrix', cells: [] })).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('accepts "undefined" only for kinds that offer the button', () => {
    expect(parseAnswer('matrix_or_undefined', { type: 'undefined' })).toEqual({
      ok: true,
      value: { kind: 'undefined' },
    });
    expect(parseAnswer('dims_or_undefined', { type: 'undefined' })).toEqual({
      ok: true,
      value: { kind: 'undefined' },
    });
    for (const kind of ['matrix', 'scalar', 'cell', 'dims', 'choice'] as const) {
      expect(parseAnswer(kind, { type: 'undefined' })).toEqual({ ok: false, reason: 'wrong_kind' });
    }
  });

  it('parses scalar and cell answers as numbers', () => {
    for (const kind of ['scalar', 'cell'] as const) {
      expect(parseAnswer(kind, { type: 'number', text: '-3/2' })).toEqual({
        ok: true,
        value: { kind: 'scalar', value: n('-3/2') },
      });
    }
    expect(parseAnswer('scalar', { type: 'number', text: '' })).toEqual({
      ok: false,
      reason: 'empty',
    });
  });

  it('parses dims as positive integers, including Thai digits', () => {
    expect(parseAnswer('dims', { type: 'dims', rows: '2', cols: '๓' })).toEqual({
      ok: true,
      value: { kind: 'dims', rows: 2, cols: 3 },
    });
    expect(parseAnswer('dims_or_undefined', { type: 'dims', rows: '4', cols: '1' })).toEqual({
      ok: true,
      value: { kind: 'dims', rows: 4, cols: 1 },
    });
  });

  it.each([
    ['0', '3', 'invalid'],
    ['2.5', '3', 'invalid'],
    ['-2', '3', 'invalid'],
    ['2/1', '3', 'invalid'],
    ['', '3', 'empty'],
    ['2', ' ', 'empty'],
  ])('rejects dims %j × %j', (rows, cols, reason) => {
    expect(parseAnswer('dims', { type: 'dims', rows, cols })).toEqual({ ok: false, reason });
  });

  it('passes choice ids through', () => {
    expect(parseAnswer('choice', { type: 'choice', id: 'has_inverse' })).toEqual({
      ok: true,
      value: { kind: 'choice', id: 'has_inverse' },
    });
  });

  it('rejects an answer shape that does not fit the item kind', () => {
    expect(parseAnswer('matrix', { type: 'number', text: '3' })).toEqual({
      ok: false,
      reason: 'wrong_kind',
    });
    expect(parseAnswer('scalar', { type: 'choice', id: 'x' })).toEqual({
      ok: false,
      reason: 'wrong_kind',
    });
    expect(parseAnswer('choice', { type: 'dims', rows: '1', cols: '1' })).toEqual({
      ok: false,
      reason: 'wrong_kind',
    });
  });
});
