import { th } from '@/lib/content/th';
import { Mascot } from './Mascot';

interface TutorBubbleProps {
  message: string | undefined;
  /** The tutor may still come back with its own words, which then fade in over these. */
  thinking: boolean;
}

/**
 * What คิว thinks of this answer, written by hand beside its note. It sits in the feedback's scroll
 * area, so it moves nothing.
 */
export function TutorBubble({ message, thinking }: TutorBubbleProps) {
  if (!message && !thinking) return null;
  return (
    <div className="flex items-start gap-2">
      <Mascot className="mt-0.5 size-8 shrink-0 -rotate-3" mood={thinking ? 'thinking' : 'happy'} />
      <p
        key={message ?? 'thinking'}
        role="status"
        className={`font-hand text-sm leading-relaxed motion-safe:animate-fade ${
          message ? '' : 'text-muted motion-safe:animate-think'
        }`}
      >
        {message ?? th.tutor.thinking}
      </p>
    </div>
  );
}
