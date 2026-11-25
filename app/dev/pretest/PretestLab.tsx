'use client';

import Link from 'next/link';
import { PosttestReport, PretestReport } from '@/components/app/TestReport';
import { applyPretest, newLearnerProfile } from '@/lib/learner/profile';
import { ALL_UNITS } from '@/lib/learner/progress';
import type { LearnerProfile, PretestResult } from '@/lib/learner/types';
import type { SkillId } from '@/lib/topics/types';

// Fixed students for checking the test reports at any width, without signing in or taking the test.

type Results = Partial<Record<SkillId, PretestResult>>;

const SKILLS: SkillId[] = [
  'dim',
  'index',
  'transpose',
  'addsub',
  'scalar',
  'mult_defined',
  'mult',
  'mult_noncomm',
  'det2',
  'det3',
  'det_props',
  'invertible',
  'inv2',
];

/** The run in the audit: 7 of 14, six skills right and four mistakes caught. */
const TYPICAL: Results = {
  dim: { outcome: 'correct' },
  index: { outcome: 'correct' },
  transpose: { outcome: 'correct' },
  addsub: { outcome: 'misconception', caught: [{ id: 'M05_SUB_REVERSED' }] },
  scalar: { outcome: 'correct' },
  mult_defined: { outcome: 'correct' },
  mult: { outcome: 'misconception', caught: [{ id: 'M09_MULT_ELEMENTWISE' }] },
  mult_noncomm: { outcome: 'misconception', caught: [{ id: 'M11_MULT_COMMUTATIVE' }] },
  det2: { outcome: 'correct' },
  det3: { outcome: 'other_wrong' },
  det_props: { outcome: 'other_wrong' },
  invertible: { outcome: 'misconception', caught: [{ id: 'M19_INV_ZERO_ENTRY' }] },
  inv2: { outcome: 'other_wrong' },
};

const all = (outcome: PretestResult['outcome']): Results =>
  Object.fromEntries(SKILLS.map((skill) => [skill, { outcome }]));

function tested(results: Results): LearnerProfile {
  return applyPretest(newLearnerProfile({ id: 'LAB', units: [...ALL_UNITS] }), results, { at: 0 });
}

/** Some time later: dims passed and one mistake fixed, as the profile page would show it. */
function later(): LearnerProfile {
  const profile = tested(TYPICAL);
  const dim = profile.skills.dim;
  const m05 = profile.misconceptions.M05_SUB_REVERSED;
  if (!dim || !m05) return profile;
  return {
    ...profile,
    skills: { ...profile.skills, dim: { ...dim, passed: true } },
    misconceptions: { ...profile.misconceptions, M05_SUB_REVERSED: { ...m05, status: 'resolved' } },
  };
}

const CASES = ['typical', 'all-right', 'nothing', 'later', 'fixed-path', 'post', 'post-no-pre'];

export function PretestLab({ name }: { name: string }) {
  const score = (n: number) => ({ score: n, total: 14 });
  const report = (() => {
    switch (name) {
      case 'all-right':
        return (
          <PretestReport
            profile={tested(all('correct'))}
            score={score(14)}
            topic="matrix"
            usesPretest
          />
        );
      case 'nothing':
        return (
          <PretestReport
            profile={tested(all('other_wrong'))}
            score={score(0)}
            topic="matrix"
            usesPretest
          />
        );
      case 'later':
        return <PretestReport profile={later()} score={score(7)} topic="matrix" usesPretest />;
      case 'fixed-path':
        return (
          <PretestReport
            profile={tested(TYPICAL)}
            score={score(7)}
            topic="matrix"
            usesPretest={false}
          />
        );
      case 'post':
        return <PosttestReport score={score(11)} pre={score(7)} topic="matrix" />;
      case 'post-no-pre':
        return <PosttestReport score={score(9)} pre={null} topic="matrix" />;
      default:
        return (
          <PretestReport profile={tested(TYPICAL)} score={score(7)} topic="matrix" usesPretest />
        );
    }
  })();
  return (
    <>
      <nav className="flex flex-wrap gap-2 border-b border-line bg-surface px-3 py-2 text-xs">
        {CASES.map((label) => (
          <Link key={label} href={`/dev/pretest?case=${label}`} className="underline">
            {label}
          </Link>
        ))}
      </nav>
      {report}
    </>
  );
}
