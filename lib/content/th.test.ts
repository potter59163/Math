import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fillTokens, tokensIn } from '@/lib/core/tokens';
import { generate } from '@/lib/topics/matrix/generators';
import { CATALOG } from '@/lib/topics/matrix/misconceptions';
import { SKILLS, levelsOf } from '@/lib/topics/matrix/skills';
import { th } from './th';

const SEEDS = Array.from({ length: 100 }, (_, i) => i * 7919);

describe('matrix copy', () => {
  const items = SKILLS.flatMap(({ id }) =>
    levelsOf(id).flatMap((difficulty) =>
      SEEDS.map((seed) => generate({ skill: id, difficulty, seed })),
    ),
  );

  it('every item prompt exists and fills in with no token left over', () => {
    for (const item of items) {
      const text = fillTokens(th.prompts[item.prompt.key], item.prompt.params);
      expect(text).not.toMatch(/[{}]/);
    }
  });

  it('every prompt key is reachable from some generated item', () => {
    const used = new Set(items.map((item) => item.prompt.key));
    expect([...used].sort()).toEqual(Object.keys(th.prompts).sort());
  });

  it('every prompt uses only tokens its items supply', () => {
    for (const item of items) {
      const tokens = tokensIn(th.prompts[item.prompt.key]);
      expect(Object.keys(item.prompt.params ?? {}).sort()).toEqual([...tokens].sort());
    }
  });

  it('every choice option has a label', () => {
    for (const item of items) {
      for (const option of item.options ?? []) {
        expect(th.choices[option.labelKey].length).toBeGreaterThan(0);
      }
    }
  });

  it('every skill has a name', () => {
    for (const skill of SKILLS) expect(skill.nameTh.length).toBeGreaterThan(0);
  });

  it('every ★ misconception has a name and an L2 hint', () => {
    for (const entry of CATALOG) {
      expect(entry.nameTh.length).toBeGreaterThan(0);
      expect(th.hints[entry.hintKey].length).toBeGreaterThan(0);
    }
    expect(Object.keys(th.hints).sort()).toEqual(CATALOG.map((entry) => entry.id).sort());
  });

  it('has an L1 hint for every item form, with no tokens left to fill', () => {
    for (const item of items) {
      const hint = th.hintL1[item.data.form];
      expect(hint.length).toBeGreaterThan(0);
      expect(tokensIn(hint)).toEqual([]);
    }
  });

  it('names every unit', () => {
    for (const skill of SKILLS) expect(th.units[skill.unit].length).toBeGreaterThan(0);
  });

  it('marks every line of the new screens for review', () => {
    const source = readFileSync(new URL('./th.ts', import.meta.url), 'utf8');
    for (const section of ['common', 'join', 'learn', 'session', 'summary', 'hintFirstStep']) {
      const start = source.indexOf(`\n  ${section}: {`);
      const end = source.indexOf('\n  },', start);
      const body = source.slice(start, end).split('\n').slice(1);
      body.forEach((line, index) => {
        if (/^\s+\w+:\s*'/.test(line)) expect(body[index - 1].trim()).toBe('// TODO(review)');
      });
    }
  });

  it('marks the seven drafted hints for review', () => {
    const source = readFileSync(new URL('./th.ts', import.meta.url), 'utf8');
    for (const id of [
      'M02_INDEX_SWAP',
      'M05_SUB_REVERSED',
      'M10_MULT_ROW_ROW',
      'M11_MULT_COMMUTATIVE',
      'M15_DET_ADDITIVE',
      'M18_INV_SINGULAR',
      'M21_INV_RECIPROCAL',
    ]) {
      expect(source).toMatch(new RegExp(`// TODO\\(review\\)\\n\\s+${id}:`));
    }
  });
});
