// One audio element for every clip, because a phone allows sound only on an element a tap has played.

/** A twentieth of a second of nothing, for that first tap. */
const SILENCE =
  'data:audio/mpeg;base64,SUQzBAAAAAAAIlRTU0UAAAAOAAADTGF2ZjYwLjMuMTAwAAAAAAAAAAAAAAD/8xDEAAAAA0gAAAAATEFNRTMuOTkuNVVVVf/zEsQNAAADSAAAAABVVVVVVVVVVVVVVVVVVf/zEMQbAAADSAAAAABVVVVVVVVVVVVVVVVV//MQxCgAAANIAAAAAFVVVVVVVVVVVVVVVVU=';

let element: HTMLAudioElement | null = null;
let unlocked = false;

function audio() {
  element ??= new Audio();
  return element;
}

export const clipVoice = {
  play(src: string) {
    const player = audio();
    // The same line asked for twice before it has begun: reloading it would only throw the first away.
    const begun = player.paused || player.currentTime > 0;
    if (begun || player.getAttribute('src') !== src) player.src = src;
    unlocked = true;
    return player.play();
  },
  /** In a tap. An element that has played once from a tap can play again from anywhere. */
  unlock() {
    if (unlocked) return;
    unlocked = true;
    const player = audio();
    player.src = SILENCE;
    void player.play().catch(() => {});
  },
  isUnlocked: () => unlocked,
  pause() {
    element?.pause();
  },
  resume() {
    if (element?.src && !element.ended) void element.play().catch(() => {});
  },
  setMuted(muted: boolean) {
    audio().muted = muted;
  },
  isSpeaking() {
    return Boolean(element?.src && !element.paused && !element.ended && !element.muted);
  },
  /** Fetches a clip's lines ahead of time, so that a slow connection does not hold up the first of them. */
  warm(sources: string[]) {
    for (const src of sources) void fetch(src).catch(() => {});
  },
};
