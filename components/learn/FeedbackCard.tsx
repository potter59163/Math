import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { CheckIcon, NoticeIcon } from '@/components/ui/Icons';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import { feedbackFor } from '@/lib/practice/feedback';
import type { AttemptOutcome } from '@/lib/practice/profile';
import { skillById } from '@/lib/topics/matrix/skills';

interface FeedbackCardProps {
  outcome: AttemptOutcome;
  onNext(): void;
  onShowWorked(): void;
}

function nextLabel({ allPassed, skillPassed }: AttemptOutcome): string {
  if (allPassed) return th.session.finish;
  return skillPassed ? th.session.nextSkill : th.session.next;
}

/** Fills the slot the keypad was in, so nothing above it moves when the answer is sent. */
export function FeedbackCard({ outcome, onNext, onShowWorked }: FeedbackCardProps) {
  const feedback = feedbackFor(outcome.classification);
  const isCorrect = feedback.tone === 'correct';
  const { skillPassed, unitPassed, xp } = outcome;

  // Lets Enter go straight to the next item on a desktop keyboard.
  const next = useRef<HTMLButtonElement>(null);
  useEffect(() => next.current?.focus({ preventScroll: true }), []);

  return (
    <section
      role="status"
      className={`flex h-full flex-col gap-2 rounded-2xl p-3 motion-safe:animate-rise ${
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

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {feedback.detail && <p>{feedback.detail}</p>}
        {skillPassed && (
          <p className="font-semibold">
            {fillTokens(th.session.skillPassed, { skill: skillById(skillPassed).nameTh })}
          </p>
        )}
        {unitPassed && (
          <p className="font-semibold">
            {fillTokens(th.session.unitPassed, { unit: String(unitPassed) })}
          </p>
        )}
      </div>

      <div className={`grid gap-2 ${feedback.offersWorked ? 'grid-cols-2' : ''}`}>
        {feedback.offersWorked && (
          <Button variant="secondary" onClick={onShowWorked}>
            {th.session.showWorked}
          </Button>
        )}
        <Button ref={next} onClick={onNext}>
          {nextLabel(outcome)}
        </Button>
      </div>
    </section>
  );
}
