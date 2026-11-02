import { createHash } from 'node:crypto';
import { th } from '@/lib/content/th';
import type { VoiceTake } from './voice';

// What goes to ElevenLabs: each group of lines in one take, so that they sound like one person speaking,
// with a pause to cut them apart at. The voice and settings are those of the M09 clip Potter listened to
// and accepted. The hash lets a test notice a line changed without being recorded again.

export const VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb';
export const VOICE_MODEL = 'eleven_v3';
export const VOICE_STABILITY = 0;
export const VOICE_PAUSE = '[pause]';

export const VOICE_TAKES = Object.keys(th.voice) as VoiceTake[];

export function linesOf(take: VoiceTake): string[] {
  return Object.keys(th.voice[take]);
}

export function spokenOf(take: VoiceTake): string[] {
  return Object.values(th.voice[take]);
}

export function takeText(take: VoiceTake): string {
  return spokenOf(take).join(` ${VOICE_PAUSE} `);
}

export function takeHash(take: VoiceTake): string {
  return createHash('sha256')
    .update(JSON.stringify([VOICE_ID, VOICE_MODEL, VOICE_STABILITY, takeText(take)]))
    .digest('hex')
    .slice(0, 12);
}
