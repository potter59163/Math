'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { LoadingScreen } from '@/components/learn/LoadingScreen';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { LeaderboardEntry, LeaderboardResponse } from '@/lib/sync/types';
import { Avatar } from './Avatar';
import { Mascot } from './Mascot';
import { GoogleButton } from './SignInButtons';
import { useLearner, useRequiredProfile } from './useLearner';

const MEDAL: Record<number, string> = {
  1: 'bg-gold text-[#2a1e00]',
  2: 'bg-silver text-[#1b1e29]',
  3: 'bg-bronze text-[#2b1500]',
};

function Row({ entry }: { entry: LeaderboardEntry }) {
  const { rank, avatar, displayName, xp, isMe } = entry;
  return (
    <li
      aria-current={isMe ? 'true' : undefined}
      className={`flex min-h-14 items-center gap-3 border-b border-line px-2 py-2 ${
        isMe ? 'bg-marker-soft' : ''
      }`}
    >
      <span
        aria-label={fillTokens(th.board.rank, { n: String(rank) })}
        className={`flex size-8 shrink-0 items-center justify-center rounded-full font-matrix text-sm font-bold tabular-nums ${
          MEDAL[rank] ?? 'text-muted'
        }`}
      >
        {rank}
      </span>
      <Avatar avatar={avatar} />
      <span className="min-w-0 flex-1 truncate font-semibold">
        {displayName}
        {isMe && <span className="ml-1 text-sm font-normal text-muted">({th.board.you})</span>}
      </span>
      <span className="shrink-0 font-matrix text-sm font-bold text-xp tabular-nums">
        {fillTokens(th.board.xp, { xp: String(xp) })}
      </span>
    </li>
  );
}

type Loaded =
  { state: 'loading' } | { state: 'failed' } | { state: 'ok'; board: LeaderboardResponse };

function Board() {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/leaderboard');
      if (!response.ok) throw new Error(String(response.status));
      setLoaded({ state: 'ok', board: (await response.json()) as LeaderboardResponse });
    } catch {
      setLoaded({ state: 'failed' });
    }
  }, []);

  useEffect(() => {
    // Fetching on mount is the point of this effect: the board lives on the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (loaded.state === 'loading') {
    return <p className="py-8 text-center text-muted">{th.common.loading}</p>;
  }
  if (loaded.state === 'failed') {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Mascot mood="oops" />
        <p>{th.board.failed}</p>
        <Button variant="secondary" onClick={load}>
          {th.common.retry}
        </Button>
      </div>
    );
  }

  const { entries, me, hidden } = loaded.board;
  const meIsBelow = me !== null && !entries.some(({ isMe }) => isMe);
  return (
    <div className="flex flex-col gap-3">
      {hidden && <p className="rounded-xl bg-sunken px-4 py-2 text-sm">{th.board.hidden}</p>}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Mascot mood="cheer" />
          <p>{th.board.empty}</p>
        </div>
      ) : (
        <ol className="flex flex-col">
          {entries.map((entry) => (
            <Row key={`${entry.rank}:${entry.displayName}:${entry.xp}`} entry={entry} />
          ))}
        </ol>
      )}
      {meIsBelow && me && (
        <ol>
          <Row entry={me} />
        </ol>
      )}
      {!me && !hidden && entries.length > 0 && (
        <p className="text-center text-sm text-muted">{th.board.notYet}</p>
      )}
    </div>
  );
}

export function LeaderboardScreen() {
  const profile = useRequiredProfile();
  const { mode, configured } = useLearner();
  if (!profile) return <LoadingScreen />;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col">
      <header className="px-5 pt-6">
        <h1 className="text-3xl leading-snug font-semibold">
          <span className="marker">{th.board.title}</span>
        </h1>
        <p className="text-sm text-muted">{th.board.resets}</p>
      </header>
      <main className="px-3 py-4">
        {mode === 'account' ? (
          <Board />
        ) : (
          <div className="flex flex-col gap-4 px-2">
            <div className="flex items-center gap-3">
              <Mascot className="size-14 shrink-0 -rotate-3" />
              <p className="font-hand text-lg leading-snug">{th.board.guest}</p>
            </div>
            {configured && <GoogleButton />}
          </div>
        )}
      </main>
    </div>
  );
}
