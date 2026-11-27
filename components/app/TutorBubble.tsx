import { th } from '@/lib/content/th';
import { Mascot, type MascotMood } from './Mascot';

interface TutorBubbleProps {
  message: string | undefined;
  /** The tutor may still come back with its own words, which then fade in over these. */
  thinking: boolean;
  /**
   * How คิว takes the answer these words are about. It shows at once, whether or not the words are
   * still on their way: the answer was already judged on this device.
   */
  mood?: MascotMood;
}

/**
 * What คิว thinks of this answer, written by hand beside its note. It sits in the feedback's scroll
 * area, so it moves nothing. The room under the note is for its tilt: a turned note is a little taller
 * than its box, and without the room a one-line bubble could be scrolled by that much.
 */
export function TutorBubble({ message, thinking, mood }: TutorBubbleProps) {
  if (!message && !thinking) return null;
  return (
    <div className="flex items-start gap-2 pb-1">
      <Mascot
        className="mt-0.5 size-8 shrink-0 -rotate-3"
        mood={mood ?? (thinking ? 'thinking' : 'happy')}
      />
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
