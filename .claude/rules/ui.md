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
- Scenes: `ScenePlayer` + pure template components driven only by `SceneSpec`. A clip plays by itself with a recorded voice, and a student can pause, step, replay, skip or mute it. `prefers-reduced-motion` → static frame per beat, with nothing moving on by itself.
- Captions: at most two lines on a 360px screen, broken by hand. No walls of text (lesson from the QEDify pilot).
- Personal path: `PathStrip` has a fixed height and its note stays on one line at 360px, so a new step never shifts the layout.
- The look is a maths notebook: graph paper, blue ballpoint for what the student writes (`font-hand text-brand`), red pen for what is wrong (`warn`), a yellow highlighter for what to do next (`cta`, `marker`), and clips always at the chalkboard (`.board`). No purple gradients, stacks of rounded cards, or text explaining what a control already shows.
- Leaderboard: weekly XP only, under the name a student chose, and any student can leave it in Settings. No email, photo or user id ever reaches another browser.
