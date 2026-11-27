// Pictures for the photo tests: two real ones, as small as an encoder makes them, and the opening bytes
// of files that state whatever size a test asks for, laid out as encoders lay them out.

const fromBase64 = (text: string) => new Uint8Array(Buffer.from(text, 'base64'));
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));
const be16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const be32 = (n: number) => [
  Math.floor(n / 2 ** 24) & 0xff,
  (n >> 16) & 0xff,
  (n >> 8) & 0xff,
  n & 0xff,
];
const le24 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff];

/** A real JPEG of 2 by 2 pixels (ffmpeg). */
export const TINY_JPEG = fromBase64(
  '/9j/4AAQSkZJRgABAgAAAQABAAD//gAPTGF2YzYwLjMuMTAwAP/bAEMACAoKCwoLDQ0NDQ0NEA8QEBAQEBAQEBAQEBISEhUVFRISEhAQEhIUFBUVFxcXFRUVFRcXGRkZHh4cHCMjJCsrM//EAEsAAQEAAAAAAAAAAAAAAAAAAAAFAQEAAAAAAAAAAAAAAAAAAAAGEAEAAAAAAAAAAAAAAAAAAAAAEQEAAAAAAAAAAAAAAAAAAAAA/8AAEQgAAgACAwEiAAIRAAMRAP/aAAwDAQACEQMRAD8AggHY6//Z',
);

/** A real PNG of 2 by 2 pixels (ffmpeg). */
export const TINY_PNG = fromBase64(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAABAAAAAQBPJcTWAAAAEElEQVR4nGMwSD0JRAwQCgAj8gV5degJeQAAAABJRU5ErkJggg==',
);

/** One frame header of a JPEG: 0xc0 for the plain kind, 0xc2 for the progressive one. */
export const jpegFrame = (width: number, height: number, kind = 0xc0) => [
  0xff,
  kind,
  ...be16(11),
  8,
  ...be16(height),
  ...be16(width),
  1,
  1,
  0x11,
  0,
];

/** A JPEG as far as its picture data: the opening mark, an application block, what `between` holds. */
export const jpegWith = (...between: number[][]) =>
  new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe0,
    ...be16(4),
    0x4a,
    0x46,
    ...between.flat(),
    0xff,
    0xda,
    0,
    2,
  ]);

export const jpegOf = (width: number, height: number, kind = 0xc0) =>
  jpegWith(jpegFrame(width, height, kind));

export const pngOf = (width: number, height: number) =>
  new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...be32(13),
    ...ascii('IHDR'),
    ...be32(width),
    ...be32(height),
    8,
    2,
    0,
    0,
    0,
  ]);

const webp = (chunk: string, body: number[]) =>
  new Uint8Array([
    ...ascii('RIFF'),
    0,
    0,
    0,
    0,
    ...ascii('WEBP'),
    ...ascii(chunk),
    body.length,
    0,
    0,
    0,
    ...body,
  ]);

/** The three kinds of WebP: lossy, lossless, and the extended one that carries the canvas size. */
export const webpLossyOf = (width: number, height: number) =>
  webp('VP8 ', [
    0,
    0,
    0,
    0x9d,
    0x01,
    0x2a,
    width & 0xff,
    (width >> 8) & 0x3f,
    height & 0xff,
    (height >> 8) & 0x3f,
  ]);

export const webpLosslessOf = (width: number, height: number) => {
  const bits = width - 1 + (height - 1) * 2 ** 14;
  return webp('VP8L', [
    0x2f,
    bits & 0xff,
    (bits >> 8) & 0xff,
    (bits >> 16) & 0xff,
    Math.floor(bits / 2 ** 24) & 0xff,
  ]);
};

export const webpExtendedOf = (width: number, height: number) =>
  webp('VP8X', [0, 0, 0, 0, ...le24(width - 1), ...le24(height - 1)]);
