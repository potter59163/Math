import type { TryChoice } from './types';

/** The right answer's place depends on the numbers, so that it is not always the same button. */
export function choiceOf(right: string, wrong: readonly string[], salt: number): TryChoice {
  const at = Math.abs(salt) % (wrong.length + 1);
  const options = [...wrong];
  options.splice(at, 0, right);
  return { options, right: at };
}
