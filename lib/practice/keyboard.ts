import type { Direction, KeypadChar, KeypadKey } from './draft';

export type BoardAction = KeypadKey | Direction | 'send';

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';

const BY_CODE = new Map<string, BoardAction>([
  ['Minus', '-'],
  ['NumpadSubtract', '-'],
  ['Slash', '/'],
  ['NumpadDivide', '/'],
  ['Period', '.'],
  ['NumpadDecimal', '.'],
  ['Backspace', 'backspace'],
  ['Enter', 'send'],
  ['NumpadEnter', 'send'],
  ['ArrowLeft', 'left'],
  ['ArrowRight', 'right'],
  ['ArrowUp', 'up'],
  ['ArrowDown', 'down'],
]);

const BY_CHARACTER = new Map<string, BoardAction>([
  ['-', '-'],
  ['−', '-'],
  ['–', '-'],
  ['/', '/'],
  ['.', '.'],
]);

/**
 * A key press from a physical keyboard. Reads the physical key first: lab computers are often left
 * on the Thai layout, where the digit row types ๅ / - and so on.
 */
export function actionFromKey(code: string, key: string): BoardAction | null {
  const physicalDigit = /^(?:Digit|Numpad)(\d)$/.exec(code);
  if (physicalDigit) return physicalDigit[1] as KeypadChar;

  const byCode = BY_CODE.get(code);
  if (byCode) return byCode;

  if (/^\d$/.test(key)) return key as KeypadChar;
  const thai = THAI_DIGITS.indexOf(key);
  if (key !== '' && thai >= 0) return String(thai) as KeypadChar;
  return BY_CHARACTER.get(key) ?? null;
}
