import type { ReactNode } from 'react';
import type { AnswerAffix } from '@/components/topics';

/** Words either side of an answer box, written like the rest of the notebook: θ = □ องศา. */
export function Affixed({ affix, children }: { affix: AnswerAffix; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 font-hand text-xl">
      {affix.before && <span aria-hidden="true">{affix.before}</span>}
      {children}
      {affix.after && <span aria-hidden="true">{affix.after}</span>}
    </div>
  );
}
