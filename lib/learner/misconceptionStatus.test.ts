import { describe, expect, it } from 'vitest';
import { isLegalStatusChange, isOpen, onCaught, onTargetedAnswer } from './misconceptionStatus';
import type { MisconceptionState } from './types';

const at = (itemNo: number) => ({ itemNo, at: itemNo * 60_000 });

const firstCatch = onCaught(undefined, at(4));

describe('catching a misconception (SPEC §7.2)', () => {
  it('none → suspected on the first catch', () => {
    expect(firstCatch).toMatchObject({ status: 'suspected', count: 1, fixStreak: 0 });
    expect(isOpen(firstCatch)).toBe(true);
  });

  it('suspected → active on the second catch', () => {
    expect(onCaught(firstCatch, at(5))).toMatchObject({ status: 'active', count: 2 });
  });

  it('stays active and keeps counting after that', () => {
    const second = onCaught(firstCatch, at(5));
    expect(onCaught(second, at(6))).toMatchObject({ status: 'active', count: 3 });
  });

  it('a catch while fixing clears the streak and adds to the count', () => {
    const fixing = onTargetedAnswer(firstCatch, true, at(5)).state;
    expect(fixing.fixStreak).toBe(1);
    expect(onCaught(fixing, at(6))).toMatchObject({ status: 'active', fixStreak: 0, count: 2 });
  });

  it('remembers the variant caught last, so the next probe can show it', () => {
    const caught = onCaught(undefined, { ...at(1), variant: 'NO_SWAP' });
    expect(caught.variant).toBe('NO_SWAP');
    expect(onCaught(caught, { ...at(2), variant: 'NO_DIVIDE' }).variant).toBe('NO_DIVIDE');
    expect(onCaught(caught, at(2)).variant).toBe('NO_SWAP');
  });
});

describe('fixing a misconception (SPEC §7.2)', () => {
  it('two targeted right answers in a row resolve it', () => {
    const one = onTargetedAnswer(firstCatch, true, at(5));
    expect(one.resolved).toBe(false);
    expect(one.state).toMatchObject({ status: 'suspected', fixStreak: 1 });

    const two = onTargetedAnswer(one.state, true, at(6));
    expect(two.resolved).toBe(true);
    expect(two.state.status).toBe('resolved');
    expect(isOpen(two.state)).toBe(false);
  });

  it('works the same from active', () => {
    const active = onCaught(firstCatch, at(5));
    const one = onTargetedAnswer(active, true, at(6)).state;
    expect(onTargetedAnswer(one, true, at(7)).state.status).toBe('resolved');
  });

  it('a targeted answer that does not count breaks the streak but adds nothing', () => {
    const one = onTargetedAnswer(firstCatch, true, at(5)).state;
    const broken = onTargetedAnswer(one, false, at(6));
    expect(broken.resolved).toBe(false);
    expect(broken.state).toMatchObject({ status: 'suspected', fixStreak: 0, count: 1 });
  });

  it('records how long the fix took, from the catch to the second right answer', () => {
    const one = onTargetedAnswer(firstCatch, true, at(6)).state;
    const { state } = onTargetedAnswer(one, true, at(9));
    expect(state.itemsToResolve).toBe(5);
    expect(state.msToResolve).toBe(5 * 60_000);
  });

  it('leaves a resolved misconception alone', () => {
    const one = onTargetedAnswer(firstCatch, true, at(5)).state;
    const done = onTargetedAnswer(one, true, at(6)).state;
    const again = onTargetedAnswer(done, true, at(7));
    expect(again.resolved).toBe(false);
    expect(again.state).toBe(done);
  });
});

describe('relapse (SPEC §7.2)', () => {
  const resolved = (): MisconceptionState => {
    const one = onTargetedAnswer(firstCatch, true, at(5)).state;
    return onTargetedAnswer(one, true, at(6)).state;
  };

  it('resolved → active when caught again', () => {
    expect(onCaught(resolved(), at(9))).toMatchObject({ status: 'active', count: 2, fixStreak: 0 });
  });

  it('counts each time it comes back, and a first catch is not one', () => {
    expect(onCaught(undefined, at(1)).relapses).toBeUndefined();
    expect(onCaught(resolved(), at(9)).relapses).toBe(1);
    const again = onCaught({ ...resolved(), relapses: 1 }, at(12));
    expect(again.relapses).toBe(2);
    expect(onCaught(again, at(13)).relapses).toBe(2);
  });

  it('times the second fix from the relapse, not from the first catch', () => {
    const relapsed = onCaught(resolved(), at(9));
    const one = onTargetedAnswer(relapsed, true, at(10)).state;
    const { state, resolved: isResolved } = onTargetedAnswer(one, true, at(11));
    expect(isResolved).toBe(true);
    expect(state.itemsToResolve).toBe(2);
    expect(state.msToResolve).toBe(2 * 60_000);
  });
});

describe('isLegalStatusChange', () => {
  it.each([
    [undefined, undefined],
    [undefined, 'suspected'],
    ['suspected', 'suspected'],
    ['suspected', 'active'],
    ['suspected', 'resolved'],
    ['active', 'active'],
    ['active', 'resolved'],
    ['resolved', 'resolved'],
    ['resolved', 'active'],
  ] as const)('allows %s → %s', (from, to) => {
    expect(isLegalStatusChange(from, to)).toBe(true);
  });

  it.each([
    [undefined, 'active'],
    [undefined, 'resolved'],
    ['suspected', undefined],
    ['active', 'suspected'],
    ['active', undefined],
    ['resolved', 'suspected'],
    ['resolved', undefined],
  ] as const)('refuses %s → %s', (from, to) => {
    expect(isLegalStatusChange(from, to)).toBe(false);
  });
});
