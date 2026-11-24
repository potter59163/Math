import { Bracket } from '@/components/ui/MatrixView';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { Draft } from '@/lib/practice/draft';
import { AnswerBox, type ClosedTone } from './AnswerBox';

interface VectorInputProps {
  draft: Draft;
  /** Set once the item is closed. */
  closedTone?: ClosedTone;
  /** 1-based component to mark after a slip, as cell [i, 1]. */
  wrongCell?: [number, number];
  onSelect(box: number): void;
}

/**
 * A column vector in square brackets, as the textbook writes it, with one box per component. The
 * boxes are wider than a matrix cell because a component can hold a root, such as −3√5/2.
 */
export function VectorInput({ draft, closedTone, wrongCell, onSelect }: VectorInputProps) {
  return (
    <Bracket>
      <div role="group" aria-label={th.session.box.answerArea} className="grid grid-cols-1 gap-1.5">
        {draft.cells.map((text, box) => {
          const isWrong = wrongCell?.[0] === box + 1;
          return (
            <AnswerBox
              key={box}
              text={text}
              label={fillTokens(th.session.box.component, { i: String(box + 1) })}
              active={box === draft.active}
              closedTone={isWrong ? 'slip' : closedTone}
              sizeClass="h-11 w-24"
              onSelect={() => onSelect(box)}
            />
          );
        })}
      </div>
    </Bracket>
  );
}
