# Kidma: upper-secondary maths app

Adaptive web app that teaches maths to Thai upper-secondary students. Matrices (ม.5–6) are the first topic and the only one in this MVP.
Duolingo-style path: short animation → exercise → diagnosis of *why* an answer is wrong (misconception) → AI tutor "คิว" picks each student's next step.
Students sign in with Google and learn on their own: there are no teacher pages for now. Tabs: lessons, leaderboard, profile, settings.
Successor of QEDify (physics). Built for the Chula Innovative Award 2027 (submission 27 Nov 2026) and a real classroom trial (13–19 Nov 2026).
**Stability beats features.** The app is called Kidma, Potter's choice. The tutor name in `lib/config.ts` is still a placeholder. Do not use "QEDify", which clashes with other work.

## Docs — read only what the current task needs
- `docs/PLAN.md`: phases, acceptance criteria, cut order. Tick checkboxes when done.
- `docs/SPEC.md`: product, flows, learner model, data model, API, privacy.
- `docs/MISCONCEPTIONS.md`: misconception catalog, candidate formulas, verified examples (use them as tests).
- `docs/SCENES.md`: animation templates.
- `docs/AI_DIRECTOR.md`: rules director, LLM contract, prompt, validator.
- `docs/RESEARCH.md`: pre/post test, trial protocol, analysis.
- `docs/DECISIONS.md`: append non-obvious decisions (date, decision, why).
- `docs/SETUP.md`: the accounts and keys Potter sets up (MongoDB Atlas, Google, Vercel, Claude).

## Non-negotiables
1. IMPORTANT: The LLM never does math. Every number, answer key, classification, worked step and scene value comes from the engine (`lib/core`, `lib/topics/matrix`) using exact `Rational` arithmetic.
2. The app must work 100% with `LLM_PROVIDER=none` (rules director). LLM output is Zod-validated; invalid / timeout / 429 → rules decision, logged with `fallback_reason`.
3. The LLM may only pick one of the candidates the rules engine offers. Student-facing LLM text contains no digit characters (0-9, ๐-๙); numbers appear only through whitelisted `{{tokens}}` resolved server-side.
4. Every generated item passes `validateItem` (MISCONCEPTIONS.md §2). Deterministic: seeded PRNG only. No `Math.random` / `Date.now` inside engine, learner model or rules director.
5. Privacy: a student signs in with Google, but only the name they chose is ever shown, and sign-in asks Google for `openid` alone, so the app never receives their email or real name. `LearnerProfile` holds no name or email, and nothing identifying goes to the LLM. Consent is asked once, before any data is stored. A student can leave the leaderboard and delete their account in Settings. No camera, mic, location or face data, and no Google photo.
6. Scope is matrices only. No story/open-world mode, no runtime video generation, no native app.
7. UI text is Thai and lives in `lib/content/th.ts`. Code, comments and commits are English.
8. Mobile-first: works at 360px wide, touch targets ≥ 44px, custom on-screen keypad (no system keyboard, no sliders), honors `prefers-reduced-motion`.

## Stack
Next.js (App Router) + TypeScript strict + Tailwind · `motion` (Framer Motion) on SVG for scenes · KaTeX for static formulas · Zod · MongoDB Atlas accessed server-side only (`mongodb` driver) · our own Google sign-in, authorization code with PKCE (`jose` checks the ID token) · Anthropic SDK with Claude for the tutor · Vitest + fast-check · Vercel (region `sin1`) + Atlas (Singapore) · Python 3 (pandas, scipy, matplotlib) in `analysis/`.

## Commands
- `npm run dev`: dev server
- `npm run check`: typecheck + lint + all tests. Must pass before you say a task is done.
- `npm run format`: Prettier (skips the hand-edited docs)
- `npx vitest run <path>`: run one test file
- `TEST_MONGODB_URI=mongodb://127.0.0.1:27099 npm test`: also runs `lib/server/store.test.ts` on a real MongoDB, which is skipped without it (`docs/SETUP.md`). Run it after touching the store.
- `npm run sim`: simulated-learner report (Phase 4+)
- `npm run eval:director`: LLM director eval (needs an LLM key, and costs real money)
- `npm run export -- <cohort>`: research CSVs into `exports/` (needs `MONGODB_URI`)
- `python analysis/analyze.py <export-dir>`: research report (Phase 9)

## Layout
```
app/(tabs)/     learn · leaderboard · profile · settings
app/(student)/  welcome · learn/session · test/[phase] · summary
app/auth/       google · callback · signout
app/dev/        engine · scenes · director  (dev-only playgrounds)
app/api/        me · welcome · sync · leaderboard · assessment/[phase]
lib/config.ts   all tunable numbers (BKT, thresholds, timeouts, XP, names)
lib/core/       rational · prng · types · parse · validate · classify · tokens (topic-agnostic)
lib/topics/matrix/  ops · skills · generators/ · misconceptions · worked · assessment · scenes/
lib/learner/    bkt · mastery · difficulty · misconceptionStatus · interleave · progress · profile · types
lib/director/   candidates · rules · turn · fixedPath · scene · items · pathStep · tokens · messages · types · llm/ (config · input · prompt · schema · validate · providers · decide)
lib/sync/       actions (every change to a student, as data) · types · leaderboard · assessment
lib/client/     learner (this device's copy and its queue) · auth · settings · inAppBrowser
lib/server/     db · auth · authStore · google · store · sync · account · schemas · http  (server only)
lib/practice/   draft · keyboard · hints · feedback · rewards
lib/content/th.ts   Thai copy: prompts, feedback, hints, captions
lib/sim/        simulated learners (tests + `npm run sim`, which runs through vitest)
components/     app/ (screens) · input/ (MatrixInput, Keypad) · scenes/ · learn/ · ui/
analysis/       analyze.py, requirements.txt
scripts/        export-data.mjs
```

## Workflow
- Read the relevant part of `docs/PLAN.md`, then propose a short plan before editing.
- Tests first for engine, learner and director logic. Property tests (fast-check, ≥1000 runs) for every generator × difficulty.
- Show evidence at the end of a task: the `npm run check` summary, and for UI a note that 360px and desktop were checked.
- New Thai copy you draft goes in `lib/content/th.ts` with `// TODO(review)` so Potter (and a math teacher) can check wording and math.
- Don't add features beyond the docs or start the next phase without being asked. If the spec is ambiguous or seems wrong, stop and ask.
- Commit after each green phase with a descriptive message.

## Gotchas
- Never compare numbers as floats. Use `Rational.equals`; matrices are `Rational[][]`, serialized as strings like `"-3/2"`.
- An item is identified by `ItemRef {topic, skill, difficulty, seed, target?, gv}`. The server regenerates the item from it and re-classifies before logging. Bump `GENERATOR_VERSION` on any generator change and freeze it before the trial.
- Thai `.length` counts code units including vowel/tone marks. Length limits in docs are code units.
- LLM calls are server-only (`app/api/**`) with timeout `LLM_TIMEOUT_MS` (default 4000). Never block the UI: the client shows its own instant rule feedback first.
- The repo root already contains these docs: when scaffolding, never overwrite `CLAUDE.md`, `docs/`, `.claude/`.
- This is Next.js 16, and its APIs may differ from what you remember. Check the version-matched docs in `node_modules/next/dist/docs/` before using an unfamiliar API. `cacheComponents` is off on purpose (see `docs/DECISIONS.md`).
