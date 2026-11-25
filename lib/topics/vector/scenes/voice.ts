import { CONFIG } from '@/lib/config';
import { th } from '@/lib/content/th';
import type { VoiceTopic } from '@/lib/topics/matrix/scenes/voice.record';
import {
  VOICE_TAIL_MS,
  recordedLine,
  voiceText,
  type VoiceId,
  type VoiceTake,
} from '@/lib/topics/matrix/scenes/voice';

// The voice of the vector clips. Their takes are the ones of th.voice that start with v_, recorded into
// their own manifest (./voice.json) and folder (public/voice/vector/), so no matrix line is touched.
// Until Potter records them, a beat lasts as long as its line is expected to take, so that the caption
// can be read and the clip keeps the length it will have once it speaks.

export type { VoiceId };

export const VECTOR_TAKE_PREFIX = 'v_';

export const isVectorTake = (take: string): boolean => take.startsWith(VECTOR_TAKE_PREFIX);

export const VECTOR_TAKES = (Object.keys(th.voice) as VoiceTake[]).filter(isVectorTake);

/** Where `npm run voice -- vector` puts what it records, apart from every matrix line. */
export const VECTOR_VOICE: VoiceTopic = {
  name: 'vector',
  takes: VECTOR_TAKES,
  manifest: 'lib/topics/vector/scenes/voice.json',
  folder: 'voice/vector',
};

// Thai vowels above and below the line and tone marks take no time of their own.
const THAI_MARKS = /[ัิ-ฺ็-๎]/g;

/**
 * What a line will take to say, from the matrix takes: their median is 116 ms a letter and the slowest
 * tenth 137 ms. This takes the slow end, so a clip is never planned shorter than it will play.
 */
export const MS_PER_LETTER = 135;

export function estimatedMs(id: VoiceId): number {
  return voiceText(id).replace(THAI_MARKS, '').length * MS_PER_LETTER;
}

/** What a line takes: its recording if there is one, or else what it is expected to take. */
export function lineMs(id: VoiceId): number {
  return recordedLine(id)?.ms ?? estimatedMs(id);
}

/** Each beat lasts long enough to watch what it shows, and never less than its line takes to say. */
export function voicedBeats<Beat extends string>(
  base: Partial<Record<Beat, number>>,
  voice: Partial<Record<Beat, VoiceId>>,
): Partial<Record<Beat, number>> {
  const timed = { ...base };
  for (const beat of Object.keys(voice) as Beat[]) {
    const id = voice[beat];
    if (!id) continue;
    const spoken = Math.min(lineMs(id) + VOICE_TAIL_MS, CONFIG.scenes.maxBeatMs);
    timed[beat] = Math.max(base[beat] ?? 0, spoken);
  }
  return timed;
}
