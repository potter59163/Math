import { deviceSettings } from './settings';

// The short sounds of the app. Web Audio rather than an audio element, because feedback must not lag behind
// a tap, and they can overlap a clip's voice. Each is fetched once and then plays with no network at all.

const FILES = {
  correct: '/sfx/correct.mp3',
  wrong: '/sfx/wrong.mp3',
  streak: '/sfx/streak.mp3',
  done: '/sfx/done.mp3',
} as const;

export type SoundName = keyof typeof FILES;

let context: AudioContext | null = null;
const buffers = new Map<SoundName, AudioBuffer>();

async function load(audio: AudioContext, name: SoundName) {
  try {
    const response = await fetch(FILES[name]);
    buffers.set(name, await audio.decodeAudioData(await response.arrayBuffer()));
  } catch {
    // A sound that did not load is a lesson without that sound, and nothing more.
  }
}

export const sfx = {
  /** In a tap, because that is the only place a phone lets sound begin. */
  unlock() {
    if (context || typeof AudioContext === 'undefined') return;
    context = new AudioContext();
    void context.resume();
    for (const name of Object.keys(FILES) as SoundName[]) void load(context, name);
  },
  play(name: SoundName) {
    const buffer = buffers.get(name);
    if (!context || !buffer || !deviceSettings.get().sound) return;
    // A phone can suspend it again when a call or another app has taken the sound.
    if (context.state !== 'running') void context.resume();
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start();
  },
};
