import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { th } from '@/lib/content/th';
import type { ThemeId } from '@/lib/learner/types';
import { generate } from '../generators';
import { SKILLS } from '../skills';
import { conceptScene, introScene, revealScene } from '.';
import { SCENE_COMBOS, caughtExample } from './catalog';
import type { AnyScene } from './types';
import recorded from './voice.json';
import { recordedLine, voiceText, type VoiceId, type VoiceTake } from './voice';
import { VOICE_TAKES, takeHash } from './voice.take';

const SEEDS = [1, 20261113, 7919];
const THEMES: ThemeId[] = ['shop', 'game', 'sport', 'music', 'food'];
const UNITS = [1, 2, 3, 4, 5] as const;

const scenes = [
  ...SEEDS.flatMap((seed) => SCENE_COMBOS.map((combo) => caughtExample(combo, seed)?.spec)),
  ...SEEDS.flatMap((seed) =>
    SKILLS.flatMap(({ id }) => [
      conceptScene(id, { seed, level: 1 }),
      revealScene(generate({ skill: id, difficulty: 1, seed })),
    ]),
  ),
  ...THEMES.flatMap((theme) => UNITS.map((unit) => introScene(unit, { seed: 5, theme }))),
].filter((spec) => spec !== undefined) as unknown as AnyScene[];

function idsOf(scene: AnyScene): (VoiceId | undefined)[] {
  return [
    ...scene.beats.map((beat) => scene.voice[beat]),
    ...(scene.waits ?? []).map((beat) => scene.hints?.[beat]?.voice),
  ];
}

describe('the voice of the clips', () => {
  it('says no digit or Latin letter, since every student hears the same take', () => {
    for (const lines of Object.values(th.voice)) {
      for (const line of Object.values(lines)) expect(line).not.toMatch(/[0-9๐-๙A-Za-z]/);
    }
  });

  it('has a real line for every beat of every clip, and for every wrong tap', () => {
    for (const scene of scenes) {
      for (const id of idsOf(scene)) {
        expect(id).toBeDefined();
        expect(voiceText(id!)).toBeTruthy();
      }
    }
  });

  it('says what a beat that waits needs to tell a student who tapped wrongly', () => {
    for (const scene of scenes) {
      for (const beat of scene.waits ?? []) {
        expect(scene.hints?.[beat]?.caption).toBeTruthy();
      }
    }
  });

  it('uses every line it pays to record', () => {
    const used = new Set(scenes.flatMap(idsOf));
    // A worked solution's lines depend on which item it is, so these seeds need not reach them all.
    const worked = new Set(Object.keys(th.voice.worked).map((line) => `worked.${line}`));
    const unused = VOICE_TAKES.flatMap((take) =>
      Object.keys(th.voice[take]).map((line) => `${take}.${line}`),
    ).filter((id) => !used.has(id as VoiceId) && !worked.has(id));
    // No item reaches these yet: every addition clip is about dims that differ, and every det_area
    // clip has det > 0. The templates can still draw them, so they should not fall silent if one does.
    expect(unused).toEqual(['fit.add_ok', 'area.flip']);
  });

  it('was recorded from the lines as they are now', () => {
    const takes = recorded.takes as Partial<Record<VoiceTake, string>>;
    for (const take of VOICE_TAKES) expect(takes[take]).toBe(takeHash(take));
  });

  it('has every file it points to, of a length a person could say', () => {
    for (const take of VOICE_TAKES) {
      for (const line of Object.keys(th.voice[take])) {
        const file = recordedLine(`${take}.${line}` as VoiceId);
        expect(file, `${take}.${line}`).toBeDefined();
        expect(existsSync(join('public', file!.src))).toBe(true);
        expect(file!.ms).toBeGreaterThan(300);
        expect(file!.ms).toBeLessThan(8000);
      }
    }
  });
});
