/** A comma list of topic ids. Empty or missing means matrices only. */
export function topicsFrom(raw: string | undefined): readonly string[] {
  const topics = (raw ?? '')
    .split(',')
    .map((topic) => topic.trim())
    .filter((topic) => topic.length > 0);
  return topics.length > 0 ? topics : ['matrix'];
}

export const CONFIG = {
  appName: 'Kidma',
  tutorName: 'คิว',
  bkt: { pInit: 0.15, pTransit: 0.15, pSlip: 0.1, pGuessEntry: 0.05 }, // choice: 1/k
  bktFromPretest: { correct: 0.6, misconception: 0.1, otherWrong: 0.25 },
  mastery: {
    pKnown: 0.95,
    minFirstTryCorrect: 3,
    minFirstTryCorrectIfPretestCorrect: 1,
    minLevelToPass: 2,
  },
  difficulty: { window: 6, upAt: 0.85, downAt: 0.5, minAttemptsAtLevel: 2 },
  misconception: { activeAtCount: 2, resolveAfterTargetedCorrect: 2 },
  interleave: { every: 6, lookback: 10 },
  stuckAfterWrong: 3,
  pathStepsOnMap: 5,
  dailyGoalItems: 10,
  postTestAfterItems: 10,
  hintL2CountsAsWrong: true,
  llm: {
    // Claude Sonnet 5.5 with adaptive thinking answered within 3.9 s for 95 calls in 100 in the eval of
    // 25 Nov 2026 (p50 3.0 s). Claude Haiku 5.5 kept within 4 s. AI_DIRECTOR §7.
    timeoutMs: 5000,
    maxCandidates: 4,
    maxCallsPerMinutePerStudent: 20,
    // For everyone together, so a script or a crowd of new accounts cannot run up the bill: past it,
    // the rules decide for the rest of the day (UTC). About 6,000 a day for a class of 100 answering 60
    // each, at roughly $0.003 a call on Claude Sonnet 5.5 (DECISIONS, 25 Nov 2026).
    maxCallsPerDay: 10_000,
    // What the tutor is told in words, as "quick" or "slow", in place of a number it would copy.
    quickAnswerMs: 20_000,
    slowAnswerMs: 90_000,
  },
  xp: { firstTry: 10, withL1Hint: 7, withDeepHint: 3, misconceptionResolved: 20 },
  // SCENES §1. A scene's length is the sum of its beats' declared times, not the wait for a tap.
  sound: { streakEvery: 5 },
  scenes: {
    // A spoken line sets the pace now, and the longest of them takes just over 5 seconds.
    maxBeatMs: 5700,
    // Without the time a student takes to tap. See docs/DECISIONS.md: a clip with a voice runs longer.
    limitMs: { intro: 40000, concept: 22000, request: 22000, remediate: 30000, reveal: 30000 },
  },
  // The matrix generators' version, which every matrix ItemRef carries. Each topic pack has its own, so
  // a change to another topic's generators never orphans a matrix item (docs/VECTORS.md §6.1).
  generatorVersion: 2,
  // Topics students may be offered, from NEXT_PUBLIC_TOPICS ("matrix,vector"). Only registered ones are.
  topics: topicsFrom(process.env.NEXT_PUBLIC_TOPICS),
} as const;
