"""Renders the app's short sounds into public/sfx. Needs numpy and ffmpeg: python3 scripts/make-sfx.py

They are synthesized here rather than downloaded, so that they carry no licence to keep track of, and can
be changed by changing a note. A right answer rises and rings, a wrong one falls softly and is quieter,
because a mistake is a normal part of learning and should not sound like a punishment.
"""

import pathlib
import subprocess

import numpy as np

RATE = 44100
OUT = pathlib.Path(__file__).parent.parent / 'public' / 'sfx'

# Each partial: (multiple of the note's pitch, loudness, how long it rings compared with the note).
MARIMBA = [(1, 1.0, 1.0), (2, 0.1, 0.6), (3.93, 0.32, 0.35), (9.2, 0.07, 0.12)]
BELL = [(1, 1.0, 1.0), (2.01, 0.42, 0.7), (3.01, 0.2, 0.5), (4.2, 0.1, 0.3), (5.4, 0.05, 0.2)]
SOFT = [(1, 1.0, 1.0), (2, 0.38, 0.7), (3, 0.14, 0.5), (4, 0.05, 0.35)]

E4, C4 = 329.63, 261.63
E5, G_SHARP5, B5, E6 = 659.25, 830.61, 987.77, 1318.51


def note(pitch, ring, partials, attack=0.003):
    seconds = max(ring * 5, 0.2)
    t = np.arange(int(seconds * RATE)) / RATE
    wave = sum(
        loudness * np.exp(-t / (ring * length)) * np.sin(2 * np.pi * pitch * multiple * t)
        for multiple, loudness, length in partials
    )
    return wave * np.minimum(1, t / attack)


def score(*events):
    """Each event: (when it starts in seconds, the note, how loud)."""
    length = max(int(at * RATE) + len(wave) for at, wave, _ in events)
    mix = np.zeros(length)
    for at, wave, loudness in events:
        start = int(at * RATE)
        mix[start : start + len(wave)] += wave * loudness
    return mix


def room(wave, wet=0.12, seconds=0.28):
    """A little air around a dry note, from a burst of noise that dies away."""
    noise = np.random.default_rng(7).standard_normal(int(seconds * RATE))
    tail = noise * np.exp(-np.arange(len(noise)) / (RATE * seconds / 5))
    tail /= np.sqrt(np.sum(tail**2))
    mixed = wet * np.convolve(wave, tail)
    mixed[: len(wave)] += wave
    return mixed


def finish(wave, peak_db, seconds):
    wave = wave[: int(seconds * RATE)]
    fade = int(0.03 * RATE)
    wave[-fade:] *= np.linspace(1, 0, fade)
    return wave / np.max(np.abs(wave)) * 10 ** (peak_db / 20)


SOUNDS = {
    'correct': finish(
        room(
            score(
                (0, note(E5, 0.14, MARIMBA), 0.8),
                (0.09, note(B5, 0.24, MARIMBA), 1.0),
                (0.09, note(B5 * 2, 0.16, BELL), 0.12),
            )
        ),
        -5,
        0.7,
    ),
    'wrong': finish(
        room(
            score(
                (0, note(E4, 0.09, SOFT, attack=0.006), 1.0),
                (0.12, note(C4, 0.13, SOFT, attack=0.006), 0.85),
            ),
            wet=0.06,
        ),
        -11,
        0.55,
    ),
    'streak': finish(
        room(
            score(
                (0, note(E5, 0.1, MARIMBA), 0.7),
                (0.07, note(G_SHARP5, 0.1, MARIMBA), 0.8),
                (0.14, note(B5, 0.12, MARIMBA), 0.9),
                (0.21, note(E6, 0.28, MARIMBA), 1.0),
                (0.21, note(E6, 0.34, BELL), 0.28),
            )
        ),
        -5,
        1.0,
    ),
    'done': finish(
        room(
            score(
                (0, note(E5, 0.16, MARIMBA), 0.7),
                (0.13, note(B5, 0.16, MARIMBA), 0.8),
                (0.26, note(E5, 0.4, BELL), 0.35),
                (0.26, note(G_SHARP5, 0.4, BELL), 0.35),
                (0.26, note(B5, 0.4, BELL), 0.4),
                (0.26, note(E6, 0.42, MARIMBA), 1.0),
            ),
            wet=0.16,
        ),
        -5,
        1.4,
    ),
}

OUT.mkdir(parents=True, exist_ok=True)
for name, wave in SOUNDS.items():
    subprocess.run(
        ['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(RATE), '-ac', '1', '-i', '-']
        + ['-b:a', '96k', str(OUT / f'{name}.mp3')],
        input=wave.astype(np.float32).tobytes(),
        check=True,
    )
    print(f'{name}: {len(wave) / RATE:.2f} s, {(OUT / f"{name}.mp3").stat().st_size} bytes')
