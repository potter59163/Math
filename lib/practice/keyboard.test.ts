import { describe, expect, it } from 'vitest';
import { actionFromKey } from './keyboard';

describe('actionFromKey', () => {
  it('reads the digit row', () => {
    expect(actionFromKey('Digit3', '3')).toBe('3');
    expect(actionFromKey('Digit0', '0')).toBe('0');
  });

  it('reads the physical key, so a Thai layout still types numbers', () => {
    // On Kedmanee these keys produce ๅ, / and - unless the layout is switched.
    expect(actionFromKey('Digit1', 'ๅ')).toBe('1');
    expect(actionFromKey('Digit2', '/')).toBe('2');
    expect(actionFromKey('Digit3', '-')).toBe('3');
    expect(actionFromKey('Minus', 'ข')).toBe('-');
    expect(actionFromKey('Slash', 'ฝ')).toBe('/');
    expect(actionFromKey('Period', 'ใ')).toBe('.');
  });

  it('reads the numpad', () => {
    expect(actionFromKey('Numpad7', '7')).toBe('7');
    expect(actionFromKey('NumpadSubtract', '-')).toBe('-');
    expect(actionFromKey('NumpadDivide', '/')).toBe('/');
    expect(actionFromKey('NumpadDecimal', '.')).toBe('.');
    expect(actionFromKey('NumpadEnter', 'Enter')).toBe('send');
  });

  it('falls back to the character when the browser sends no key code', () => {
    expect(actionFromKey('', '4')).toBe('4');
    expect(actionFromKey('', '๔')).toBe('4');
    expect(actionFromKey('', '−')).toBe('-');
    expect(actionFromKey('', '/')).toBe('/');
  });

  it('reads the control keys', () => {
    expect(actionFromKey('Backspace', 'Backspace')).toBe('backspace');
    expect(actionFromKey('Enter', 'Enter')).toBe('send');
    expect(actionFromKey('ArrowRight', 'ArrowRight')).toBe('right');
    expect(actionFromKey('ArrowLeft', 'ArrowLeft')).toBe('left');
    expect(actionFromKey('ArrowUp', 'ArrowUp')).toBe('up');
    expect(actionFromKey('ArrowDown', 'ArrowDown')).toBe('down');
  });

  it('ignores everything else', () => {
    expect(actionFromKey('KeyA', 'a')).toBeNull();
    expect(actionFromKey('Tab', 'Tab')).toBeNull();
    expect(actionFromKey('', 'x')).toBeNull();
  });
});
