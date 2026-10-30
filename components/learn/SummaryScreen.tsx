'use client';

import type { ReactNode } from 'react';
import { LinkButton } from '@/components/ui/Button';
import { BoltIcon, CheckIcon, FlameIcon } from '@/components/ui/Icons';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import { mapOf, nextSkill } from '@/lib/practice/path';
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

/**
 * SPEC §4 also lists the misconceptions fixed and §11 pays +20 XP for each. Both need the states of
 * SPEC §7.2, so they arrive with the learner model in Phase 4.
 */
export function SummaryScreen() {
  const profile = useRequiredProfile();
  if (!profile) return <LoadingScreen />;

  const map = mapOf(profile);
  const passedSkills = map
    .flatMap(({ skills }) => skills)
    .filter(({ status }) => status === 'passed');
  const finished = nextSkill(profile) === null;

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

      <section className="flex flex-1 flex-col gap-2">
        <h2 className="font-bold">{th.summary.passed}</h2>
        {passedSkills.length === 0 && <p className="text-muted">{th.summary.none}</p>}
        <ul className="flex flex-col gap-1">
          {map
            .filter(({ passed }) => passed)
            .map(({ unit }) => (
              <li key={`unit-${unit}`} className="flex items-center gap-2 font-semibold text-good">
                <CheckIcon className="size-5 shrink-0" />
                {fillTokens(th.summary.unitPassed, { n: String(unit) })}
              </li>
            ))}
          {passedSkills.map(({ id }) => (
            <li key={id} className="flex items-center gap-2">
              <CheckIcon className="size-5 shrink-0 text-good" />
              {skillById(id).nameTh}
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-2">
        {!finished && <LinkButton href="/learn/session">{th.summary.continue}</LinkButton>}
        <LinkButton href="/learn" variant="secondary">
          {th.summary.toMap}
        </LinkButton>
      </div>
    </main>
  );
}
