import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Answer, Item } from '@/lib/core/types';
import { misconceptionAnswer, slipAnswer } from '@/lib/sim/answers';
import { currentItem, rebuildItem, sameRef, wasOffered } from './items';
import { commitAttempt, prepareAttempt, startSession } from './rules';
import { dropOtherTopics, finishScene, newProfile } from './turn';
import type { Profile } from './types';

// A device decides by the rules at once, and the server may decide again with the tutor. Whichever
// candidate the tutor picks, the item the device opened must be one the server offered, or a student
// whose tutor was slow would answer for no XP (lib/server/sync.ts).

const AT = 1_800_000_000_000;

function settled(profile: Profile): Profile {
  let p = profile;
  while (p.pending) p = finishScene(p);
  return p;
}

type Move = 'right' | 'misconception' | 'slip';

function answerFor(item: Item, move: Move): Answer {
  if (move === 'right') return item.correct;
  const diagnostic = item.diagnostics[0];
  if (move === 'misconception' && diagnostic) {
    return misconceptionAnswer(item, diagnostic.id) ?? slipAnswer(item);
  }
  return slipAnswer(item);
}

describe('the items a decision offers', () => {
  it("hold the rules' item, whichever candidate the tutor chose", () => {
    let decisions = 0;
    let withChoices = 0;
    fc.assert(
      fc.property(
        fc.subarray([1, 2, 3, 4, 5], { minLength: 1 }),
        fc.array(fc.constantFrom<Move>('right', 'misconception', 'slip'), {
          minLength: 1,
          maxLength: 10,
        }),
        (units, moves) => {
          let profile = settled(startSession(newProfile({ id: 'u1', units })));
          for (const move of moves) {
            const item = currentItem(profile);
            if (!item) return;
            expect(wasOffered(profile, item.ref)).toBe(true);
            const event = { item, answer: answerFor(item, move), hintLevel: 0 as const, timeMs: 9, at: AT };
            const prepared = prepareAttempt(profile, event);
            const ruled = commitAttempt(prepared);
            for (const candidate of prepared.candidates) {
              const byTutor = commitAttempt(prepared, candidate.id);
              decisions += 1;
              if (prepared.candidates.length > 1) withChoices += 1;
              // Its own item, and the one a device that decided by the rules is now looking at.
              if (byTutor.profile.current) {
                expect(wasOffered(byTutor.profile, byTutor.profile.current.ref)).toBe(true);
              }
              if (ruled.profile.current) {
                expect(wasOffered(byTutor.profile, ruled.profile.current.ref)).toBe(true);
              }
              // Every one is a real item, at the same counter as the chosen one.
              for (const ref of byTutor.profile.offered ?? []) {
                expect(rebuildItem(ref)).not.toBeNull();
              }
            }
            profile = settled(ruled.profile);
          }
        },
      ),
      { numRuns: 200 },
    );
    // The property must have met decisions with a real choice in them.
    expect(decisions).toBeGreaterThan(0);
    expect(withChoices).toBeGreaterThan(0);
  });

  it('are not an item the student was never given', () => {
    const profile = settled(startSession(newProfile({ id: 'u1', units: [1, 2, 3, 4, 5] })));
    const item = currentItem(profile)!;
    const easier = { ...item.ref, seed: item.ref.seed + 7 };
    expect(rebuildItem(easier)).not.toBeNull();
    expect(wasOffered(profile, easier)).toBe(false);
    expect(wasOffered(profile, { ...item.ref, difficulty: item.ref.difficulty === 1 ? 2 : 1 })).toBe(
      false,
    );
    expect(wasOffered({ current: undefined }, item.ref)).toBe(false);
  });

  it('go with the open item when the student switches topic', () => {
    const profile = settled(startSession(newProfile({ id: 'u1', units: [1, 2, 3, 4, 5] })));
    expect(profile.offered?.length).toBeGreaterThan(0);
    const switched = dropOtherTopics(profile, 'vector');
    expect(switched.current).toBeUndefined();
    expect(switched.offered).toBeUndefined();
    expect(dropOtherTopics(profile, 'matrix')).toBe(profile);
  });

  it('compare every field a generator reads', () => {
    const ref = { topic: 'matrix', skill: 'dim', difficulty: 1 as const, seed: 5, gv: 1 };
    expect(sameRef(ref, { ...ref })).toBe(true);
    expect(sameRef(ref, { ...ref, target: undefined })).toBe(true);
    expect(sameRef(ref, { ...ref, target: 'M01_DIM_SWAP' })).toBe(false);
    expect(sameRef(ref, { ...ref, targetVariant: 'a' })).toBe(false);
    expect(sameRef(ref, { ...ref, gv: 2 })).toBe(false);
    expect(sameRef(ref, { ...ref, topic: 'vector' })).toBe(false);
  });
});
