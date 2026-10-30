import { describe, expect, it } from 'vitest';
import { fillTokens, tokensIn } from './tokens';

describe('fillTokens', () => {
  it('replaces every {{token}}', () => {
    expect(
      fillTokens('A มีมิติ {{dimsA}} และ B มีมิติ {{dimsB}}', { dimsA: '2×3', dimsB: '3×4' }),
    ).toBe('A มีมิติ 2×3 และ B มีมิติ 3×4');
  });

  it('replaces a repeated token each time', () => {
    expect(fillTokens('{{n}}×{{n}}', { n: '3' })).toBe('3×3');
  });

  it('leaves text without tokens alone', () => {
    expect(fillTokens('จงหา AB')).toBe('จงหา AB');
  });

  it('throws when a token has no value, so a missing number cannot reach a student', () => {
    expect(() => fillTokens('จงหา {{k}}A', {})).toThrow(/k/);
  });
});

describe('tokensIn', () => {
  it('lists tokens once each', () => {
    expect(tokensIn('{{n}}×{{n}} และ {{k}}')).toEqual(['n', 'k']);
    expect(tokensIn('ไม่มี')).toEqual([]);
  });
});
