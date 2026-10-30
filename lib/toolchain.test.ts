import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

describe('test toolchain', () => {
  it('runs property tests 1000 times by default', () => {
    let runs = 0;
    fc.assert(
      fc.property(fc.integer(), () => {
        runs += 1;
      }),
    );
    expect(runs).toBe(1000);
  });
});
