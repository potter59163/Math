import fc from 'fast-check';

// Project rule: every property test runs at least 1000 times.
fc.configureGlobal({ numRuns: 1000 });
