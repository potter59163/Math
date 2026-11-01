---
paths:
  - "lib/director/**"
  - "app/api/**"
---

# Director & API rules

- `lib/director/candidates.ts` (rules) is the source of truth: it proposes 1–4 candidates with score and Thai `ruleReason`. A single path stays single: no alternative is invented to fill a quota, and the LLM then only writes the words. The LLM only chooses among them; with no LLM the top-scored candidate wins.
- LLM I/O: build input with `buildDirectorInput()`, parse with the Zod schema `LlmDecision`, then `validateDecision()` (choice ∈ candidates, no digits in student-facing text, tokens ⊆ allowed, beats ∈ template, lengths). Any failure → rules top candidate + default content. Log `fallback_reason`.
- Never send nickname, seat number, class code or any student-typed free text to the LLM (the stretch chat route is the only exception and has its own guard).
- The server regenerates the item from `ItemRef` and re-classifies. Never trust client-side classification for logging or BKT.
- Every candidate with a `target` gets its level from `probeLevel()`. If a generator still throws at runtime, log it and serve `item(s, L)` with no target; never fail the request.
- `pathStep.note` is built from the chosen candidate with copy from `lib/content/th.ts`, never by the LLM, so it behaves the same in llm and rules mode (AI_DIRECTOR.md §3.2).
- Log every decision to `decisions`: trigger, mode (llm|rules), candidates, choice, message, narration, reason, latency_ms, fallback_reason.
- Rate-limit per student. Treat 429 and timeouts as fallbacks, not errors.
- LLM keys only in server env. Nothing LLM-related may be imported by client components.
- Students' DB access goes only through route handlers, scoped to the user id `signedInUserId()` returns. The browser never talks to the database, and `MONGODB_URI` never leaves the server.
