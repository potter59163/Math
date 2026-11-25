import { useEffect, useRef, type ReactNode } from 'react';
import { TutorBubble } from '@/components/app/TutorBubble';
import { Button } from '@/components/ui/Button';
import { CheckIcon, NoticeIcon } from '@/components/ui/Icons';
import { Filled } from '@/components/ui/KeepWords';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { NextTurn } from '@/lib/director/types';
import type { AttemptOutcome } from '@/lib/learner/types';
import { feedbackFor } from '@/lib/practice/feedback';
import { DEFAULT_TOPIC, misconceptionShortOf, skillOf, unitOf } from '@/lib/topics';
import type { TopicId } from '@/lib/topics/types';

interface FeedbackCardProps {
  outcome: AttemptOutcome;
  /** The item's topic, which words a slip. */
  topic?: TopicId;
  /** What the director chose next. It names the main button. */
  turn: NextTurn;
  /** A line under the feedback, such as the simplest form of a right answer. */
  note?: string;
  /** The skill passed on its one quick check, because the pre-test got it right (SPEC §7.1). */
  fastPass?: boolean;
  /** The tutor may still answer, and its words would replace the ones shown. */
  thinking: boolean;
  /** The student pressed on and is waiting for it. */
  waiting: boolean;
  onNext(): void;
  onShowWorked(): void;
}

function nextLabel({ classification }: AttemptOutcome, { scenes, pathStep }: NextTurn): string {
  const [scene] = scenes;
  if (scene && classification.type !== 'correct') {
    return scene.template === 'worked_solution' ? th.session.showWorked : th.session.watchScene;
  }
  const entersNewSkill = pathStep.kind === 'advance' || pathStep.kind === 'skip_clip';
  return entersNewSkill ? th.session.nextSkill : th.session.next;
}

/** A teacher's stamp in green ink: what this answer achieved besides being right. */
function Stamp({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="flex items-center gap-3 rounded-lg border-2 border-dashed border-good bg-surface px-3 py-1.5 motion-safe:animate-pop">
      <span className="shrink-0 -rotate-3 font-display text-lg leading-tight font-semibold text-good">
        {label}
      </span>
      <span className="min-w-0 text-sm leading-snug">{children}</span>
    </p>
  );
}

/**
 * Fills the slot the keypad was in, so nothing above it moves when the answer is sent. The card is as
 * tall as what it says and sits at the bottom of the slot, near the thumb, instead of stretching a
 * coloured block over empty space.
 */
export function FeedbackCard({
  outcome,
  topic = DEFAULT_TOPIC,
  turn,
  note,
  fastPass = false,
  thinking,
  waiting,
  onNext,
  onShowWorked,
}: FeedbackCardProps) {
  const feedback = feedbackFor(outcome.classification, topic);
  const isCorrect = feedback.tone === 'correct';
  const { allPassed, bonusXp, resolved, skillPassed, unitPassed, xp } = outcome;
  // When the solution is the next step anyway, one button opens it and goes on from there.
  const offersWorked = feedback.offersWorked && turn.scenes[0]?.template !== 'worked_solution';

  // Lets Enter go straight to the next item on a desktop keyboard.
  const next = useRef<HTMLButtonElement>(null);
  useEffect(() => next.current?.focus({ preventScroll: true }), []);

  return (
    <div className="flex h-full flex-col justify-end">
      <section
        role="status"
        className={`flex max-h-full min-h-0 flex-col gap-2 rounded-xl p-3 motion-safe:animate-rise ${
          isCorrect ? 'bg-good-soft' : 'bg-warn-soft'
        }`}
      >
        <div className="flex items-center gap-2">
          {isCorrect ? (
            <CheckIcon className="size-6 shrink-0 text-good" />
          ) : (
            <NoticeIcon className="size-6 shrink-0 text-warn" />
          )}
          <h2 className={`flex-1 text-lg font-bold ${isCorrect ? 'text-good' : 'text-warn'}`}>
            {feedback.headline}
          </h2>
          {xp > 0 && (
            <span className="font-matrix text-base font-semibold text-xp tabular-nums">
              {fillTokens(th.feedback.xpGained, { xp: String(xp) })}
            </span>
          )}
        </div>

        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          {feedback.detail && <p>{feedback.detail}</p>}
          {note && <p>{note}</p>}
          <TutorBubble message={turn.message} thinking={thinking} />
          {resolved && (
            <Stamp label={th.session.stamps.fixed}>
              {fillTokens(th.session.misconceptionFixed, {
                m: misconceptionShortOf(resolved),
                xp: bonusXp > 0 ? fillTokens(th.feedback.xpGained, { xp: String(bonusXp) }) : '',
              }).trim()}
            </Stamp>
          )}
          {skillPassed &&
            (fastPass ? (
              <Stamp label={th.session.stamps.fastPass}>
                <Filled
                  template={th.session.stamps.fastPassNote}
                  values={{ skill: skillOf(skillPassed).nameTh }}
                />
              </Stamp>
            ) : (
              <Stamp label={th.session.stamps.passed}>
                <Filled
                  template={th.session.skillPassed}
                  values={{ skill: skillOf(skillPassed).nameTh }}
                />
              </Stamp>
            ))}
          {unitPassed && (
            <Stamp label={th.session.stamps.unit}>
              {fillTokens(th.session.unitPassed, { unit: unitOf(unitPassed).label })}
            </Stamp>
          )}
          {allPassed && <p className="font-semibold">{th.session.allDone}</p>}
        </div>

        <div className={`grid shrink-0 gap-2 ${offersWorked ? 'grid-cols-2' : ''}`}>
          {offersWorked && (
            <Button variant="secondary" onClick={onShowWorked}>
              {th.session.showWorked}
            </Button>
          )}
          <Button ref={next} aria-busy={waiting} disabled={waiting} onClick={onNext}>
            {waiting ? th.tutor.thinking : nextLabel(outcome, turn)}
          </Button>
        </div>
      </section>
    </div>
  );
}
