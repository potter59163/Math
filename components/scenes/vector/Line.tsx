import * as m from 'motion/react-m';
import { HandText, Reveal, useReveal } from '@/components/clip/kit';
import { FILL, STROKE, type ArrowTone, type XY } from './kit';

/** A segment drawn from one end to the other as a pen would, with what it measures beside it. */
export function Line({
  a,
  b,
  tone = 'muted',
  show = true,
  start,
  width = 1.5,
  dashed,
  label,
}: {
  a: XY;
  b: XY;
  tone?: ArrowTone;
  show?: boolean;
  start?: number;
  width?: number;
  dashed?: boolean;
  label?: string;
}) {
  const reveal = useReveal();
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  // The label goes on the side away from the drawing's middle, a little off the line.
  const normal = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
  const side = normal.y > 0 || (normal.y === 0 && normal.x > 0) ? 1 : -1;
  return (
    <>
      <m.path
        d={`M${a.x} ${a.y} L${b.x} ${b.y}`}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: show ? 1 : 0, opacity: show ? 1 : 0 }}
        transition={reveal(show, start, 0.25)}
        fill="none"
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={dashed ? '3 6' : undefined}
        className={STROKE[tone]}
      />
      {label !== undefined && (
        <Reveal show={show} start={(start ?? 0) + 0.2}>
          <HandText
            x={(a.x + b.x) / 2 + normal.x * side * 14}
            y={(a.y + b.y) / 2 + normal.y * side * 14}
            size={16}
            className={`${FILL[tone]} font-semibold`}
          >
            {label}
          </HandText>
        </Reveal>
      )}
    </>
  );
}
