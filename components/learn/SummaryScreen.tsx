'use client';

import type { ReactNode } from 'react';
import { LinkButton } from '@/components/ui/Button';
import { BoltIcon, CheckIcon, FlameIcon } from '@/components/ui/Icons';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import { mapOf } from '@/lib/learner/progress';
import { badgesOf, type Badge } from '@/lib/practice/rewards';
import { CATALOG } from '@/lib/topics/matrix/misconceptions';
import { skillById } from '@/lib/topics/matrix/skills';
import { LoadingScreen } from './LoadingScreen';
import { useRequiredProfile } from './useProfile';

function Tile({ icon, label, value }: { icon?: ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-line bg-surface p-3 text-center">
      <span className="flex items-center gap-1 font-matrix text-2xl font-bold tabular-nums">
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

function ListOfDone({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-bold">{title}</h2>
      {items.length === 0 && <p className="text-muted">{empty}</p>}
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
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{th.summary.title}</h1>

      <div className="grid grid-cols-3 gap-2">
        <Tile
          icon={<BoltIcon className="size-5 text-xp" />}
          label={th.summary.xp}
          value={String(profile.xp)}
        />
        <Tile
          icon={<FlameIcon className="size-5 text-flame" />}
          label={th.summary.bestCombo}
          value={String(profile.bestCombo)}
        />
        <Tile label={th.summary.itemsDone} value={String(profile.itemsDone)} />
      </div>

      {badges.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-bold">{th.summary.badges}</h2>
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

      <ListOfDone title={th.summary.passed} items={passedSkills} empty={th.summary.none} />
      <ListOfDone title={th.summary.fixed} items={fixed} empty={th.summary.fixedNone} />

      <div className="mt-auto flex flex-col gap-2">
        <LinkButton href="/learn/session">{th.summary.continue}</LinkButton>
        <LinkButton href="/learn" variant="secondary">
          {th.summary.toMap}
        </LinkButton>
      </div>
    </main>
  );
}
