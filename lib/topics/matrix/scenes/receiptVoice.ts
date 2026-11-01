import type { th } from '@/lib/content/th';
import recorded from './receiptVoice.json';

export type VoiceLine = keyof typeof th.clip.receipt.voice;

/** Where each recorded line is and how long it lasts. `npm run voice:receipt` writes the file. */
export const RECEIPT_VOICE: Record<VoiceLine, { src: string; ms: number }> = recorded.lines;

export const RECEIPT_VOICE_TAKE = recorded.take;
