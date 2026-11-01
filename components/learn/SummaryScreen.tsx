'use client';

import type { ReactNode } from 'react';
import { Mascot } from '@/components/app/Mascot';
import { useRequiredProfile } from '@/components/app/useLearner';
import { LinkButton } from '@/components/ui/Button';
import { BoltIcon, CheckIcon, FlameIcon } from '@/components/ui/Icons';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import { mapOf } from '@/lib/learner/progress';
import { badgesOf, type Badge } from '@/lib/practice/rewards';
import { CATALOG } from '@/lib/topics/matrix/misconceptions';
import { skillById } from '@/lib/topics/matrix/skills';
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
    : fillTokens(th.summary.unitPassed, { n: String(badge.unit) });
}

function ListOfDone({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg">{title}</h2>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2">
            <CheckIcon className="size-5 shrink-0 text-good" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** What this student has to show for the session (SPEC §4, §11). */
export function SummaryScreen() {
  const profile = useRequiredProfile();
  if (!profile) return <LoadingScreen />;

  const passedSkills = mapOf(profile)
    .flatMap(({ skills }) => skills)
    .filter(({ status }) => status === 'passed')
    .map(({ id }) => skillById(id).nameTh);
  const fixed = CATALOG.filter(({ id }) => profile.misconceptions[id]?.status === 'resolved').map(
    ({ nameTh }) => nameTh,
  );
  const badges = badgesOf(profile);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-6 px-5 py-8">
      <header className="flex items-center gap-3">
        <Mascot className="size-16 -rotate-3" mood="cheer" />
        <h1 className="text-3xl font-semibold">
          <span className="marker">{th.summary.title}</span>
        </h1>
      </header>

      <div className="grid grid-cols-3 gap-3 rounded-xl border-2 border-ink bg-surface p-4 shadow-[0_3px_0_var(--ink)]">
        <Stat
          icon={<BoltIcon className="size-5 text-xp" />}
          label={th.summary.xp}
          value={String(profile.xp)}
        />
        <Stat
          icon={<FlameIcon className="size-5 text-flame" />}
          label={th.summary.bestCombo}
          value={String(profile.bestCombo)}
        />
        <Stat label={th.summary.itemsDone} value={String(profile.itemsDone)} />
      </div>

      {badges.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg">{th.summary.badges}</h2>
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
        </section>
      )}

      <ListOfDone title={th.summary.passed} items={passedSkills} />
      <ListOfDone title={th.summary.fixed} items={fixed} />

      <div className="mt-auto flex flex-col gap-2">
        <LinkButton href="/learn/session">{th.summary.continue}</LinkButton>
        <LinkButton href="/learn" variant="secondary">
          {th.summary.toMap}
        </LinkButton>
      </div>
    </main>
  );
}
