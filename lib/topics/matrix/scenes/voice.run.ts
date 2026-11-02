import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'vitest';
import type { VoiceTake } from './voice';
import {
  VOICE_ID,
  VOICE_MODEL,
  VOICE_PAUSE,
  VOICE_STABILITY,
  VOICE_TAKES,
  linesOf,
  spokenOf,
  takeHash,
  takeText,
} from './voice.take';

// `npm run voice` with ELEVENLABS_API_KEY set: spends credits, so it stays out of `npm run check`. A raw
// take is saved before anything else, so cutting it again never costs a second recording, and nothing is
// asked of ElevenLabs for a take whose lines have not changed. Stopping part way loses nothing.

const RAW_DIR = '.voice-raw';
const OUT_DIR = 'public/voice';
const MANIFEST = 'lib/topics/matrix/scenes/voice.json';
const API = 'https://api.elevenlabs.io/v1';

/** A hair of the pause on either side of a line, so that no breath or consonant is cut. */
const EDGE_S = 0.05;
/** How far the timing may be from the silence actually heard, going by the M09 take. */
const SLACK_S = 0.3;

interface Take {
  audio_base64: string;
  alignment: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  };
}

interface Manifest {
  takes: Partial<Record<VoiceTake, string>>;
  lines: Record<string, { src: string; ms: number }>;
}

async function record(text: string): Promise<Take> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set');
  const response = await fetch(
    `${API}/text-to-speech/${VOICE_ID}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: VOICE_MODEL,
        voice_settings: { stability: VOICE_STABILITY, speed: 1 },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`ElevenLabs ${response.status}: ${(await response.text()).slice(0, 400)}`);
  }
  console.log(`credits charged: ${response.headers.get('character-cost') ?? 'unknown'}`);
  return response.json();
}

function silencesIn(file: string): [number, number][] {
  const { stderr } = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-i', file, '-af', 'silencedetect=noise=-40dB:d=0.12', '-f', 'null', '-'],
    { encoding: 'utf8' },
  );
  const starts = [...stderr.matchAll(/silence_start: ([\d.]+)/g)].map((match) => Number(match[1]));
  const ends = [...stderr.matchAll(/silence_end: ([\d.]+)/g)].map((match) => Number(match[1]));
  return starts.map((start, index) => [start, ends[index] ?? Infinity]);
}

function secondsOf(file: string): number {
  const output = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
    { encoding: 'utf8' },
  );
  return Number(output);
}

async function recordAndCut(take: VoiceTake, manifest: Manifest) {
  const text = takeText(take);
  const hash = takeHash(take);
  const names = linesOf(take);
  const spoken = spokenOf(take);
  const outDir = join(OUT_DIR, take);
  mkdirSync(outDir, { recursive: true });

  const rawPath = join(RAW_DIR, `${take}-${hash}.json`);
  if (existsSync(rawPath)) {
    console.log(`${take}: already recorded, so no credits are spent`);
  } else {
    console.log(`${take}: recording ${text.length} characters`);
    writeFileSync(rawPath, JSON.stringify(await record(text)));
  }
  const raw: Take = JSON.parse(readFileSync(rawPath, 'utf8'));
  const {
    characters,
    character_start_times_seconds: starts,
    character_end_times_seconds: ends,
  } = raw.alignment;
  if (characters.join('') !== text) throw new Error(`${take}: the timing does not match the text`);

  // The whole take is levelled once, so that lines keep their loudness against each other.
  const mp3 = join(RAW_DIR, `${take}-${hash}.mp3`);
  const wav = join(RAW_DIR, `${take}-${hash}.wav`);
  writeFileSync(mp3, Buffer.from(raw.audio_base64, 'base64'));
  execFileSync('ffmpeg', [
    ...['-v', 'error', '-y', '-i', mp3],
    ...['-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '44100', '-ac', '1', wav],
  ]);
  const silences = silencesIn(wav);
  const length = secondsOf(wav);

  const separator = ` ${VOICE_PAUSE} `.length;
  const offsets: number[] = [];
  spoken.forEach((line, index) => {
    offsets.push(index === 0 ? 0 : offsets[index - 1] + spoken[index - 1].length + separator);
    if (text.slice(offsets[index], offsets[index] + line.length) !== line) {
      throw new Error(`${take}: line ${index} is not where it should be`);
    }
  });

  // Each pause is found by where the timing puts it, then cut by the silence actually heard there.
  const pauses = spoken.slice(1).map((_, index): [number, number] => {
    const lineEnd = ends[offsets[index] + spoken[index].length - 1];
    const nextStart = starts[offsets[index + 1]];
    const [longest] = silences
      .filter(([start, end]) => end > lineEnd - SLACK_S && start < nextStart + SLACK_S)
      .sort((a, b) => b[1] - b[0] - (a[1] - a[0]));
    if (longest) return longest;
    console.log(`${take}: no pause heard after line ${index}, so cutting by the timing`);
    return [lineEnd, nextStart];
  });
  const opening = silences[0]?.[0] < 0.05 ? silences[0][1] - EDGE_S : 0;
  const closing = silences.at(-1);
  const finish = closing && closing[1] >= length - 0.1 ? closing[0] + EDGE_S : length;
  const cuts = spoken.map((_, index) => ({
    start: index === 0 ? Math.max(0, opening) : pauses[index - 1][1] - EDGE_S,
    end: index === spoken.length - 1 ? finish : pauses[index][0] + EDGE_S,
  }));

  const keep = new Set<string>();
  for (const [index, line] of names.entries()) {
    const { start, end } = cuts[index];
    const seconds = end - start;
    if (seconds < 0.3 || seconds > 9) throw new Error(`${take}.${line} is ${seconds} s long`);
    const name = `${line}-${hash}.mp3`;
    keep.add(name);
    const fade = `afade=t=in:d=0.02,afade=t=out:st=${(seconds - 0.04).toFixed(3)}:d=0.04`;
    execFileSync('ffmpeg', [
      ...['-v', 'error', '-y', '-ss', start.toFixed(3), '-t', seconds.toFixed(3), '-i', wav],
      ...['-af', fade, '-ac', '1', '-ar', '44100', '-b:a', '64k', join(outDir, name)],
    ]);
    const ms = Math.round(secondsOf(join(outDir, name)) * 1000);
    console.log(`${take}.${line}: ${ms} ms`);
    manifest.lines[`${take}.${line}`] = { src: `/voice/${take}/${name}`, ms };
  }
  rmSync(wav);
  for (const file of readdirSync(outDir)) if (!keep.has(file)) rmSync(join(outDir, file));
  manifest.takes[take] = hash;
  // Written after every take, so that one failing leaves the ones before it usable.
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
}

it('records and cuts every take that has changed', async () => {
  mkdirSync(RAW_DIR, { recursive: true });
  const manifest: Manifest = { takes: {}, lines: {} };
  for (const take of VOICE_TAKES) await recordAndCut(take, manifest);
  console.log(`${Object.keys(manifest.lines).length} lines in ${VOICE_TAKES.length} takes`);
});
