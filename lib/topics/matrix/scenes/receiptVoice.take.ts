import { createHash } from 'node:crypto';
import { th } from '@/lib/content/th';
import type { VoiceLine } from './receiptVoice';

// What goes to ElevenLabs for the receipt clip: every line in one take, so that they sound like one person
// speaking, with a pause to cut them apart at. The voice and settings are those of the M09 clip Potter
// listened to and accepted. The hash lets a test notice a line changed without being recorded again.

export const VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb';
export const VOICE_MODEL = 'eleven_v3';
export const VOICE_STABILITY = 0;
export const VOICE_PAUSE = '[pause]';

export const VOICE_LINES = Object.keys(th.clip.receipt.voice) as VoiceLine[];

export function takeText(): string {
  return VOICE_LINES.map((line) => th.clip.receipt.voice[line]).join(` ${VOICE_PAUSE} `);
}

export function takeHash(): string {
  return createHash('sha256')
    .update(JSON.stringify([VOICE_ID, VOICE_MODEL, VOICE_STABILITY, takeText()]))
    .digest('hex')
    .slice(0, 12);
}
