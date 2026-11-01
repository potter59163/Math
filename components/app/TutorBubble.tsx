import { th } from '@/lib/content/th';
import { Mascot } from './Mascot';

interface TutorBubbleProps {
  message: string | undefined;
  /** The tutor may still come back with its own words, which then fade in over these. */
  thinking: boolean;
}

/** Says what คิว thinks of this answer. It sits in the feedback's scroll area, so it moves nothing. */
export function TutorBubble({ message, thinking }: TutorBubbleProps) {
  if (!message && !thinking) return null;
  return (
    <div className="flex items-start gap-2">
      <Mascot className="size-8 shrink-0" mood={thinking ? 'thinking' : 'happy'} />
      <p
        key={message ?? 'thinking'}
        role="status"
        className={`rounded-2xl rounded-tl-sm bg-surface px-3 py-1.5 text-sm motion-safe:animate-fade ${
          message ? '' : 'text-muted motion-safe:animate-think'
        }`}
      >
        {message ?? th.tutor.thinking}
      </p>
    </div>
  );
}
