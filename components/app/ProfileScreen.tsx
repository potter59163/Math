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

function Stat({ icon, label, value }: { icon?: ReactNode; label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="flex items-center gap-1 font-matrix text-3xl leading-tight font-medium tabular-nums">
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
      <h2 className="text-lg">{title}</h2>
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
    <ol className="grid h-32 grid-cols-7 gap-2">
      {days.map(({ day, items }) => {
        const name = th.profile.days[weekdayOf(day)];
        return (
          <li
            key={day}
            aria-label={fillTokens(th.profile.weekLabel, { day: name, n: String(items) })}
            className="flex min-w-0 flex-col items-center justify-end gap-1"
          >
            <span className="flex w-full flex-1 items-end border-b-2 border-ink">
              {items > 0 && (
                <span
                  className="block w-full rounded-t border-2 border-b-0 border-cta-line bg-cta"
                  style={{ height: `${(items / most) * 100}%` }}
                />
              )}
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
    <ul className="flex flex-col gap-2">
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
                className="h-3 min-w-0 flex-1 overflow-hidden rounded-full border border-edge bg-surface"
              >
                <span
                  className={`block h-full origin-left ${status === 'passed' ? 'bg-good' : 'bg-brand'}`}
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
      <li className="flex min-h-12 items-center justify-between gap-2 border-b border-line">
        <span className="font-medium">{label}</span>
        {result ? (
          <span className="font-matrix text-sm font-medium tabular-nums">
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
    <div>
      <ul className="flex flex-col">
        {line('pre', th.profile.pre)}
        {line('post', th.profile.post)}
      </ul>
      {gain !== null && gain > 0 && (
        <p className="mt-2 font-semibold text-good">
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
    <main className="mx-auto flex w-full max-w-lg flex-col gap-7 px-5 py-6">
      <header className="flex items-center gap-3">
        <Avatar avatar={account?.avatar ?? 'bracket'} className="size-16 text-2xl" />
        <h1 className="min-w-0 truncate text-3xl leading-tight font-semibold">
          {account?.displayName ?? th.profile.guestName}
        </h1>
      </header>

      <div className="grid grid-cols-2 gap-x-3 gap-y-4 rounded-xl border-2 border-ink bg-surface p-4 shadow-[0_3px_0_var(--ink)]">
        <Stat
          icon={<BoltIcon className="size-6 text-xp" />}
          label={th.profile.stats.xp}
          value={profile.xp}
        />
        <Stat
          icon={<FlameIcon className="size-6 text-flame" />}
          label={th.profile.stats.streak}
          value={streakOf(profile.activity, now)}
        />
        <Stat label={th.profile.stats.items} value={profile.itemsDone} />
        <Stat label={th.profile.stats.bestCombo} value={profile.bestCombo} />
      </div>

      <Section title={th.profile.week}>
        <WeekBars profile={profile} now={now} />
      </Section>

      {mode === 'account' && (
        <Section title={th.profile.tests}>
          <Tests itemsDone={profile.itemsDone} />
        </Section>
      )}

      {badges.length > 0 && (
        <Section title={th.profile.badges}>
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
        </Section>
      )}

      {(fixed.length > 0 || open.length > 0) && (
        <Section title={th.profile.fixed}>
          <ul className="flex flex-col gap-1">
            {fixed.map(({ id, nameTh }) => (
              <li key={id} className="flex items-center gap-2">
                <CheckIcon className="size-5 shrink-0 text-good" />
                {nameTh}
              </li>
            ))}
          </ul>
          {open.length > 0 && (
            <p className="text-sm text-muted">
              {th.profile.open}: {open.map(({ id }) => th.misconceptionShort[id]).join(', ')}
            </p>
          )}
        </Section>
      )}

      <Section title={th.profile.mastery}>
        <Mastery profile={profile} />
      </Section>
    </main>
  );
}
