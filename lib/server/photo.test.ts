import { describe, expect, it } from 'vitest';
import { MAX_PHOTO_BYTES, photoTypeOf } from './photo';

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => new TextEncoder().encode(text);

describe('photoTypeOf', () => {
  it('knows a picture by its first bytes', () => {
    expect(photoTypeOf(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))).toBe('image/jpeg');
    expect(photoTypeOf(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe('image/png');
    expect(photoTypeOf(new Uint8Array([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBPVP8 ')]))).toBe(
      'image/webp',
    );
  });

  it('turns away anything else, whatever it claims to be', () => {
    expect(photoTypeOf(ascii('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(photoTypeOf(ascii('<html><script>alert(1)</script></html>'))).toBeNull();
    expect(photoTypeOf(ascii('GIF89a'))).toBeNull();
    expect(photoTypeOf(bytes(0xff, 0xd8))).toBeNull();
    expect(photoTypeOf(bytes())).toBeNull();
  });

  it('leaves room for a small square picture and no more', () => {
    expect(MAX_PHOTO_BYTES).toBeGreaterThanOrEqual(100_000);
    expect(MAX_PHOTO_BYTES).toBeLessThanOrEqual(300_000);
  });
});
