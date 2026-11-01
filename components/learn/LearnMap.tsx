'use client';

import { Button, LinkButton } from '@/components/ui/Button';
import { CheckIcon, LockIcon } from '@/components/ui/Icons';
import { CONFIG } from '@/lib/config';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { PathStep } from '@/lib/director/types';
import { mapOf, nextSkill, type SkillStatus, type UnitOnMap } from '@/lib/learner/progress';
import { profileStore } from '@/lib/practice/store';
import { skillById, type SkillId } from '@/lib/topics/matrix/skills';
import { LoadingScreen } from './LoadingScreen';
import { StatBadges } from './StatBadges';
import { useRequiredProfile } from './useProfile';

const NODE: Record<SkillStatus, string> = {
  passed: 'bg-good text-on-brand',
  current: 'bg-brand text-on-brand ring-4 ring-brand-soft',
  open: 'border-2 border-line bg-surface text-muted',
  locked: 'bg-sunken text-muted',
};

function SkillRow({ id, status }: { id: SkillId; status: SkillStatus }) {
  const isCurrent = status === 'current';
  return (
    <li className="relative flex min-h-12 items-center pl-7">
      <span
        className={`absolute -left-[17px] flex size-8 items-center justify-center rounded-full ${NODE[status]}`}
      >
        {status === 'passed' && <CheckIcon className="size-4" />}
        {status === 'locked' && <LockIcon className="size-4" />}
      </span>
      <div className="min-w-0">
        <p className={isCurrent ? 'font-semibold' : status === 'locked' ? 'text-muted' : ''}>
          {skillById(id).nameTh}
        </p>
        <p className={isCurrent ? 'text-sm text-brand' : 'sr-only'}>{th.learn.status[status]}</p>
      </div>
    </li>
  );
}

function UnitSection({ unit, passed, skills }: UnitOnMap) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 font-bold">
        <span className="text-sm font-medium text-muted">
          {fillTokens(th.learn.unit, { n: String(unit) })}
        </span>
        {th.units[unit]}
        {passed && <CheckIcon className="size-4 text-good" />}
      </h2>
      <ol className="ml-4 flex flex-col gap-1 border-l-2 border-line">
        {skills.map(({ id, status }) => (
          <SkillRow key={id} id={id} status={status} />
        ))}
      </ol>
    </section>
  );
}

/** The latest steps chosen for this student, newest first, each with its reason (SPEC §4). */
function MyPath({ steps }: { steps: readonly PathStep[] }) {
  const recent = steps.slice(-CONFIG.pathStepsOnMap).reverse();
  if (recent.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-bold">{th.learn.myPath}</h2>
      <ol className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-3">
        {recent.map(({ note, skill }, index) => (
          <li key={steps.length - index} className={index === 0 ? '' : 'text-muted'}>
            <p className="text-sm">{note}</p>
            <p className="text-xs text-muted">{skillById(skill).nameTh}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The map (SPEC §4). */
export function LearnMap() {
  const profile = useRequiredProfile();
  if (!profile) return <LoadingScreen />;

  const { classCode, seatNo, nickname } = profile.student;
  const who = fillTokens(th.learn.who, { code: classCode, seat: String(seatNo) });
  const finished = nextSkill(profile) === null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-surface px-4 py-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold">{th.learn.title}</h1>
          <p className="truncate text-sm text-muted">{nickname ? `${nickname} · ${who}` : who}</p>
        </div>
        <StatBadges xp={profile.xp} combo={profile.combo} />
      </header>

      <main className="flex flex-1 flex-col gap-6 px-4 py-4">
        <MyPath steps={profile.path} />
        {mapOf(profile).map((unit) => (
          <UnitSection key={unit.unit} {...unit} />
        ))}
        <Button variant="quiet" size="md" className="self-start" onClick={profileStore.leave}>
          {th.learn.leave}
        </Button>
      </main>

      <footer className="sticky bottom-0 flex flex-col gap-1 border-t border-line bg-surface px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        {finished && <p className="text-center font-semibold text-good">{th.learn.allDone}</p>}
        <LinkButton href="/learn/session" className="w-full">
          {finished ? th.learn.keepPracticing : th.learn.continue}
        </LinkButton>
        {finished && (
          <LinkButton href="/summary" variant="quiet" size="md" className="w-full">
            {th.learn.seeSummary}
          </LinkButton>
        )}
      </footer>
    </div>
  );
}
