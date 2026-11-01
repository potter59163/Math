---
paths:
  - "app/**/*.tsx"
  - "components/**"
---

# UI rules

- Thai copy only from `lib/content/th.ts`. No hard-coded Thai strings in components.
- Design for 360px first, then desktop. Touch targets ≥ 44px. All answers go through the custom `Keypad` + `MatrixInput` (no `<input type="number">`, no sliders, never trigger the system keyboard on mobile).
- Matrices render with `MatrixView`: bracket borders, tabular numbers, fractions shown consistently.
- Feedback must appear < 100 ms after submit (client-side classification with the shared engine). When the director's message arrives later, cross-fade the text without layout shift.
- Scenes: `ScenePlayer` + pure template components driven only by `SceneSpec`. Tap/next to advance beats, replay and skip buttons, progress dots. `prefers-reduced-motion` → static frame per beat.
- Captions: max one line on a 360px screen. No walls of text (lesson from the QEDify pilot).
- Personal path: `PathStrip` has a fixed height and its note stays on one line at 360px, so a new step never shifts the layout.
- Leaderboard: weekly XP only, under the name a student chose, and any student can leave it in Settings. No email, photo or user id ever reaches another browser.
