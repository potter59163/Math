import { describe, expect, it } from 'vitest';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import { packOf } from '@/lib/topics';
import { unitName, unitPassedName } from './unitText';

const BOTH = ['matrix', 'vector'];

describe('unit names a student reads', () => {
  it('counts a unit within its own topic, never by its id or its code', () => {
    expect(unitName(3)).toBe(fillTokens(th.learn.unit, { n: '3' }));
    expect(unitName(11)).toBe(fillTokens(th.learn.unit, { n: '1' }));
    expect(unitName(15)).toBe(fillTokens(th.learn.unit, { n: '5' }));
    expect(unitName(11)).not.toMatch(/V|11/);
  });

  it('names the topic of a passed unit once units of two topics can sit side by side', () => {
    expect(unitPassedName(11, BOTH)).toBe(
      fillTokens(th.summary.unitPassedIn, { topic: packOf('vector').titleTh, n: '1' }),
    );
    expect(unitPassedName(2, BOTH)).toBe(
      fillTokens(th.summary.unitPassedIn, { topic: packOf('matrix').titleTh, n: '2' }),
    );
    expect(unitPassedName(2, ['matrix'])).toBe(fillTokens(th.summary.unitPassed, { n: '2' }));
  });
});
