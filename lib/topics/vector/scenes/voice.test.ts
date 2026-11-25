import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '@/lib/config';
import { th } from '@/lib/content/th';
import type { AnyScene } from '@/lib/topics/matrix/scenes/types';
import matrixRecorded from '@/lib/topics/matrix/scenes/voice.json';
import {
  VOICE_TAIL_MS,
  recordedLine,
  type VoiceId,
  type VoiceTake,
} from '@/lib/topics/matrix/scenes/voice';
import { estimate } from '@/lib/topics/matrix/scenes/voice.record';
import { MATRIX_VOICE, VOICE_TAKES, takeHash } from '@/lib/topics/matrix/scenes/voice.take';
import { generate } from '../generators';
import { SKILLS, levelsOf } from '../skills';
import { VECTOR_UNITS, conceptScene, introScene, revealScene } from '.';
import { VECTOR_SCENE_COMBOS, vectorCaughtExample } from './catalog';
import vectorRecorded from './voice.json';
import { VECTOR_TAKES, VECTOR_VOICE, estimatedMs } from './voice';

const SEEDS = [1, 20261124, 7919, 31337, 4242, 99];

const scenes = [
  ...SEEDS.flatMap((seed) =>
    VECTOR_SCENE_COMBOS.map((combo) => vectorCaughtExample(combo, seed)?.spec),
  ),
  ...SEEDS.flatMap((seed) =>
    SKILLS.flatMap(({ id }) =>
      levelsOf(id).flatMap((level) => [
        conceptScene(id, { seed, level }),
        revealScene(generate({ skill: id, difficulty: level, seed })),
      ]),
    ),
  ),
  ...SEEDS.flatMap((seed) => VECTOR_UNITS.map((unit) => introScene(unit, { seed }))),
].filter((spec) => spec !== undefined) as unknown as AnyScene[];

function idsOf(scene: AnyScene): (VoiceId | undefined)[] {
  return [
    ...scene.beats.map((beat) => scene.voice[beat]),
    ...(scene.waits ?? []).map((beat) => scene.hints?.[beat]?.voice),
  ];
}

const linesOfTake = (take: VoiceTake) =>
  Object.entries(th.voice[take] as Record<string, string>).map(([line, text]) => ({
    id: `${take}.${line}` as VoiceId,
    text,
  }));

describe('the voice of the vector clips', () => {
  it('has its own takes, all named v_, none of them a matrix take', () => {
    expect(VECTOR_TAKES.length).toBeGreaterThan(0);
    for (const take of VECTOR_TAKES) expect(take.startsWith('v_')).toBe(true);
    for (const take of VOICE_TAKES) expect(take.startsWith('v_')).toBe(false);
    expect([...VOICE_TAKES, ...VECTOR_TAKES].sort()).toEqual(Object.keys(th.voice).sort());
  });

  it('says no digit or Latin letter, since every student hears the same take (SCENES §1)', () => {
    for (const take of VECTOR_TAKES) {
      for (const { text } of linesOfTake(take)) expect(text).not.toMatch(/[0-9๐-๙A-Za-z]/);
    }
  });

  it('never names the topic in English, nor any brand', () => {
    for (const take of VECTOR_TAKES) {
      for (const { text } of linesOfTake(take))
        expect(text).not.toMatch(/vector|เว็กเตอร์|เวคเตอร์/i);
    }
  });

  it('says each line within one beat, at the slow end of how the matrix takes were read', () => {
    for (const take of VECTOR_TAKES) {
      for (const { id } of linesOfTake(take)) {
        expect(estimatedMs(id) + VOICE_TAIL_MS, id).toBeLessThanOrEqual(CONFIG.scenes.maxBeatMs);
      }
    }
  });

  it('has a real line for every beat of every clip, and for every wrong tap', () => {
    for (const scene of scenes) {
      for (const id of idsOf(scene)) {
        expect(id).toBeDefined();
        expect(id!.startsWith('v_'), id).toBe(true);
      }
    }
  });

  it('uses every line it pays to record', () => {
    const used = new Set(scenes.flatMap(idsOf));
    const unused = VECTOR_TAKES.flatMap((take) => linesOfTake(take).map(({ id }) => id)).filter(
      (id) => !used.has(id),
    );
    expect(unused).toEqual([]);
  });

  it('comes to about the credits VECTORS §5 planned for', () => {
    const { total, lines } = estimate(VECTOR_VOICE);
    expect(lines).toBeLessThanOrEqual(180);
    expect(total).toBeLessThanOrEqual(8000);
  });
});

describe('the vector manifest, apart from the matrix one', () => {
  it('holds only vector takes, with their files under public/voice/vector/', () => {
    const { takes, lines } = vectorRecorded as {
      takes: Record<string, string>;
      lines: Record<string, { src: string; ms: number }>;
    };
    for (const take of Object.keys(takes)) {
      expect(VECTOR_TAKES).toContain(take);
      expect(takes[take]).toBe(takeHash(take as VoiceTake));
    }
    for (const [id, file] of Object.entries(lines)) {
      expect(id.startsWith('v_')).toBe(true);
      expect(file.src.startsWith('/voice/vector/')).toBe(true);
      expect(existsSync(join('public', file.src))).toBe(true);
    }
  });

  it('plays a vector line from its own manifest once it is recorded, and estimates it before', () => {
    for (const take of VECTOR_TAKES) {
      for (const { id } of linesOfTake(take)) {
        const recorded = (vectorRecorded.lines as Record<string, { src: string; ms: number }>)[id];
        expect(recordedLine(id)).toEqual(recorded);
      }
    }
  });
});

describe('the matrix voice, untouched by the vector topic', () => {
  // The manifest as Potter listened to and accepted it. Recording vectors must never change a byte.
  const MATRIX_MANIFEST_SHA256 = '574d0423538bcb5a0d35673e2ac495988e23418ac0b781825f1c9c2a4d9436dc';

  it('keeps its manifest byte for byte', () => {
    const file = readFileSync(MATRIX_VOICE.manifest);
    expect(createHash('sha256').update(file).digest('hex')).toBe(MATRIX_MANIFEST_SHA256);
  });

  it('keeps the same 13 takes, each as recorded, with every file where it was', () => {
    expect(VOICE_TAKES).toEqual([
      'table',
      'cell',
      'flip',
      'sheet',
      'fit',
      'bill',
      'order',
      'area',
      'cross',
      'sum',
      'undo',
      'recipe',
      'worked',
    ]);
    const { takes, lines } = matrixRecorded as {
      takes: Record<string, string>;
      lines: Record<string, { src: string; ms: number }>;
    };
    expect(Object.keys(takes)).toEqual(VOICE_TAKES);
    for (const take of VOICE_TAKES) expect(takes[take]).toBe(takeHash(take));
    for (const [id, file] of Object.entries(lines)) {
      expect(id.startsWith('v_')).toBe(false);
      expect(file.src.startsWith('/voice/vector/')).toBe(false);
      expect(recordedLine(id as VoiceId)).toEqual(file);
    }
  });

  it('has nothing to record, so `npm run voice` spends nothing on it and moves no file', () => {
    const plan = estimate(MATRIX_VOICE);
    expect(plan.toRecord).toEqual([]);
    expect(plan.toCut).toEqual([]);
  });
});
