export const CONFIG = {
  appName: 'QEDify: Matrix',
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
  hintL2CountsAsWrong: true,
  llm: { timeoutMs: 4000, maxCandidates: 4, maxCallsPerMinutePerStudent: 20 },
  xp: { firstTry: 10, withL1Hint: 7, misconceptionResolved: 20 },
  generatorVersion: 1,
} as const;
