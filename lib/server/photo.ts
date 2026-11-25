// A student's own profile photo (Potter, 25 Nov 2026). The browser makes it small and square before it
// leaves the device (components/app/PhotoPicker.tsx), so anything much bigger is not from this app.

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
