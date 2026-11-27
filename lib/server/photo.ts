import { randomBytes } from 'node:crypto';

// A student's own profile photo (Potter, 25 Nov 2026). The browser makes it small and square before it
// leaves the device (lib/client/photo.ts), so anything much bigger is not from this app.

/** A 256 px JPEG is about 20 KB; this leaves room for a busy picture and nothing like a full photo. */
export const MAX_PHOTO_BYTES = 200_000;

export type PhotoType = 'image/jpeg' | 'image/png' | 'image/webp';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function asciiAt(bytes: Uint8Array, from: number, text: string): boolean {
  return [...text].every((char, index) => bytes[from + index] === char.charCodeAt(0));
}

/** What the bytes are, by their first bytes rather than by what the request says they are. */
export function photoTypeOf(bytes: Uint8Array): PhotoType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.length >= PNG.length && PNG.every((byte, index) => bytes[index] === byte)) {
    return 'image/png';
  }
  if (bytes.length >= 12 && asciiAt(bytes, 0, 'RIFF') && asciiAt(bytes, 8, 'WEBP')) {
    return 'image/webp';
  }
  return null;
}

/**
 * The app's own pictures are 256 px a side. A far larger one did not come from it, and a file of a few
 * kilobytes can state a size that takes all the memory of the phone that tries to draw it. So a
 * picture that states more than this, or no size at all, is not kept, and is never handed to another
 * student's browser (app/api/photo).
 */
export const MAX_PHOTO_SIDE = 1024;

export interface PhotoSize {
  width: number;
  height: number;
}

const be16 = (bytes: Uint8Array, at: number) => bytes[at] * 0x100 + bytes[at + 1];
const be32 = (bytes: Uint8Array, at: number) => be16(bytes, at) * 0x10000 + be16(bytes, at + 2);
const le16 = (bytes: Uint8Array, at: number) => bytes[at] + bytes[at + 1] * 0x100;
const le24 = (bytes: Uint8Array, at: number) => le16(bytes, at) + bytes[at + 2] * 0x10000;

/** Blocks of a JPEG that are a marker and nothing more: the opening mark, restart marks, TEM. */
const jpegBare = (marker: number) =>
  marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);

/** Frame headers, which state the size. The same range holds three blocks that are something else. */
const jpegFrame = (marker: number) =>
  marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

/**
 * Walks the blocks before the picture data, as a decoder does. Should a file hold more than one frame
 * header, the largest counts: a small one put in front must not hide what a decoder might yet draw.
 */
function jpegSize(bytes: Uint8Array): PhotoSize | null {
  let width = 0;
  let height = 0;
  let at = 2;
  while (at + 1 < bytes.length) {
    const marker = bytes[at + 1];
    // Decoders pass over bytes that begin no block, and over the 0xff that pads one.
    if (bytes[at] !== 0xff || marker === 0xff || marker === 0x00) {
      at += 1;
      continue;
    }
    if (jpegBare(marker)) {
      at += 2;
      continue;
    }
    // The picture data, or the end of the file: every frame header has come by now.
    if (marker === 0xda || marker === 0xd9) break;
    if (at + 3 >= bytes.length) return null;
    const length = be16(bytes, at + 2);
    if (length < 2) return null;
    if (jpegFrame(marker)) {
      if (length < 7 || at + 8 >= bytes.length) return null;
      height = Math.max(height, be16(bytes, at + 5));
      width = Math.max(width, be16(bytes, at + 7));
    }
    at += 2 + length;
  }
  return { width, height };
}

/** The header block comes first in every PNG, at a fixed place. */
function pngSize(bytes: Uint8Array): PhotoSize | null {
  if (bytes.length < 24 || !asciiAt(bytes, 12, 'IHDR')) return null;
  return { width: be32(bytes, 16), height: be32(bytes, 20) };
}

/** A WebP begins with one of three blocks, and each states the size in its own way. */
function webpSize(bytes: Uint8Array): PhotoSize | null {
  if (asciiAt(bytes, 12, 'VP8 ')) {
    if (bytes.length < 30) return null;
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    return { width: le16(bytes, 26) % 0x4000, height: le16(bytes, 28) % 0x4000 };
  }
  if (asciiAt(bytes, 12, 'VP8L')) {
    if (bytes.length < 25 || bytes[20] !== 0x2f) return null;
    // Fourteen bits of width less one, then fourteen of height less one, lowest bits first.
    const low = le24(bytes, 21);
    return {
      width: (low % 0x4000) + 1,
      height: Math.floor(low / 0x4000) + (bytes[24] % 0x10) * 0x400 + 1,
    };
  }
  if (asciiAt(bytes, 12, 'VP8X')) {
    if (bytes.length < 30) return null;
    return { width: le24(bytes, 24) + 1, height: le24(bytes, 27) + 1 };
  }
  return null;
}

const STATED: Record<PhotoType, (bytes: Uint8Array) => PhotoSize | null> = {
  'image/jpeg': jpegSize,
  'image/png': pngSize,
  'image/webp': webpSize,
};

/**
 * The size a picture states in its own header, which is what a browser sets memory aside by. Null when
 * it states none, and a side of no pixels is none.
 */
export function photoSizeOf(bytes: Uint8Array, type: PhotoType): PhotoSize | null {
  const size = STATED[type](bytes);
  return size && size.width >= 1 && size.height >= 1 ? size : null;
}

/** A picture that states a size, and one this app could have made. */
export function photoFits(bytes: Uint8Array, type: PhotoType): boolean {
  const size = photoSizeOf(bytes, type);
  return size !== null && size.width <= MAX_PHOTO_SIDE && size.height <= MAX_PHOTO_SIDE;
}

/**
 * What a photo shown on the leaderboard is asked for by (app/api/photo/[key]): 128 random bits, so it
 * cannot be guessed, and it says nothing of whose photo it is. A user id never reaches another browser.
 */
export const PHOTO_KEY = /^[A-Za-z0-9_-]{22}$/;

export function newPhotoKey(): string {
  return randomBytes(16).toString('base64url');
}
