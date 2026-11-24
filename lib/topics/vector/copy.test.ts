import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { thVector } from '@/lib/content/th.vector';
import { fillTokens, tokensIn } from '@/lib/core/tokens';
import { generate } from './generators';
import { CATALOG } from './misconceptions';
import { SKILLS, UNITS, levelsOf } from './skills';

// The Thai copy of the vector pack (lib/content/th.vector.ts), checked against what the engine emits.

const SEEDS = Array.from({ length: 100 }, (_, i) => i * 7919);

const items = SKILLS.flatMap(({ id }) =>
  levelsOf(id).flatMap((difficulty) =>
    SEEDS.map((seed) => generate({ skill: id, difficulty, seed })),
  ),
);

describe('vector copy', () => {
  it('every item prompt exists and fills in with no token left over', () => {
    for (const item of items) {
      const text = fillTokens(thVector.prompts[item.prompt.key], item.prompt.params);
      expect(text).not.toMatch(/[{}]/);
    }
  });

  it('every prompt key is reachable from some generated item', () => {
    const used = new Set(items.map((item) => item.prompt.key));
    expect([...used].sort()).toEqual(Object.keys(thVector.prompts).sort());
  });

  it('every prompt uses only tokens its items supply', () => {
    for (const item of items) {
      const tokens = tokensIn(thVector.prompts[item.prompt.key]);
      expect(Object.keys(item.prompt.params ?? {}).sort()).toEqual([...tokens].sort());
    }
  });

  it('every choice option has a label', () => {
    for (const item of items) {
      for (const option of item.options ?? []) {
        expect(thVector.choices[option.labelKey].length).toBeGreaterThan(0);
      }
    }
  });

  it('writes a half as ½ on a figure option', () => {
    expect(thVector.choices['1/2BC']).toBe('½BC');
    expect(thVector.choices['2MN']).toBe('2MN');
    expect(thVector.choices.DC).toBe('DC');
  });

  it('every skill and unit has a name, and units are 11–15 shown as V1–V5', () => {
    for (const skill of SKILLS) {
      expect(skill.nameTh.length).toBeGreaterThan(0);
      expect(UNITS).toContain(skill.unit);
    }
    expect(UNITS.map((unit) => thVector.unitBadges[unit])).toEqual(['V1', 'V2', 'V3', 'V4', 'V5']);
    for (const unit of UNITS) expect(thVector.units[unit].length).toBeGreaterThan(0);
  });

  it('every misconception has a name, a short name and an L2 hint', () => {
    for (const entry of CATALOG) {
      expect(entry.nameTh.length).toBeGreaterThan(0);
      expect(thVector.hints[entry.hintKey].length).toBeGreaterThan(0);
    }
    const ids = CATALOG.map((entry) => entry.id).sort();
    expect(Object.keys(thVector.hints).sort()).toEqual(ids);
    expect(Object.keys(thVector.misconceptionNames).sort()).toEqual(ids);
    expect(Object.keys(thVector.misconceptionShort).sort()).toEqual(ids);
  });

  it('keeps short names within 16 code units, so a path note fits one line', () => {
    for (const short of Object.values(thVector.misconceptionShort)) {
      expect(short.length, short).toBeLessThanOrEqual(16);
    }
  });

  it('has an L1 hint for every item form, with no tokens to fill', () => {
    const forms = new Set(items.map((item) => item.data.form));
    expect([...forms].sort()).toEqual(Object.keys(thVector.hintL1).sort());
    for (const hint of Object.values(thVector.hintL1)) {
      expect(hint.length).toBeGreaterThan(0);
      expect(tokensIn(hint)).toEqual([]);
    }
  });

  it('uses the textbook terms', () => {
    const all = JSON.stringify(thVector);
    for (const term of [
      'เวกเตอร์',
      'ขนาด',
      'เวกเตอร์หนึ่งหน่วย',
      'ผลคูณเชิงสเกลาร์',
      'ผลคูณเชิงเวกเตอร์',
      'ขนาน',
      'ตั้งฉาก',
      'โคไซน์แสดงทิศทาง',
      'ทรงสี่เหลี่ยมด้านขนาน',
    ]) {
      expect(all).toContain(term);
    }
  });

  it('marks every block for review', () => {
    const source = readFileSync(new URL('../../content/th.vector.ts', import.meta.url), 'utf8');
    for (const block of Object.keys(thVector)) {
      const start = source.indexOf(`\n  ${block}: {`);
      expect(start, block).toBeGreaterThan(0);
      const above = source.slice(source.lastIndexOf('\n', start - 1), start);
      expect(above, block).toContain('TODO(review)');
    }
  });
});
