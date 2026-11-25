'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { LoadingScreen } from '@/components/learn/LoadingScreen';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import { weekStartOf } from '@/lib/sync/leaderboard';
import type { BoardScope, LeaderboardEntry, LeaderboardResponse } from '@/lib/sync/types';
import { Avatar } from './Avatar';
import { Mascot } from './Mascot';
import { GoogleButton } from './SignInButtons';
import { useLearner, useRequiredProfile } from './useLearner';

// The weekly board as Potter chose it (25 Nov 2026): the student's own class first, a podium, their own
// place on top, the top ten and the places around them. Chosen names, avatars and XP only.

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const MEDAL: Record<number, string> = {
  1: 'bg-gold text-[#2a1e00]',
  2: 'bg-silver text-[#1b1e29]',
  3: 'bg-bronze text-[#2b1500]',
};

/** "เริ่มใหม่ในอีก 3 วัน", counted to Monday at midnight in Thailand. */
function resetsIn(weekStart: string, now: number): string {
  const left = Date.parse(weekStart) + 7 * DAY_MS - now;
  if (left <= HOUR_MS) return th.board.resetsSoon;
  if (left < DAY_MS) {
    return fillTokens(th.board.resetsInHours, { n: String(Math.ceil(left / HOUR_MS)) });
  }
  return fillTokens(th.board.resetsIn, { n: String(Math.ceil(left / DAY_MS)) });
}

/**
 * Places moved since this student last looked at this board this week: up is positive. Kept on this
 * device only, under their own id, so nothing about it is ever sent.
 */
function movedSinceLastTime(student: string, board: LeaderboardResponse): number | null {
  const key = `math:board:${student}:${board.scope}`;
  try {
    const last = JSON.parse(window.localStorage.getItem(key) ?? 'null') as {
      weekStart: string;
      rank: number;
    } | null;
    if (board.me) {
      window.localStorage.setItem(
        key,
        JSON.stringify({ weekStart: board.weekStart, rank: board.me.rank }),
      );
    }
    if (!board.me || !last || last.weekStart !== board.weekStart) return null;
    return last.rank - board.me.rank;
  } catch {
    return null;
  }
}

function Row({ entry }: { entry: LeaderboardEntry }) {
  const { rank, avatar, displayName, xp, isMe } = entry;
  return (
    <li
      aria-current={isMe ? 'true' : undefined}
      className={`flex min-h-14 items-center gap-3 rounded-lg px-2 py-2 ${isMe ? 'bg-marker-soft' : ''}`}
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

/** Second, first and third, standing on steps of their rank. */
function Podium({ top }: { top: LeaderboardEntry[] }) {
  const steps = [
    { entry: top[1], height: 'h-12' },
    { entry: top[0], height: 'h-16' },
    { entry: top[2], height: 'h-9' },
  ];
  return (
    <ol aria-label={th.board.top} className="grid grid-cols-3 items-end gap-2 text-center">
      {steps.map(({ entry, height }) => (
        <li
          key={`${entry.rank}:${entry.displayName}:${entry.xp}`}
          aria-current={entry.isMe ? 'true' : undefined}
          className="flex min-w-0 flex-col items-center gap-1"
        >
          <Avatar avatar={entry.avatar} className="size-12 text-xl" />
          <span className="w-full truncate text-sm font-semibold">
            {entry.displayName}
            {entry.isMe && <span className="sr-only"> ({th.board.you})</span>}
          </span>
          <span className="font-matrix text-sm font-bold text-xp tabular-nums">
            {fillTokens(th.board.xp, { xp: String(entry.xp) })}
          </span>
          <span
            className={`flex w-full items-start justify-center rounded-t-lg border border-b-0 border-line pt-1 ${height} ${
              entry.rank === 1 ? 'bg-marker-soft' : 'bg-surface'
            } ${entry.isMe ? 'ring-2 ring-cta-line' : ''}`}
          >
            <span
              className={`flex size-7 items-center justify-center rounded-full font-matrix text-sm font-bold ${MEDAL[entry.rank] ?? 'text-muted'}`}
            >
              {entry.rank}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Where this student stands: their rank, the gap to the place above, and how they moved. */
function MyPlace({
  me,
  above,
  moved,
}: {
  me: LeaderboardEntry;
  above: LeaderboardEntry | undefined;
  moved: number | null;
}) {
  return (
    <section
      aria-label={th.board.myRank}
      className="grid grid-cols-[auto_1fr] items-center gap-x-4 rounded-xl bg-marker-soft px-4 py-3"
    >
      <span className="row-span-2 font-matrix text-4xl leading-none font-semibold tabular-nums">
        {me.rank}
      </span>
      <p className="text-sm">
        <span className="font-semibold">{th.board.you}</span> ·{' '}
        <span className="font-matrix font-semibold text-xp tabular-nums">
          {fillTokens(th.board.xp, { xp: String(me.xp) })}
        </span>
        {moved !== null && moved !== 0 && (
          <span className={`ml-2 font-medium ${moved > 0 ? 'text-good' : 'text-muted'}`}>
            {moved > 0 ? '▲ ' : '▼ '}
            {fillTokens(moved > 0 ? th.board.movedUp : th.board.movedDown, {
              n: String(Math.abs(moved)),
            })}
          </span>
        )}
      </p>
      <p className="text-sm text-muted">
        {above
          ? fillTokens(th.board.behind, {
              rank: String(above.rank),
              xp: String(above.xp - me.xp),
            })
          : th.board.leading}
      </p>
    </section>
  );
}

function ScopeTabs({ value, onPick }: { value: BoardScope; onPick(scope: BoardScope): void }) {
  return (
    <div
      role="tablist"
      aria-label={th.board.scopeLabel}
      className="flex gap-1 rounded-xl bg-sunken p-1"
    >
      {(['class', 'all'] as const).map((scope) => {
        const selected = scope === value;
        return (
          <button
            key={scope}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onPick(scope)}
            className={`min-h-11 flex-1 touch-manipulation rounded-lg px-3 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              selected ? 'bg-surface text-ink shadow-[0_1px_3px_rgb(23_33_46/0.18)]' : 'text-muted'
            }`}
          >
            {th.board.scopes[scope]}
          </button>
        );
      })}
    </div>
  );
}

type Loaded =
  | { state: 'loading' }
  | { state: 'failed' }
  | { state: 'ok'; board: LeaderboardResponse; moved: number | null };

function Board({ student }: { student: string }) {
  // Null asks the server for its default: the class board when there is one.
  const [scope, setScope] = useState<BoardScope | null>(null);
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });

  const load = useCallback(
    async (wanted: BoardScope | null) => {
      try {
        const response = await fetch(
          wanted ? `/api/leaderboard?scope=${wanted}` : '/api/leaderboard',
        );
        if (!response.ok) throw new Error(String(response.status));
        const board = (await response.json()) as LeaderboardResponse;
        setLoaded({ state: 'ok', board, moved: movedSinceLastTime(student, board) });
      } catch {
        setLoaded({ state: 'failed' });
      }
    },
    [student],
  );

  useEffect(() => {
    // Fetching on mount and on a change of board is the point of this effect: the board lives on the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(scope);
  }, [load, scope]);

  if (loaded.state === 'loading') {
    return <p className="py-8 text-center text-muted">{th.common.loading}</p>;
  }
  if (loaded.state === 'failed') {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Mascot mood="oops" />
        <p>{th.board.failed}</p>
        <Button variant="secondary" onClick={() => void load(scope)}>
          {th.common.retry}
        </Button>
      </div>
    );
  }

  const { board, moved } = loaded;
  const { entries, around, me, hidden, hasClass } = board;
  const above = me ? [...entries, ...around].findLast((entry) => entry.xp > me.xp) : undefined;
  const podium = entries.length >= 3;
  return (
    <div className="flex flex-col gap-5">
      {hasClass && (
        <ScopeTabs
          value={board.scope}
          onPick={(next) => {
            if (next === board.scope) return;
            setLoaded({ state: 'loading' });
            setScope(next);
          }}
        />
      )}
      {hidden ? (
        <p className="rounded-xl bg-sunken px-4 py-3 text-sm">{th.board.hidden}</p>
      ) : me ? (
        <MyPlace me={me} above={above} moved={moved} />
      ) : (
        entries.length > 0 && (
          <p className="rounded-xl bg-sunken px-4 py-3 text-sm">{th.board.notYet}</p>
        )
      )}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Mascot mood="cheer" />
          <p>{th.board.empty}</p>
        </div>
      ) : (
        <>
          {podium && <Podium top={entries.slice(0, 3)} />}
          <ol className="flex flex-col">
            {entries.slice(podium ? 3 : 0).map((entry) => (
              <Row key={`${entry.rank}:${entry.displayName}:${entry.xp}`} entry={entry} />
            ))}
          </ol>
          {around.length > 0 && (
            <ol
              aria-label={th.board.around}
              className="flex flex-col border-t-2 border-dotted border-edge pt-2"
            >
              {around.map((entry) => (
                <Row key={`${entry.rank}:${entry.displayName}:${entry.xp}`} entry={entry} />
              ))}
            </ol>
          )}
        </>
      )}
      <p className="font-hand text-sm text-muted">{th.board.howTo}</p>
    </div>
  );
}

export function LeaderboardScreen() {
  const profile = useRequiredProfile();
  const { mode, configured } = useLearner();
  const [now] = useState(() => Date.now());
  if (!profile) return <LoadingScreen />;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col">
      <header className="flex flex-col gap-1 px-5 pt-6">
        <h1 className="text-3xl leading-snug font-semibold">
          <span className="marker">{th.board.title}</span>
        </h1>
        <p className="text-sm text-muted">{resetsIn(weekStartOf(now), now)}</p>
      </header>
      <main className="px-4 py-5">
        {mode === 'account' ? (
          <Board student={profile.student.id} />
        ) : (
          <div className="flex flex-col gap-4 px-1">
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
