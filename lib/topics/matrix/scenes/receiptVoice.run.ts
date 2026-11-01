import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'vitest';
import { th } from '@/lib/content/th';
import {
  VOICE_ID,
  VOICE_LINES,
  VOICE_MODEL,
  VOICE_PAUSE,
  VOICE_STABILITY,
  takeHash,
  takeText,
} from './receiptVoice.take';

// `npm run voice:receipt` with ELEVENLABS_API_KEY set: spends credits, so it stays out of `npm run check`.
// The raw take is saved before anything else, so cutting it again never costs a second recording, and
// nothing is asked of ElevenLabs when the lines have not changed.

const RAW_DIR = '.voice-raw';
const OUT_DIR = 'public/voice/receipt';
const MANIFEST = 'lib/topics/matrix/scenes/receiptVoice.json';
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

async function record(text: string): Promise<Take> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set');
  const account = await fetch(`${API}/user/subscription`, { headers: { 'xi-api-key': key } });
  if (account.ok) {
    const { character_count: used, character_limit: limit, tier } = await account.json();
    console.log(`plan ${tier}: ${limit - used} credits left, and this take is ${text.length}`);
    if (limit - used < text.length) throw new Error('not enough credits');
  } else {
    console.log(`could not read the balance (${account.status}), so going ahead`);
  }
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

it('records and cuts the receipt clip', async () => {
  const text = takeText();
  const hash = takeHash();
  mkdirSync(RAW_DIR, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const rawPath = join(RAW_DIR, `receipt-${hash}.json`);
  if (existsSync(rawPath)) {
    console.log('this take is already recorded, so no credits are spent');
  } else {
    writeFileSync(rawPath, JSON.stringify(await record(text)));
  }
  const take: Take = JSON.parse(readFileSync(rawPath, 'utf8'));
  const {
    characters,
    character_start_times_seconds: starts,
    character_end_times_seconds: ends,
  } = take.alignment;
  if (characters.join('') !== text) throw new Error('the timing does not match the text sent');

  // The whole take is levelled once, so that lines keep their loudness against each other.
  const mp3 = join(RAW_DIR, `receipt-${hash}.mp3`);
  const wav = join(RAW_DIR, `receipt-${hash}.wav`);
  writeFileSync(mp3, Buffer.from(take.audio_base64, 'base64'));
  execFileSync('ffmpeg', [
    ...['-v', 'error', '-y', '-i', mp3],
    ...['-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '44100', '-ac', '1', wav],
  ]);
  const silences = silencesIn(wav);
  const length = secondsOf(wav);

  const spoken = VOICE_LINES.map((line) => th.clip.receipt.voice[line]);
  const separator = ` ${VOICE_PAUSE} `.length;
  const offsets: number[] = [];
  spoken.forEach((line, index) => {
    offsets.push(index === 0 ? 0 : offsets[index - 1] + spoken[index - 1].length + separator);
    if (text.slice(offsets[index], offsets[index] + line.length) !== line) {
      throw new Error(`line ${index} is not where it should be`);
    }
  });

  // Each pause is found by where the timing puts it, then cut by the silence actually heard there.
  const pauses = spoken.slice(1).map((_, index) => {
    const from = ends[offsets[index] + spoken[index].length - 1] - SLACK_S;
    const to = starts[offsets[index + 1]] + SLACK_S;
    const [longest] = silences
      .filter(([start, end]) => end > from && start < to)
      .sort((a, b) => b[1] - b[0] - (a[1] - a[0]));
    if (!longest) throw new Error(`no pause heard after line ${index}`);
    return longest;
  });
  const opening = silences[0]?.[0] < 0.05 ? silences[0][1] - EDGE_S : 0;
  const closing = silences.at(-1);
  const finish = closing && closing[1] >= length - 0.1 ? closing[0] + EDGE_S : length;
  const cuts = spoken.map((_, index) => ({
    start: index === 0 ? Math.max(0, opening) : pauses[index - 1][1] - EDGE_S,
    end: index === spoken.length - 1 ? finish : pauses[index][0] + EDGE_S,
  }));

  const lines = Object.fromEntries(
    VOICE_LINES.map((line, index) => {
      const { start, end } = cuts[index];
      const seconds = end - start;
      if (seconds < 0.5 || seconds > 9) throw new Error(`${line} came out ${seconds} s long`);
      const name = `${line}-${hash}.mp3`;
      const fade = `afade=t=in:d=0.02,afade=t=out:st=${(seconds - 0.04).toFixed(3)}:d=0.04`;
      execFileSync('ffmpeg', [
        ...['-v', 'error', '-y', '-ss', start.toFixed(3), '-t', seconds.toFixed(3), '-i', wav],
        ...['-af', fade, '-ac', '1', '-ar', '44100', '-b:a', '64k', join(OUT_DIR, name)],
      ]);
      const ms = Math.round(secondsOf(join(OUT_DIR, name)) * 1000);
      let at = offsets[index];
      const phrases = spoken[index].split(' ').map((phrase) => {
        const label = `${phrase} @${(starts[at] - start).toFixed(2)}`;
        at += phrase.length + 1;
        return label;
      });
      console.log(`${line}: ${ms} ms | ${phrases.join(' | ')}`);
      return [line, { src: `/voice/receipt/${name}`, ms }];
    }),
  );
  rmSync(wav);

  const keep = new Set(VOICE_LINES.map((line) => `${line}-${hash}.mp3`));
  for (const file of readdirSync(OUT_DIR)) if (!keep.has(file)) rmSync(join(OUT_DIR, file));
  writeFileSync(MANIFEST, `${JSON.stringify({ take: hash, lines }, null, 2)}\n`);
  console.log(`${silences.length} silences in ${length.toFixed(1)} s, ${VOICE_LINES.length} lines`);
});
