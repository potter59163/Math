// A student's own profile picture, on its way from their device to their account. It is offered at
// the welcome and in Settings, and only that student ever sees it (SPEC §15).

/** Small enough that the picture leaves this device as about 20 KB, and sharp on a profile header. */
const PHOTO_SIZE = 256;

/**
 * The picture, cut square from its middle and made small here, so a full photo with its EXIF (place,
 * time, camera) never leaves the device: only the pixels of a 256 px JPEG do.
 */
export async function shrinkPhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('shrinkPhoto: no canvas');
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    PHOTO_SIZE,
    PHOTO_SIZE,
  );
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('shrinkPhoto: no blob'))),
      'image/jpeg',
      0.85,
    ),
  );
}

/** Stores a picture already made small on the signed-in student's account, and says when it was set. */
export async function sendPhoto(photo: Blob): Promise<string> {
  const response = await fetch('/api/photo', {
    method: 'PUT',
    headers: { 'Content-Type': photo.type },
    body: photo,
  });
  if (!response.ok) throw new Error(String(response.status));
  const { photoAt } = (await response.json()) as { photoAt: string };
  return photoAt;
}
