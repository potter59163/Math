import { expect, it } from 'vitest';
import { buildReport } from './report';

// `npm run sim`. It goes through vitest because the project has no other way to run TypeScript with
// the `@` alias, and a failure here means an illegal transition.

const STUDENTS = Number(process.env.SIM_STUDENTS ?? 200);
const ITEMS = Number(process.env.SIM_ITEMS ?? 60);

it('has no illegal transitions', () => {
  const { text, illegal } = buildReport(STUDENTS, ITEMS);
  console.log(text);
  expect(illegal).toBe(0);
});
