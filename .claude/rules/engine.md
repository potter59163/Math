---
paths:
  - "lib/core/**"
  - "lib/topics/**"
  - "lib/learner/**"
  - "lib/sim/**"
---

# Engine rules

- Pure TypeScript. No React, DOM, fetch, Supabase or `process.env` in these folders.
- `Rational`: integer numerator/denominator (safe integers), denominator > 0, always reduced by gcd. Throw if a part exceeds 1e9 in magnitude. No floats anywhere in math paths.
- PRNG: `createRng(seed)` (e.g. mulberry32) passed explicitly. Never `Math.random`. Item seeds come from `deriveSeed(studentId, counter)`, a pure hash (SPEC §6); assessment forms use fixed seeds.
- Generator signature: `generate({ skill, difficulty, seed, target? }) → Item`. Internally resample with derived seeds (`seed`, `seed+1`, … up to 50 tries) until `validateItem` passes; if it never passes, throw — that is a bug, add a failing test first.
- `probeLevel(skill, target, L)` (MISCONCEPTIONS.md §4.1) picks the level for a probe, because some targets cannot exist at some levels. Test every row of that table at every listed level.
- `Item.diagnostics` are always computed by the catalog functions in `lib/topics/matrix/misconceptions.ts`. Never hand-type expected wrong answers in generators.
- Classification order: correct → diagnostics (target first, then catalog order) → slip (exactly one wrong cell, same shape) → shape_error → unknown.
- Every ★ misconception in `docs/MISCONCEPTIONS.md` needs: candidate fn, `applies()` check, the doc example as a unit test (numbers must match exactly), and a property test that its candidate is classified as itself and never as correct.
- `regenerate(itemRef)` must return a deep-equal item every time (golden-seed tests).
- Learner model is pure: `(profile, event, config) → profile`. Timestamps are passed in, never read inside.
