import type { CSSProperties, ReactNode } from 'react';
import { LinkButton } from '@/components/ui/Button';
import { ArrowRightIcon, CheckIcon, CrossIcon, PlayIcon } from '@/components/ui/Icons';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import { pretestSummaryOf, type PretestSummary } from '@/lib/learner/pretest';
import type { LearnerProfile } from '@/lib/learner/types';
import type { AssessmentScore } from '@/lib/sync/assessment';
import { misconceptionShortOf, packOf, skillOf } from '@/lib/topics';
import type { TopicId } from '@/lib/topics/types';

// What a test led to (SPEC §4). It comes only after the test is sent, so the test itself still gives no
// feedback, and it speaks per skill and never shows an answer, so the post-test, which is the other
// form, is not given away (RESEARCH §4).

/** Each block rises a moment after the one above it, unless motion is reduced. */
const rise = (step: number): CSSProperties => ({ animationDelay: `${step * 70}ms` });
const RISE = 'motion-safe:animate-rise motion-safe:[animation-fill-mode:both]';

function Score({ score, total }: AssessmentScore) {
  return (
    <p className="flex items-baseline gap-2">
      <span className="sr-only">
        {fillTokens(th.report.scoreLabel, { score: String(score), total: String(total) })}
      </span>
      <span aria-hidden className="font-matrix leading-none font-semibold tabular-nums">
        <span className="text-5xl">{score}</span>
        <span className="text-2xl text-muted">/{total}</span>
      </span>
      <span aria-hidden className="text-sm text-muted">
        {th.report.points}
      </span>
    </p>
  );
}

function Group({
  title,
  tone,
  note,
  step,
  children,
}: {
  title: string;
  tone: 'good' | 'warn' | 'plain';
  note?: string;
  step: number;
  children: ReactNode;
}) {
  const color = tone === 'good' ? 'text-good' : tone === 'warn' ? 'text-warn' : '';
  return (
    <section style={rise(step)} className={`flex flex-col gap-2 border-t border-line pt-4 ${RISE}`}>
      <h2 className={`flex items-center gap-2 font-display text-lg ${color}`}>
        {tone === 'good' && <CheckIcon className="size-5 shrink-0" />}
        {tone === 'warn' && <CrossIcon className="size-5 shrink-0" />}
        {title}
      </h2>
      {children}
      {note && <p className="font-hand text-sm leading-relaxed text-muted">{note}</p>}
    </section>
  );
}

function SkillChips({
  skills,
  tone,
}: {
  skills: PretestSummary['known'];
  tone: 'good' | 'plain';
}) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {skills.map(({ skill, passed }) => (
        <li
          key={skill}
          className={`inline-flex items-center gap-1 rounded-full border border-line px-3 py-0.5 text-sm ${
            tone === 'good' ? 'bg-good-soft' : 'bg-surface'
          }`}
        >
          {passed && <CheckIcon className="size-3.5 shrink-0 text-good" />}
          {skillOf(skill).nameTh}
          {passed && <span className="sr-only"> ({th.report.passed})</span>}
        </li>
      ))}
    </ul>
  );
}

function startLine(start: NonNullable<PretestSummary['start']>): string {
  const skill = skillOf(start.skill).nameTh;
  if (start.kind === 'check' && start.misconception) {
    return fillTokens(th.report.start.check, {
      skill,
      m: misconceptionShortOf(start.misconception),
    });
  }
  return fillTokens(th.report.start[start.kind === 'check' ? 'learn' : start.kind], { skill });
}

function Footer({ children }: { children: ReactNode }) {
  return (
    <footer className="sticky bottom-0 -mx-5 mt-auto flex flex-col gap-2 border-t border-line bg-canvas/95 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
      {children}
    </footer>
  );
}

interface PretestReportProps {
  profile: Pick<LearnerProfile, 'student' | 'skills' | 'misconceptions'>;
  score: AssessmentScore;
  topic: TopicId;
  /** False on a fixed path, which does not use the pre-test (RESEARCH §2): the score alone is true there. */
  usesPretest: boolean;
}

/** After the pre-test: what is known, what คิว will check first, and where the path starts. */
export function PretestReport({ profile, score, topic, usesPretest }: PretestReportProps) {
  const summary = pretestSummaryOf(profile, topic);
  const { known, caught, toLearn, start } = summary;
  const nothing = known.length === 0 && caught.length === 0;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pt-8">
      <div className="flex flex-col gap-4 pb-6">
        <header className={`flex flex-col gap-1 ${RISE}`}>
          <p className="text-sm text-muted">
            {fillTokens(th.report.eyebrow, { topic: packOf(topic).titleTh })}
          </p>
          <h1 className="text-3xl leading-snug font-semibold">
            <span className="marker">{th.report.title}</span>
          </h1>
        </header>
        <Score {...score} />

        {!usesPretest && <p className="text-muted">{th.report.sent}</p>}

        {usesPretest && known.length > 0 && (
          <Group
            title={fillTokens(th.report.known, { n: String(known.length) })}
            tone="good"
            note={th.report.knownNote}
            step={1}
          >
            <SkillChips skills={known} tone="good" />
          </Group>
        )}

        {usesPretest && caught.length > 0 && (
          <Group
            title={fillTokens(th.report.caught, { n: String(caught.length) })}
            tone="warn"
            note={th.report.caughtNote}
            step={2}
          >
            <ul className="flex flex-col gap-1">
              {caught.map(({ misconception, skill, fixed }) => (
                <li key={misconception} className="flex items-baseline justify-between gap-3">
                  <span
                    className={`font-hand ${fixed ? 'text-muted line-through decoration-warn' : 'text-warn'}`}
                  >
                    {misconceptionShortOf(misconception)}
                  </span>
                  <span className="shrink-0 text-right text-sm text-muted">
                    {fixed ? (
                      <span className="inline-flex items-center gap-1 font-medium text-good">
                        <CheckIcon className="size-3.5" />
                        {th.report.fixed}
                      </span>
                    ) : (
                      skillOf(skill).nameTh
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Group>
        )}

        {usesPretest && toLearn.length > 0 && !nothing && (
          <Group
            title={fillTokens(th.report.toLearn, { n: String(toLearn.length) })}
            tone="plain"
            note={th.report.toLearnNote}
            step={3}
          >
            <SkillChips skills={toLearn} tone="plain" />
          </Group>
        )}

        {usesPretest && nothing && (
          <p style={rise(1)} className={`border-t border-line pt-4 font-hand ${RISE}`}>
            {th.report.nothing}
          </p>
        )}
      </div>

      <Footer>
        {usesPretest && (
          <p className="rounded-lg bg-marker-soft px-3 py-2 text-sm">
            {start ? startLine(start) : th.report.allPassed}
          </p>
        )}
        <LinkButton href="/learn/session" className="w-full">
          <PlayIcon className="size-4" />
          {th.report.begin}
        </LinkButton>
        <LinkButton href="/learn" variant="quiet" size="md" className="w-full">
          {th.report.toMap}
        </LinkButton>
      </Footer>
    </main>
  );
}

interface PosttestReportProps {
  score: AssessmentScore;
  /** Null when no pre-test was taken, so there is nothing to compare with. */
  pre: AssessmentScore | null;
  topic: TopicId;
}

function Column({ label, score, total, strong }: AssessmentScore & { label: string; strong?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-sm text-muted">{label}</span>
      <span
        className={`font-matrix text-4xl leading-none font-semibold tabular-nums ${strong ? '' : 'text-muted'}`}
      >
        {score}
        <span className="text-xl text-muted">/{total}</span>
      </span>
    </div>
  );
}

/** After the post-test: the two scores side by side, which the profile also keeps. */
export function PosttestReport({ score, pre, topic }: PosttestReportProps) {
  const gain = pre ? score.score - pre.score : null;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pt-8">
      <div className="flex flex-col gap-6 pb-6">
        <header className={`flex flex-col gap-1 ${RISE}`}>
          <p className="text-sm text-muted">
            {fillTokens(th.report.postEyebrow, { topic: packOf(topic).titleTh })}
          </p>
          <h1 className="text-3xl leading-snug font-semibold">
            <span className="marker">{th.report.postTitle}</span>
          </h1>
        </header>
        {pre ? (
          <div style={rise(1)} className={`flex items-center justify-center gap-6 ${RISE}`}>
            <Column label={th.report.before} {...pre} />
            <ArrowRightIcon className="size-6 text-muted" />
            <Column label={th.report.after} {...score} strong />
          </div>
        ) : (
          <>
            <Score {...score} />
            <p className="text-muted">{th.report.noPre}</p>
          </>
        )}
        {gain !== null && gain > 0 && (
          <p style={rise(2)} className={`text-center font-display text-xl text-good ${RISE}`}>
            {fillTokens(th.report.gained, { points: String(gain) })}
          </p>
        )}
        {gain === 0 && <p className="text-center text-muted">{th.report.same}</p>}
      </div>
      <Footer>
        <LinkButton href="/learn" className="w-full">
          {th.test.goLearn}
        </LinkButton>
      </Footer>
    </main>
  );
}
