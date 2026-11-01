import { describe, expect, it } from 'vitest';
import { ALL_UNITS } from '@/lib/learner/progress';
import { parseJoin, parseUnits } from './join';

describe('parseJoin', () => {
  const form = { code: 'abc123', seat: '12', nickname: '' };

  it('normalizes the class code and builds the student id', () => {
    expect(parseJoin({ ...form, code: ' abc123 ' }, null)).toEqual({
      ok: true,
      student: { id: 'ABC123-12', classCode: 'ABC123', seatNo: 12, units: [...ALL_UNITS] },
    });
  });

  it('keeps a nickname, trimmed', () => {
    const result = parseJoin({ ...form, nickname: '  มิว ' }, null);
    expect(result.ok && result.student.nickname).toBe('มิว');
  });

  it('accepts Thai digits in the seat number', () => {
    const result = parseJoin({ ...form, seat: '๑๒' }, null);
    expect(result.ok && result.student.seatNo).toBe(12);
  });

  it('uses the open units when given', () => {
    const result = parseJoin(form, [3]);
    expect(result.ok && result.student.units).toEqual([3]);
  });

  it.each(['', 'abc12', 'abc1234', 'abc 12', 'กขค123'])('rejects the class code %j', (code) => {
    expect(parseJoin({ ...form, code }, null)).toEqual({ ok: false, errors: { code: 'invalid' } });
  });

  it.each(['', '0', '100', '1.5', '-3', 'abc'])('rejects the seat number %j', (seat) => {
    expect(parseJoin({ ...form, seat }, null)).toEqual({ ok: false, errors: { seat: 'invalid' } });
  });

  it('rejects a nickname over 20 code units', () => {
    expect(parseJoin({ ...form, nickname: 'ก'.repeat(21) }, null)).toEqual({
      ok: false,
      errors: { nickname: 'too_long' },
    });
  });

  it('reports every problem at once', () => {
    expect(parseJoin({ code: '', seat: '', nickname: '' }, null)).toEqual({
      ok: false,
      errors: { code: 'invalid', seat: 'invalid' },
    });
  });
});

describe('parseUnits', () => {
  it('reads one unit or a list', () => {
    expect(parseUnits('3')).toEqual([3]);
    expect(parseUnits('3,4')).toEqual([3, 4]);
    expect(parseUnits('5,3')).toEqual([3, 5]);
    expect(parseUnits('3,3')).toEqual([3]);
  });

  it('returns null for anything else, which means no setting', () => {
    expect(parseUnits(null)).toBeNull();
    expect(parseUnits('')).toBeNull();
    expect(parseUnits('6')).toBeNull();
    expect(parseUnits('3,x')).toBeNull();
    expect(parseUnits('abc')).toBeNull();
  });
});
