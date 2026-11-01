import { describe, expect, it } from 'vitest';
import { CONFIG } from '@/lib/config';
import { testBlock } from './assessment';

describe('testBlock', () => {
  it('opens the pre-test only before the first practice item', () => {
    expect(testBlock('pre', 0)).toBeNull();
    expect(testBlock('pre', 1)).toBe('already_learning');
  });

  it('opens the post-test only after enough practice', () => {
    expect(testBlock('post', 0)).toBe('too_early');
    expect(testBlock('post', CONFIG.postTestAfterItems - 1)).toBe('too_early');
    expect(testBlock('post', CONFIG.postTestAfterItems)).toBeNull();
  });
});
