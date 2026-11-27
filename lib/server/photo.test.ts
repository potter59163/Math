import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  MAX_PHOTO_BYTES,
  MAX_PHOTO_SIDE,
  newPhotoKey,
  PHOTO_KEY,
  photoFits,
  photoSizeOf,
  photoTypeOf,
} from './photo';
import {
  jpegFrame,
  jpegOf,
  jpegWith,
  pngOf,
  TINY_JPEG,
  TINY_PNG,
  webpExtendedOf,
  webpLosslessOf,
  webpLossyOf,
} from './photo.samples';

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

describe('the key of a photo shown on the leaderboard', () => {
  it('is long, random, and made of what an address can carry as it is', () => {
    const keys = Array.from({ length: 200 }, newPhotoKey);
    for (const key of keys) {
      expect(key).toMatch(PHOTO_KEY);
      expect(encodeURIComponent(key)).toBe(key);
    }
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('is nothing a student id or a path could pass for', () => {
    for (const not of [
      '',
      'short',
      'a'.repeat(21),
      'a'.repeat(23),
      '4b6f0d0e-4c57-4d0a-9d3b-1c2f6a1c9a10',
      '../../../../../etc/pwd',
      'aaaaaaaaaaaaaaaaaaaaa/',
      'aaaaaaaaaaaaaaaaaaaaa.',
      '\u0e01'.repeat(22),
    ]) {
      expect(PHOTO_KEY.test(not)).toBe(false);
    }
  });
});

describe('photoSizeOf', () => {
  it('reads the size of real pictures', () => {
    expect(photoTypeOf(TINY_JPEG)).toBe('image/jpeg');
    expect(photoSizeOf(TINY_JPEG, 'image/jpeg')).toEqual({ width: 2, height: 2 });
    expect(photoTypeOf(TINY_PNG)).toBe('image/png');
    expect(photoSizeOf(TINY_PNG, 'image/png')).toEqual({ width: 2, height: 2 });
  });

  it('reads the size each kind of file states, however large', () => {
    expect(photoSizeOf(jpegOf(256, 256), 'image/jpeg')).toEqual({ width: 256, height: 256 });
    expect(photoSizeOf(jpegOf(640, 480, 0xc2), 'image/jpeg')).toEqual({ width: 640, height: 480 });
    expect(photoSizeOf(jpegOf(65535, 65535), 'image/jpeg')).toEqual({
      width: 65535,
      height: 65535,
    });
    expect(photoSizeOf(pngOf(256, 300), 'image/png')).toEqual({ width: 256, height: 300 });
    expect(photoSizeOf(pngOf(4_000_000_000, 7), 'image/png')).toEqual({
      width: 4_000_000_000,
      height: 7,
    });
    expect(photoSizeOf(webpLossyOf(256, 200), 'image/webp')).toEqual({ width: 256, height: 200 });
    expect(photoSizeOf(webpLossyOf(16383, 16383), 'image/webp')).toEqual({
      width: 16383,
      height: 16383,
    });
    expect(photoSizeOf(webpLosslessOf(256, 200), 'image/webp')).toEqual({
      width: 256,
      height: 200,
    });
    expect(photoSizeOf(webpLosslessOf(16384, 16384), 'image/webp')).toEqual({
      width: 16384,
      height: 16384,
    });
    expect(photoSizeOf(webpExtendedOf(256, 200), 'image/webp')).toEqual({
      width: 256,
      height: 200,
    });
    expect(photoSizeOf(webpExtendedOf(16_777_216, 3), 'image/webp')).toEqual({
      width: 16_777_216,
      height: 3,
    });
  });

  it('finds whatever JPEG size an encoder could state, wherever its frame header sits', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 65535 }),
        fc.integer({ min: 1, max: 65535 }),
        fc.constantFrom(0xc0, 0xc1, 0xc2, 0xc3, 0xc9, 0xca, 0xcf),
        fc.array(fc.integer({ min: 0, max: 254 }), { maxLength: 12 }),
        (width, height, kind, stray) => {
          // Decoders skip bytes that are no marker, so a size hidden behind some is still the size.
          const file = jpegWith(stray, jpegFrame(width, height, kind));
          expect(photoSizeOf(file, 'image/jpeg')).toEqual({ width, height });
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('is not fooled by a small frame header put in front of a large one', () => {
    const decoy = jpegWith(jpegFrame(16, 16), jpegFrame(30000, 20000));
    expect(photoSizeOf(decoy, 'image/jpeg')).toEqual({ width: 30000, height: 20000 });
    expect(photoFits(decoy, 'image/jpeg')).toBe(false);
  });

  it('does not take a table for a frame header, and finds no size where none is stated', () => {
    const tableOnly = jpegWith([0xff, 0xc4, 0, 11, 8, 0x40, 0, 0x40, 0, 1, 1, 0x11, 0]);
    expect(photoSizeOf(tableOnly, 'image/jpeg')).toBeNull();
    expect(
      photoSizeOf(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]), 'image/jpeg'),
    ).toBeNull();
    expect(photoSizeOf(new Uint8Array([0xff, 0xd8, 0xff]), 'image/jpeg')).toBeNull();
    // A header that says it is longer than the file, and one cut off inside the size.
    expect(
      photoSizeOf(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xff, 1]), 'image/jpeg'),
    ).toBeNull();
    expect(photoSizeOf(jpegOf(256, 256).slice(0, 14), 'image/jpeg')).toBeNull();
    // After the picture data has begun, nothing is a frame header any more.
    const late = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2, ...jpegFrame(64, 64)]);
    expect(photoSizeOf(late, 'image/jpeg')).toBeNull();
    expect(photoSizeOf(pngOf(256, 256).slice(0, 20), 'image/png')).toBeNull();
    const notHeaderFirst = pngOf(256, 256);
    notHeaderFirst.set([0x74, 0x45, 0x58, 0x74], 12);
    expect(photoSizeOf(notHeaderFirst, 'image/png')).toBeNull();
    expect(photoSizeOf(webpLossyOf(256, 256).slice(0, 26), 'image/webp')).toBeNull();
    const otherChunk = webpLossyOf(256, 256);
    otherChunk.set([0x41, 0x4c, 0x50, 0x48], 12);
    expect(photoSizeOf(otherChunk, 'image/webp')).toBeNull();
    const noStartCode = webpLossyOf(256, 256);
    noStartCode[23] = 0;
    expect(photoSizeOf(noStartCode, 'image/webp')).toBeNull();
  });

  it('never throws, whatever the bytes, and gives a whole size or none', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('image/jpeg', 'image/png', 'image/webp') as fc.Arbitrary<
          'image/jpeg' | 'image/png' | 'image/webp'
        >,
        fc.uint8Array({ maxLength: 80 }),
        fc.boolean(),
        (type, tail, marked) => {
          // Half of them begin like a JPEG, so the walk through its blocks is tried on nonsense too.
          const file = marked ? new Uint8Array([0xff, 0xd8, 0xff, ...tail]) : tail;
          const size = photoSizeOf(file, type);
          if (size !== null) {
            expect(Number.isInteger(size.width) && size.width >= 1).toBe(true);
            expect(Number.isInteger(size.height) && size.height >= 1).toBe(true);
          }
          expect(typeof photoFits(file, type)).toBe('boolean');
        },
      ),
      { numRuns: 3000 },
    );
  });
});

describe('photoFits', () => {
  it('takes the picture this app makes, with room to grow', () => {
    expect(MAX_PHOTO_SIDE).toBeGreaterThanOrEqual(512);
    expect(MAX_PHOTO_SIDE).toBeLessThanOrEqual(2048);
    expect(photoFits(TINY_JPEG, 'image/jpeg')).toBe(true);
    expect(photoFits(TINY_PNG, 'image/png')).toBe(true);
    expect(photoFits(jpegOf(256, 256), 'image/jpeg')).toBe(true);
    expect(photoFits(jpegOf(MAX_PHOTO_SIDE, MAX_PHOTO_SIDE), 'image/jpeg')).toBe(true);
    expect(photoFits(webpLossyOf(256, 256), 'image/webp')).toBe(true);
  });

  it('refuses a small file that states a size no phone could draw', () => {
    expect(photoFits(jpegOf(MAX_PHOTO_SIDE + 1, 16), 'image/jpeg')).toBe(false);
    expect(photoFits(jpegOf(16, MAX_PHOTO_SIDE + 1), 'image/jpeg')).toBe(false);
    expect(photoFits(jpegOf(65535, 65535), 'image/jpeg')).toBe(false);
    expect(photoFits(pngOf(50000, 50000), 'image/png')).toBe(false);
    expect(photoFits(pngOf(4_000_000_000, 1), 'image/png')).toBe(false);
    expect(photoFits(webpLossyOf(16383, 16383), 'image/webp')).toBe(false);
    expect(photoFits(webpLosslessOf(16384, 16384), 'image/webp')).toBe(false);
    expect(photoFits(webpExtendedOf(16_777_216, 16_777_216), 'image/webp')).toBe(false);
  });

  it('refuses a file that states no size, or none at all', () => {
    expect(photoSizeOf(jpegOf(0, 256), 'image/jpeg')).toBeNull();
    expect(photoSizeOf(pngOf(256, 0), 'image/png')).toBeNull();
    expect(photoFits(jpegOf(0, 256), 'image/jpeg')).toBe(false);
    expect(photoFits(jpegOf(256, 0), 'image/jpeg')).toBe(false);
    expect(photoFits(pngOf(0, 0), 'image/png')).toBe(false);
    expect(photoFits(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]), 'image/jpeg')).toBe(
      false,
    );
    expect(photoFits(new Uint8Array(), 'image/png')).toBe(false);
  });
});
