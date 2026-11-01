import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { th } from '@/lib/content/th';
import { RECEIPT_BEATS } from './receiptClip';
import { RECEIPT_VOICE, RECEIPT_VOICE_TAKE } from './receiptVoice';
import { VOICE_LINES, takeHash } from './receiptVoice.take';

describe('the receipt clip’s voice', () => {
  it('was recorded from the lines as they are now', () => {
    expect(RECEIPT_VOICE_TAKE).toBe(takeHash());
  });

  it('has a line for every beat', () => {
    for (const beat of RECEIPT_BEATS) expect(VOICE_LINES).toContain(beat);
  });

  it('has every file it points to, of a length a person could say', () => {
    for (const { src, ms } of Object.values(RECEIPT_VOICE)) {
      expect(existsSync(join('public', src))).toBe(true);
      expect(ms).toBeGreaterThan(800);
      expect(ms).toBeLessThan(8000);
    }
  });

  it('says no digit or Latin letter, since every student hears the same take', () => {
    for (const line of Object.values(th.clip.receipt.voice)) {
      expect(line).not.toMatch(/[0-9A-Za-z]/);
    }
  });
});
