'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Mascot } from '@/components/app/Mascot';
import { recommendationCopy } from '@/components/app/recommendationText';
import { useRequiredProfile } from '@/components/app/useLearner';
import { LinkButton } from '@/components/ui/Button';
import { BoltIcon, CheckIcon, FlameIcon } from '@/components/ui/Icons';
import { Filled, KeepWords } from '@/components/ui/KeepWords';
import { sfx } from '@/lib/client/sfx';
import { CONFIG } from '@/lib/config';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import { dayOf, streakOf } from '@/lib/learner/activity';
import { isOpen } from '@/lib/learner/misconceptionStatus';
import { mapOf } from '@/lib/learner/progress';
import { recommendationFor } from '@/lib/learner/recommend';
import { badgesOf, type Badge } from '@/lib/practice/rewards';
import { allMisconceptions, misconceptionShortOf, skillOf, unitOf } from '@/lib/topics';
import { LoadingScreen } from './LoadingScreen';

function Stat({ icon, label, value }: { icon?: ReactNode; label: string; value: string }) {
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

function badgeLabel(badge: Badge): string {
  return badge.kind === 'fixed'
    ? th.summary.badgeFixed
    : fillTokens(th.summary.unitPassed, { n: unitOf(badge.unit).label });
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg">{title}</h2>
      {children}
    </section>
  );
}

/**
 * What this student has to show for today (SPEC §4, §11), and what คิว suggests for next time. The
 * day's items and XP come from the daily activity, so a short session is not drowned in old totals.
 */
export function SummaryScreen() {
  const profile = useRequiredProfile();
  const [now] = useState(() => Date.now());
  const today = profile?.activity?.find(({ day }) => day === dayOf(now));
  const didSome = (today?.items ?? 0) > 0;
  useEffect(() => {
    if (didSome) sfx.play('done');
  }, [didSome]);
  if (!profile) return <LoadingScreen />;

  const items = today?.items ?? 0;
  const goal = CONFIG.dailyGoalItems;
  const passedSkills = mapOf(profile)
    .flatMap(({ skills }) => skills)
    .filter(({ status }) => status === 'passed')
    .map(({ id }) => skillOf(id).nameTh);
  const catalog = allMisconceptions();
  const fixed = catalog.filter(({ id }) => profile.misconceptions[id]?.status === 'resolved');
  // A pre-test flag on a skill not started yet is waiting, not being fixed (recommend.ts says the same).
  const fixing = catalog.filter(
    ({ id, skills }) =>
      isOpen(profile.misconceptions[id]) &&
      skills.some((skill) => (profile.skills[skill]?.attempts.length ?? 0) > 0),
  );
  const badges = badgesOf(profile);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-6 px-5 py-8">
      <header className="flex items-center gap-3">
        <Mascot className="size-16 shrink-0 -rotate-3" mood={didSome ? 'cheer' : 'happy'} />
        <h1 className="text-3xl font-semibold">
          <span className="marker">{th.summary.title}</span>
        </h1>
      </header>

      {didSome ? (
        <div className="flex flex-col gap-3 rounded-xl border-2 border-ink bg-surface p-4 shadow-[0_3px_0_var(--ink)]">
          <div className="grid grid-cols-3 gap-3">
            <Stat label={th.summary.itemsToday} value={String(items)} />
            <Stat
              icon={<BoltIcon className="size-5 text-xp" />}
              label={th.summary.xpToday}
              value={`+${today?.xp ?? 0}`}
            />
            <Stat
              icon={<FlameIcon className="size-5 text-flame" />}
              label={th.summary.streak}
              value={String(streakOf(profile.activity, now))}
            />
          </div>
          <span
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={goal}
            aria-valuenow={Math.min(items, goal)}
            aria-label={th.learn.dailyGoal}
            className="h-3 overflow-hidden rounded-full border border-edge bg-canvas"
          >
            <span
              className="block h-full origin-left bg-cta"
              style={{ transform: `scaleX(${Math.min(items, goal) / goal})` }}
            />
          </span>
        </div>
      ) : (
        <p className="font-hand text-lg text-muted">{th.summary.nothingYet}</p>
      )}

      {badges.length > 0 && (
        <Section title={th.summary.badges}>
          <ul className="flex flex-wrap gap-2">
            {badges.map((badge) => (
              <li
                key={badgeLabel(badge)}
                className="flex items-center gap-1 rounded-full bg-good-soft px-3 py-1 text-sm font-semibold text-good"
              >
                <CheckIcon className="size-4 shrink-0" />
                {badgeLabel(badge)}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {passedSkills.length > 0 && (
        <Section title={th.summary.passed}>
          <ul className="flex flex-wrap gap-1.5">
            {passedSkills.map((name) => (
              <li
                key={name}
                className="inline-flex items-center gap-1 rounded-full border border-line bg-good-soft px-3 py-0.5 text-sm"
              >
                <CheckIcon className="size-3.5 shrink-0 text-good" />
                <KeepWords text={name} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(fixed.length > 0 || fixing.length > 0) && (
        <Section title={th.summary.fixed}>
          <ul className="flex flex-col gap-1">
            {fixed.map(({ id }) => (
              <li key={id} className="flex items-center gap-2">
                <CheckIcon className="size-5 shrink-0 text-good" />
                {misconceptionShortOf(id)}
              </li>
            ))}
          </ul>
          {fixing.length > 0 && (
            <p className="text-sm text-muted">
              {th.summary.fixing}: {fixing.map(({ id }) => misconceptionShortOf(id)).join(', ')}
            </p>
          )}
        </Section>
      )}

      <section className="flex items-center gap-3 rounded-xl bg-marker-soft px-4 py-3">
        <Mascot className="size-10 shrink-0 -rotate-3" />
        <div className="min-w-0">
          <p className="text-xs text-muted">{th.summary.nextTime}</p>
          <p className="font-hand leading-snug">
            <Filled {...recommendationCopy(recommendationFor(profile))} />
          </p>
        </div>
      </section>

      <div className="mt-auto flex flex-col gap-2">
        <LinkButton href="/learn/session">{th.summary.continue}</LinkButton>
        <LinkButton href="/learn" variant="secondary">
          {th.summary.toMap}
        </LinkButton>
      </div>
    </main>
  );
}
