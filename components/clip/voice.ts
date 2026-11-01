// One audio element for every line of every clip. A phone lets a page play sound only after a tap, and on an
// iPhone that permission stays with the element played in the tap, so this one outlives each clip.

let element: HTMLAudioElement | null = null;

function audio() {
  element ??= new Audio();
  return element;
}

export const clipVoice = {
  /** From the start of the line. Rejects if the device refuses, or when another line cuts in. */
  play(src: string) {
    const player = audio();
    // The same line asked for twice before it has begun: reloading it would only throw the first away.
    const begun = player.paused || player.currentTime > 0;
    if (begun || player.getAttribute('src') !== src) player.src = src;
    return player.play();
  },
  pause() {
    element?.pause();
  },
  /** Carries on with a paused line, and does not say a finished one again. */
  resume() {
    if (element?.src && !element.ended) void element.play().catch(() => {});
  },
  setMuted(muted: boolean) {
    audio().muted = muted;
  },
  /** Whether a line can still be heard, so that a clip does not move on in the middle of a word. */
  isSpeaking() {
    return Boolean(element?.src && !element.paused && !element.ended && !element.muted);
  },
  /** Fetches lines ahead of time, so that each one starts as its beat does. */
  warm(sources: string[]) {
    for (const src of sources) void fetch(src).catch(() => {});
  },
};
