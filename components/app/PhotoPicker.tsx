'use client';

import { useId, useState } from 'react';
import { buttonClass } from '@/components/ui/Button';
import { th } from '@/lib/content/th';
import type { Account } from '@/lib/sync/types';
import { ProfilePicture } from './Avatar';
import { learner } from './useLearner';

/** Small enough that the picture leaves this device as about 20 KB, and sharp on a profile header. */
const PHOTO_SIZE = 256;

/**
 * The picture, cut square from its middle and made small here, so a full photo with its EXIF (place,
 * time, camera) never leaves the device: only the pixels of a 256 px JPEG do.
 */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('shrink: no canvas');
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
      (blob) => (blob ? resolve(blob) : reject(new Error('shrink: no blob'))),
      'image/jpeg',
      0.85,
    ),
  );
}

/** The student's own photo, set or removed in Settings, and seen by them alone. */
export function PhotoPicker({ account }: { account: Account }) {
  const [state, setState] = useState<'idle' | 'saving' | 'failed'>('idle');
  const inputId = useId();

  const send = async (method: 'PUT' | 'DELETE', body?: Blob) => {
    setState('saving');
    try {
      const response = await fetch('/api/photo', {
        method,
        ...(body && { headers: { 'Content-Type': body.type }, body }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const { photoAt } = (await response.json()) as { photoAt: string | null };
      learner.photoChanged(photoAt);
      setState('idle');
    } catch {
      setState('failed');
    }
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      await send('PUT', await shrink(file));
    } catch {
      setState('failed');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-sans font-medium">{th.settings.photo.title}</h3>
      <div className="flex items-center gap-4">
        <ProfilePicture
          avatar={account.avatar}
          photoAt={account.photoAt}
          className="size-16 text-2xl"
        />
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor={inputId}
            aria-disabled={state === 'saving'}
            className={buttonClass({ variant: 'secondary', size: 'compact' }, 'cursor-pointer')}
          >
            {state === 'saving'
              ? th.settings.photo.saving
              : account.photoAt
                ? th.settings.photo.change
                : th.settings.photo.upload}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={state === 'saving'}
            onChange={(event) => {
              void pick(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          {account.photoAt && (
            <button
              type="button"
              disabled={state === 'saving'}
              onClick={() => void send('DELETE')}
              className="min-h-11 px-2 text-sm font-medium text-warn underline"
            >
              {th.settings.photo.remove}
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-muted">{th.settings.photo.note}</p>
      {state === 'failed' && (
        <p role="alert" className="text-sm text-warn">
          {th.settings.photo.failed}
        </p>
      )}
    </div>
  );
}
