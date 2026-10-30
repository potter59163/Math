import { th } from '@/lib/content/th';
import type { Draft } from '@/lib/practice/draft';
import { AnswerBox, type ClosedTone } from './AnswerBox';

interface DimsInputProps {
  draft: Draft;
  closedTone?: ClosedTone;
  onSelect(box: number): void;
}

// The boxes are labelled "first" and "second", not "rows" and "columns": M01 is about that order, so
// naming them would answer the question.
export function DimsInput({ draft, closedTone, onSelect }: DimsInputProps) {
  const { dimFirst, dimSecond, answerArea } = th.session.box;
  return (
    <div
      role="group"
      aria-label={answerArea}
      className={`flex items-center gap-3 ${draft.isUndefined ? 'opacity-40' : ''}`}
    >
      {[dimFirst, dimSecond].map((label, box) => (
        <div key={label} className="contents">
          {box === 1 && (
            <span aria-hidden="true" className="font-matrix text-2xl text-muted">
              ×
            </span>
          )}
          <AnswerBox
            text={draft.cells[box]}
            label={label}
            active={box === draft.active && !draft.isUndefined}
            closedTone={closedTone}
            sizeClass="h-14 w-20"
            onSelect={() => onSelect(box)}
          />
        </div>
      ))}
    </div>
  );
}
