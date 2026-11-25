import { th } from '@/lib/content/th';
import vectorRecorded from '../../vector/scenes/voice.json';
import recorded from './voice.json';

// The recorded voice of every clip. `npm run voice` writes the files these come from, so a line that has
// not been recorded yet simply has no sound, and the clip runs on its declared lengths. Each topic has
// its own manifest, so recording one never touches another's lines; their ids never clash, since vector
// takes start with v_.

export type VoiceTake = keyof typeof th.voice;

/** A line of `th.voice`, as "take.line". */
export type VoiceId = {
  [T in VoiceTake]: `${T}.${Extract<keyof (typeof th.voice)[T], string>}`;
}[VoiceTake];

export interface RecordedLine {
  src: string;
  ms: number;
}

const LINES: Partial<Record<string, RecordedLine>> = {
  ...(vectorRecorded.lines as Record<string, RecordedLine>),
  ...recorded.lines,
};

/** The breath after a line, before the clip moves on. */
export const VOICE_TAIL_MS = 450;

export function recordedLine(id: VoiceId): RecordedLine | undefined {
  return LINES[id];
}

/** The words of a line. */
export function voiceText(id: VoiceId): string {
  const [take, line] = id.split('.') as [VoiceTake, string];
  return (th.voice[take] as Record<string, string>)[line];
}

/** Each beat lasts long enough to watch what it shows, and never less than its line takes to say. */
export function timedBeats<Beat extends string>(
  base: Partial<Record<Beat, number>>,
  voice: Partial<Record<Beat, VoiceId>>,
): Partial<Record<Beat, number>> {
  const timed = { ...base };
  for (const beat of Object.keys(voice) as Beat[]) {
    const line = recordedLine(voice[beat] as VoiceId);
    if (line) timed[beat] = Math.max(base[beat] ?? 0, line.ms + VOICE_TAIL_MS);
  }
  return timed;
}
