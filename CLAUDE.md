# QEDify: Matrix

Adaptive matrix-learning web app for Thai upper-secondary students (ม.5–6).
Duolingo-style path: short animation → exercise → diagnosis of *why* an answer is wrong (misconception) → AI tutor "คิว" picks each student's next step.
Successor of QEDify (physics). Built for the Chula Innovative Award 2027 (submission 27 Nov 2026) and a real classroom trial (13–19 Nov 2026).
**Stability beats features.** App name and tutor name are placeholders in `lib/config.ts`.

## Docs — read only what the current task needs
- `docs/PLAN.md`: phases, acceptance criteria, cut order. Tick checkboxes when done.
- `docs/SPEC.md`: product, flows, learner model, data model, API, privacy.
- `docs/MISCONCEPTIONS.md`: misconception catalog, candidate formulas, verified examples (use them as tests).
- `docs/SCENES.md`: animation templates.
- `docs/AI_DIRECTOR.md`: rules director, LLM contract, prompt, validator.
- `docs/RESEARCH.md`: pre/post test, trial protocol, analysis.
- `docs/DECISIONS.md`: append non-obvious decisions (date, decision, why).

## Non-negotiables
1. IMPORTANT: The LLM never does math. Every number, answer key, classification, worked step and scene value comes from the engine (`lib/core`, `lib/topics/matrix`) using exact `Rational` arithmetic.
2. The app must work 100% with `LLM_PROVIDER=none` (rules director). LLM output is Zod-validated; invalid / timeout / 429 → rules decision, logged with `fallback_reason`.
3. The LLM may only pick one of the candidates the rules engine offers. Student-facing LLM text contains no digit characters (0-9, ๐-๙); numbers appear only through whitelisted `{{tokens}}` resolved server-side.
4. Every generated item passes `validateItem` (MISCONCEPTIONS.md §2). Deterministic: seeded PRNG only. No `Math.random` / `Date.now` inside engine, learner model or rules director.
5. Privacy: students are identified by class code + seat number (+ optional nickname that never leaves our DB). Nothing identifying goes to the LLM. No camera, mic, location or face data.
6. Scope is matrices only. No story/open-world mode, no runtime video generation, no native app.
7. UI text is Thai and lives in `lib/content/th.ts`. Code, comments and commits are English.
8. Mobile-first: works at 360px wide, touch targets ≥ 44px, custom on-screen keypad (no system keyboard, no sliders), honors `prefers-reduced-motion`.

## Stack
Next.js (App Router) + TypeScript strict + Tailwind · `motion` (Framer Motion) on SVG for scenes · KaTeX for static formulas · Zod · Supabase Postgres accessed server-side only · Supabase Auth (magic link) for teachers · signed httpOnly cookie for students · Vitest + fast-check · Playwright (optional) · Vercel (region `sin1`) + Supabase (Singapore) · Python 3 (pandas, scipy, matplotlib) in `analysis/`.

## Commands
- `npm run dev`: dev server
- `npm run check`: typecheck + lint + all tests. Must pass before you say a task is done.
- `npx vitest run <path>`: run one test file
- `npm run sim`: simulated-learner report (Phase 4+)
- `npm run eval:director`: LLM director eval (Phase 6+, needs an LLM key)
- `python analysis/analyze.py <export-dir>`: research report (Phase 9)

## Layout
```
app/(student)/  join · consent · learn · learn/session · test/[phase] · summary
app/teacher/    teacher login, class dashboard
app/dev/        engine · scenes · director  (dev-only playgrounds)
app/api/        join · attempt · hint · event · help · assessment · teacher · export
lib/config.ts   all tunable numbers (BKT, thresholds, timeouts, XP, names)
lib/core/       rational · prng · types · parse · validate · classify · tokens (topic-agnostic)
lib/topics/matrix/  ops · skills · generators/ · misconceptions · worked · assessment
lib/learner/    bkt · profile · misconceptionStatus
lib/director/   candidates · rules · fixedPath · llm/ · prompt · schema · validate
lib/content/th.ts   Thai copy: prompts, feedback, hints, captions
lib/sim/        simulated learners (tests + `npm run sim`)
lib/db/         Supabase server client + queries
components/     input/ (MatrixInput, Keypad) · scenes/ · learn/ · teacher/ · ui/
supabase/migrations/   SQL
analysis/       analyze.py, requirements.txt
```

## Workflow
- One phase per session. Read that phase in `docs/PLAN.md`, then propose a short plan before editing.
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
