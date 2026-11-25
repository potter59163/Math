import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { VoiceTake } from './voice';
import {
  VOICE_ID,
  VOICE_MODEL,
  VOICE_PAUSE,
  VOICE_STABILITY,
  linesOf,
  spokenOf,
  takeHash,
  takeText,
} from './voice.take';

// What `npm run voice` does for one topic. Each topic has its own takes, manifest and folder, so that
// recording one never re-records or moves a line of another. A raw take is saved before anything else,
// so cutting it again never costs a second recording, and a take whose lines and files are as recorded
// is left alone: nothing is asked of ElevenLabs, and no file is rewritten. Before anything is spent, the
// characters it would send are printed, and VOICE_DRY=1 stops there.

const RAW_DIR = '.voice-raw';
const API = 'https://api.elevenlabs.io/v1';

/** A hair of the pause on either side of a line, so that no breath or consonant is cut. */
const EDGE_S = 0.05;
/** How far the timing may be from the silence actually heard, going by the M09 take. */
const SLACK_S = 0.3;

export interface VoiceTopic {
  name: string;
  takes: readonly VoiceTake[];
  /** The manifest the app plays from, relative to the repository. */
  manifest: string;
  /** Where the cut lines go, inside public/, and so the start of each line's src. */
  folder: string;
}

interface Take {
  audio_base64: string;
  alignment: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  };
}

export interface Manifest {
  takes: Partial<Record<string, string>>;
  lines: Record<string, { src: string; ms: number }>;
}

export function readManifest(path: string): Manifest {
  if (!existsSync(path)) return { takes: {}, lines: {} };
  return JSON.parse(readFileSync(path, 'utf8')) as Manifest;
}

const rawPathOf = (take: VoiceTake) => join(RAW_DIR, `${take}-${takeHash(take)}.json`);

/** A take is as recorded when its hash and every one of its files are where the manifest says. */
export function isCurrent(take: VoiceTake, manifest: Manifest): boolean {
  if (manifest.takes[take] !== takeHash(take)) return false;
  return linesOf(take).every((line) => {
    const file = manifest.lines[`${take}.${line}`];
    return file !== undefined && existsSync(join('public', file.src));
  });
}

export type TakeWork = 'current' | 'cut' | 'record';

/** What each take needs: nothing, a new cut of a raw take already paid for, or a recording. */
export function workOf(take: VoiceTake, manifest: Manifest): TakeWork {
  if (isCurrent(take, manifest)) return 'current';
  return existsSync(rawPathOf(take)) ? 'cut' : 'record';
}

export interface Estimate {
  /** Characters of every take of the topic, as ElevenLabs counts them: the pauses included. */
  total: number;
  /** Characters of the spoken lines alone. */
  spoken: number;
  lines: number;
  /** The takes that would be recorded now, and what each would cost. */
  toRecord: { take: VoiceTake; characters: number }[];
  toCut: VoiceTake[];
}

/** Credits are characters sent. Nothing here calls ElevenLabs. */
export function estimate(topic: VoiceTopic, manifest = readManifest(topic.manifest)): Estimate {
  const work = topic.takes.map((take) => ({ take, work: workOf(take, manifest) }));
  return {
    total: topic.takes.reduce((sum, take) => sum + takeText(take).length, 0),
    spoken: topic.takes.reduce(
      (sum, take) => sum + spokenOf(take).reduce((a, line) => a + line.length, 0),
      0,
    ),
    lines: topic.takes.reduce((sum, take) => sum + linesOf(take).length, 0),
    toRecord: work
      .filter((entry) => entry.work === 'record')
      .map(({ take }) => ({ take, characters: takeText(take).length })),
    toCut: work.filter((entry) => entry.work === 'cut').map(({ take }) => take),
  };
}

export function describeEstimate(
  topic: VoiceTopic,
  { total, spoken, lines, toRecord, toCut }: Estimate,
) {
  const credits = toRecord.reduce((sum, { characters }) => sum + characters, 0);
  return [
    `${topic.name}: ${lines} lines in ${topic.takes.length} takes, ${spoken} characters spoken, ${total} with pauses`,
    ...toRecord.map(({ take, characters }) => `  record ${take}: ${characters} characters`),
    ...toCut.map((take) => `  cut ${take} again from its raw take: no credits`),
    `${topic.name}: this run would spend about ${credits} credits (characters)`,
  ].join('\n');
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

async function recordAndCut(topic: VoiceTopic, take: VoiceTake, manifest: Manifest) {
  const text = takeText(take);
  const hash = takeHash(take);
  const names = linesOf(take);
  const spoken = spokenOf(take);
  const outDir = join('public', topic.folder, take);
  mkdirSync(outDir, { recursive: true });

  const rawPath = rawPathOf(take);
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
    manifest.lines[`${take}.${line}`] = { src: `/${topic.folder}/${take}/${name}`, ms };
  }
  rmSync(wav);
  for (const file of readdirSync(outDir)) if (!keep.has(file)) rmSync(join(outDir, file));
  manifest.takes[take] = hash;
  // Written after every take, so that one failing leaves the ones before it usable.
  writeFileSync(topic.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
}

/** Records and cuts every take of the topic that has changed, after saying what it will spend. */
export async function recordTopic(topic: VoiceTopic): Promise<void> {
  const before = readManifest(topic.manifest);
  const plan = estimate(topic, before);
  console.log(describeEstimate(topic, plan));
  if (process.env.VOICE_DRY === '1') {
    console.log(`${topic.name}: dry run, so nothing is recorded or written`);
    return;
  }
  if (plan.toRecord.length === 0 && plan.toCut.length === 0) {
    console.log(`${topic.name}: every take is as recorded, so nothing is done`);
    return;
  }
  mkdirSync(RAW_DIR, { recursive: true });
  // The takes that are as recorded keep their lines and files exactly; the rest are cut anew.
  const manifest: Manifest = { takes: {}, lines: {} };
  for (const take of topic.takes) {
    if (isCurrent(take, before)) {
      manifest.takes[take] = before.takes[take];
      for (const line of linesOf(take)) {
        manifest.lines[`${take}.${line}`] = before.lines[`${take}.${line}`];
      }
    }
  }
  for (const take of topic.takes) {
    if (!isCurrent(take, before)) await recordAndCut(topic, take, manifest);
  }
  writeFileSync(topic.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `${topic.name}: ${Object.keys(manifest.lines).length} lines in ${topic.takes.length} takes`,
  );
}
