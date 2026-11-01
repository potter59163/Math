import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { CheckIcon, NoticeIcon } from '@/components/ui/Icons';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { NextTurn } from '@/lib/director/types';
import type { AttemptOutcome } from '@/lib/learner/types';
import { feedbackFor } from '@/lib/practice/feedback';
import { skillById } from '@/lib/topics/matrix/skills';

interface FeedbackCardProps {
  outcome: AttemptOutcome;
  /** What the director chose next. It names the main button. */
  turn: NextTurn;
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

/** Fills the slot the keypad was in, so nothing above it moves when the answer is sent. */
export function FeedbackCard({ outcome, turn, onNext, onShowWorked }: FeedbackCardProps) {
  const feedback = feedbackFor(outcome.classification);
  const isCorrect = feedback.tone === 'correct';
  const { allPassed, bonusXp, resolved, skillPassed, unitPassed, xp } = outcome;
  // When the solution is the next step anyway, one button opens it and goes on from there.
  const offersWorked = feedback.offersWorked && turn.scenes[0]?.template !== 'worked_solution';

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
        {resolved && (
          <p className="font-semibold">
            {fillTokens(th.session.misconceptionFixed, {
              m: th.misconceptionShort[resolved],
              xp: bonusXp > 0 ? fillTokens(th.feedback.xpGained, { xp: String(bonusXp) }) : '',
            }).trim()}
          </p>
        )}
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
        {allPassed && <p className="font-semibold">{th.session.allDone}</p>}
      </div>

      <div className={`grid gap-2 ${offersWorked ? 'grid-cols-2' : ''}`}>
        {offersWorked && (
          <Button variant="secondary" onClick={onShowWorked}>
            {th.session.showWorked}
          </Button>
        )}
        <Button ref={next} onClick={onNext}>
          {nextLabel(outcome, turn)}
        </Button>
      </div>
    </section>
  );
}
