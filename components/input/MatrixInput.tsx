import { Bracket } from '@/components/ui/MatrixView';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { Dims } from '@/lib/core/types';
import type { Draft } from '@/lib/practice/draft';
import { AnswerBox, type ClosedTone } from './AnswerBox';

interface MatrixInputProps {
  grid: Dims;
  draft: Draft;
  /** Set once the item is closed. */
  closedTone?: ClosedTone;
  /** 1-based cell to mark after a slip (SPEC §9). */
  wrongCell?: [number, number];
  onSelect(box: number): void;
}

export function MatrixInput({ grid, draft, closedTone, wrongCell, onSelect }: MatrixInputProps) {
  const sizeClass = grid.cols >= 3 ? 'h-11 w-16' : 'h-12 w-[4.5rem]';
  return (
    <Bracket>
      <div
        role="group"
        aria-label={th.session.box.answerArea}
        className={`grid gap-1.5 ${draft.isUndefined ? 'opacity-40' : ''}`}
        style={{ gridTemplateColumns: `repeat(${grid.cols}, auto)` }}
      >
        {draft.cells.map((text, box) => {
          const i = Math.floor(box / grid.cols) + 1;
          const j = (box % grid.cols) + 1;
          const isWrong = wrongCell?.[0] === i && wrongCell?.[1] === j;
          return (
            <AnswerBox
              key={box}
              text={text}
              label={fillTokens(th.session.box.cell, { i: String(i), j: String(j) })}
              active={box === draft.active && !draft.isUndefined}
              closedTone={isWrong ? 'slip' : closedTone}
              sizeClass={sizeClass}
              onSelect={() => onSelect(box)}
            />
          );
        })}
      </div>
    </Bracket>
  );
}
