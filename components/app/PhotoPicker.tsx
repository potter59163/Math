'use client';

import { useId, useState } from 'react';
import { buttonClass } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { shrinkPhoto } from '@/lib/client/photo';
import { th } from '@/lib/content/th';
import type { Account } from '@/lib/sync/types';
import { ProfilePicture } from './Avatar';
import { learner } from './useLearner';

/**
 * The student's own photo, changed or removed in Settings. Only they see it until they turn the switch
 * under it, which shows it beside their name on the leaderboard and is off for every new photo.
 */
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
      await send('PUT', await shrinkPhoto(file));
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
      {account.photoAt ? (
        <Toggle
          label={th.settings.photo.share}
          help={
            !account.showPhoto
              ? th.settings.photo.shareOff
              : account.showOnLeaderboard
                ? th.settings.photo.shareOn
                : th.settings.photo.shareOffBoard
          }
          checked={account.showPhoto ?? false}
          onChange={(showPhoto) => void learner.updateAccount({ showPhoto })}
        />
      ) : (
        <p className="text-sm text-muted">{th.settings.photo.note}</p>
      )}
      {state === 'failed' && (
        <p role="alert" className="text-sm text-warn">
          {th.settings.photo.failed}
        </p>
      )}
    </div>
  );
}
