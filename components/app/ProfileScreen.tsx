'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { LoadingScreen } from '@/components/learn/LoadingScreen';
import { LinkButton } from '@/components/ui/Button';
import { BoltIcon, CheckIcon, FlameIcon, StarIcon } from '@/components/ui/Icons';
import { CONFIG } from '@/lib/config';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { Profile } from '@/lib/director/types';
import { lastDays, streakOf } from '@/lib/learner/activity';
import { skillStateOf } from '@/lib/learner/profile';
import { mapOf } from '@/lib/learner/progress';
import { badgesOf, type Badge } from '@/lib/practice/rewards';
import { testBlock, type AssessmentStatus } from '@/lib/sync/assessment';
import { CATALOG } from '@/lib/topics/matrix/misconceptions';
import { skillById } from '@/lib/topics/matrix/skills';
import { Avatar } from './Avatar';
import { useLearner, useRequiredProfile } from './useLearner';

function Tile({ icon, label, value }: { icon?: ReactNode; label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-2xl border border-line bg-surface p-3 text-center">
      <span className="flex items-center gap-1 font-matrix text-2xl font-bold tabular-nums">
        {icon}
        {value}
      </span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-bold">{title}</h2>
      {children}
    </section>
  );
}

/** Monday is 0. The day name comes from the date alone, so it needs no clock and no locale. */
function weekdayOf(day: string): number {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
}

function WeekBars({ profile, now }: { profile: Profile; now: number }) {
  const days = lastDays(profile.activity, now, 7);
  const most = Math.max(CONFIG.dailyGoalItems, ...days.map(({ items }) => items));
  return (
    <ol className="grid h-36 grid-cols-7 gap-2 rounded-2xl border border-line bg-surface p-3">
      {days.map(({ day, items }) => {
        const name = th.profile.days[weekdayOf(day)];
        return (
          <li
            key={day}
            aria-label={fillTokens(th.profile.weekLabel, { day: name, n: String(items) })}
            className="flex min-w-0 flex-col items-center justify-end gap-1"
          >
            <span className="relative w-full flex-1 overflow-hidden rounded-lg bg-sunken">
              <span
                className="absolute inset-0 origin-bottom rounded-lg bg-brand"
                style={{ transform: `scaleY(${items / most})` }}
              />
            </span>
            <span className="text-xs text-muted">{name}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Mastery({ profile }: { profile: Profile }) {
  return (
    <ul className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3">
      {mapOf(profile)
        .flatMap(({ skills }) => skills)
        .map(({ id, status }) => {
          const percent = Math.round(skillStateOf(profile, id).pKnown * 100);
          const shown = status === 'passed' ? 100 : profile.skills[id] ? percent : 0;
          return (
            <li key={id} className="flex items-center gap-2 text-sm">
              <span className="w-32 shrink-0 truncate">{skillById(id).nameTh}</span>
              <span
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={shown}
                aria-label={skillById(id).nameTh}
                className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-sunken"
              >
                <span
                  className={`block h-full origin-left rounded-full ${status === 'passed' ? 'bg-good' : 'bg-brand'}`}
                  style={{ transform: `scaleX(${shown / 100})` }}
                />
              </span>
              <span className="w-10 shrink-0 text-right font-matrix text-muted tabular-nums">
                {shown}%
              </span>
            </li>
          );
        })}
    </ul>
  );
}

function badgeLabel(badge: Badge): string {
  return badge.kind === 'fixed'
    ? th.summary.badgeFixed
    : fillTokens(th.summary.unitPassed, { n: String(badge.unit) });
}

function Tests({ itemsDone }: { itemsDone: number }) {
  const [status, setStatus] = useState<AssessmentStatus | null>(null);
  useEffect(() => {
    let live = true;
    void fetch('/api/assessment/status')
      .then((response) => (response.ok ? (response.json() as Promise<AssessmentStatus>) : null))
      .then((data) => {
        if (live) setStatus(data);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const line = (phase: 'pre' | 'post', label: string) => {
    const result = status?.[phase];
    const blocked = testBlock(phase, itemsDone);
    return (
      <li className="flex min-h-11 items-center justify-between gap-2">
        <span className="font-medium">{label}</span>
        {result ? (
          <span className="font-matrix text-sm font-semibold tabular-nums">
            {fillTokens(th.profile.score, {
              score: String(result.score),
              total: String(result.total),
            })}
          </span>
        ) : blocked ? (
          <span className="text-sm text-muted">
            {fillTokens(th.profile.testBlocked[blocked], { n: String(CONFIG.postTestAfterItems) })}
          </span>
        ) : (
          <LinkButton
            href={`/test/${phase}`}
            variant="secondary"
            size="compact"
            className="text-sm"
          >
            {th.profile.take}
          </LinkButton>
        )}
      </li>
    );
  };

  const gain = status?.pre && status.post ? status.post.score - status.pre.score : null;
  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <ul className="flex flex-col gap-1">
        {line('pre', th.profile.pre)}
        {line('post', th.profile.post)}
      </ul>
      {gain !== null && gain > 0 && (
        <p className="mt-1 font-semibold text-good">
          {fillTokens(th.profile.improved, { points: String(gain) })}
        </p>
      )}
    </div>
  );
}

export function ProfileScreen() {
  const profile = useRequiredProfile();
  const { mode, account } = useLearner();
  const [now] = useState(() => Date.now());
  if (!profile) return <LoadingScreen />;

  const badges = badgesOf(profile);
  const fixed = CATALOG.filter(({ id }) => profile.misconceptions[id]?.status === 'resolved');
  const open = CATALOG.filter(({ id }) => {
    const status = profile.misconceptions[id]?.status;
    return status === 'suspected' || status === 'active';
  });

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-4">
      <header className="flex items-center gap-3">
        <Avatar avatar={account?.avatar ?? 'bracket'} className="size-16 text-2xl" />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">
            {account?.displayName ?? th.profile.guestName}
          </h1>
          <p className="text-sm text-muted">{th.profile.title}</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <Tile
          icon={<BoltIcon className="size-5 text-xp" />}
          label={th.profile.stats.xp}
          value={profile.xp}
        />
        <Tile
          icon={<FlameIcon className="size-5 text-flame" />}
          label={th.profile.stats.streak}
          value={streakOf(profile.activity, now)}
        />
        <Tile label={th.profile.stats.items} value={profile.itemsDone} />
        <Tile label={th.profile.stats.bestCombo} value={profile.bestCombo} />
      </div>

      <Section title={th.profile.week}>
        <WeekBars profile={profile} now={now} />
      </Section>

      <Section title={th.profile.badges}>
        {badges.length === 0 ? (
          <p className="text-sm text-muted">{th.profile.badgesNone}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {badges.map((badge) => (
              <li
                key={badgeLabel(badge)}
                className="flex items-center gap-1 rounded-full bg-xp-soft px-3 py-1 text-sm font-semibold text-xp"
              >
                <StarIcon className="size-4 shrink-0" />
                {badgeLabel(badge)}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={th.profile.mastery}>
        <Mastery profile={profile} />
      </Section>

      <Section title={th.profile.fixed}>
        {fixed.length === 0 ? (
          <p className="text-sm text-muted">{th.profile.fixedNone}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {fixed.map(({ id, nameTh }) => (
              <li key={id} className="flex items-center gap-2">
                <CheckIcon className="size-5 shrink-0 text-good" />
                {nameTh}
              </li>
            ))}
          </ul>
        )}
        {open.length > 0 && (
          <p className="text-sm text-muted">
            {th.profile.open}: {open.map(({ id }) => th.misconceptionShort[id]).join(', ')}
          </p>
        )}
      </Section>

      <Section title={th.profile.tests}>
        {mode === 'account' ? (
          <Tests itemsDone={profile.itemsDone} />
        ) : (
          <p className="text-sm text-muted">{th.profile.guestTests}</p>
        )}
      </Section>
    </div>
  );
}
