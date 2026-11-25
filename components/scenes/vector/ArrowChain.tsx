import { Choices, HandText, Reveal, Stage, WIDTH } from '@/components/clip/kit';
import { th } from '@/lib/content/th';
import type { ArrowChainBeat, ChainArrow, VectorSceneOf } from '@/lib/topics/vector/scenes/types';
import { Arrow, PointMark, VecName, centersOf, frameFor, type Frame, type XY } from './kit';

interface Props {
  spec: VectorSceneOf<'arrow_chain'>;
  beat: ArrowChainBeat;
}

const FIGURE = { x: 34, y: 52, width: 272, height: 196 };

const NAME_CLASS: Record<ChainArrow['tone'], string> = {
  row: 'fill-cta',
  col: 'fill-brand',
  third: 'fill-flame',
  good: 'fill-good',
  warn: 'fill-warn',
};

/** "AB + ½BC − AD" as names with arrows over them, centered on x. */
export function Expression({
  text,
  x,
  y,
  size = 22,
  className = 'fill-ink',
}: {
  text: string;
  x: number;
  y: number;
  size?: number;
  className?: string;
}) {
  const tokens = text.split(' ');
  const widthOf = (token: string) =>
    /[A-Za-z]/.test(token) ? token.length * size * 0.58 + 6 : size * 0.9;
  const centers = centersOf(tokens.map(widthOf), 0, x);
  return (
    <g>
      {tokens.map((token, i) => {
        const center = centers[i];
        return /[A-Za-z]/.test(token) ? (
          <VecName key={i} name={token} x={center} y={y} size={size} className={className} />
        ) : (
          <HandText key={i} x={center} y={y} size={size} className={className}>
            {token}
          </HandText>
        );
      })}
    </g>
  );
}

/** Where an arrow is on this beat: its last spot so far, or its first before that. */
function spotAt(arrow: ChainArrow, beats: readonly ArrowChainBeat[], now: number) {
  const played = arrow.spots.filter((s) => beats.includes(s.beat));
  const reached = played.filter((s) => beats.indexOf(s.beat) <= now);
  return reached.at(-1) ?? played[0] ?? arrow.spots[0];
}

/** VECTORS §5 `arrow_chain`. The figure stays put; arrows are drawn on it and slid head to tail. */
export function ArrowChain({ spec, beat }: Props) {
  const { points, outline, arrows, asked, answer, student, try: question, mode } = spec.params;
  const now = spec.beats.indexOf(beat);
  const everything = [
    ...points.map((p) => p.at),
    ...arrows.flatMap((a) => a.spots.flatMap((s) => [s.from, s.to])),
  ];
  const frame: Frame = frameFor(everything, FIGURE, { maxUnit: 48 });
  const at = (p: readonly number[]): XY => frame.at(p);
  const center = (() => {
    const corners = outline.map((label) => points.find((p) => p.label === label)!.at);
    return at([
      corners.reduce((s, p) => s + p[0], 0) / corners.length,
      corners.reduce((s, p) => s + p[1], 0) / corners.length,
    ]);
  })();
  const polygon = outline
    .map((label) => at(points.find((p) => p.label === label)!.at))
    .map(({ x, y }) => `${x},${y}`)
    .join(' ');
  const comparing = beat === 'compare';
  const negative = mode === 'equal' && spec.beats.includes('flip');
  const lhs = negative ? `−${asked}` : asked;

  return (
    <Stage>
      {/* ---- what is asked */}
      <Expression text={`${lhs} = ?`} x={WIDTH / 2} y={22} size={22} className="fill-muted" />

      <polygon
        points={polygon}
        fill="none"
        strokeWidth={1.5}
        strokeLinejoin="round"
        className="stroke-edge"
      />
      {points.map(({ label, at: p }) => {
        const spot = at(p);
        const away = { x: spot.x - center.x, y: spot.y - center.y };
        const size = Math.hypot(away.x, away.y) || 1;
        return (
          <PointMark
            key={label}
            at={spot}
            label={label}
            dx={(away.x / size) * 16}
            dy={(away.y / size) * 16}
          />
        );
      })}

      {arrows.map((arrow, i) => {
        const spot = spotAt(arrow, spec.beats, now);
        return (
          <Arrow
            key={i}
            from={at(spot.from)}
            to={at(spot.to)}
            tone={arrow.tone}
            show={arrow.on.includes(beat)}
            start={0.08 + 0.12 * (i % 3)}
            length={0.45}
            width={arrow.tone === 'good' ? 4 : 3.2}
            label={<VecName name={arrow.label} size={17} className={NAME_CLASS[arrow.tone]} />}
          />
        );
      })}

      {/* ---- what they answered, against what is right */}
      <Reveal show={comparing} start={0.1}>
        <HandText x={88} y={292} size={16} className="fill-muted">
          {th.clip.mine}
        </HandText>
        {student && <VecName name={student} x={88} y={334} size={36} className="fill-warn" />}
      </Reveal>
      <Reveal show={comparing} start={0.35} pop>
        <HandText x={252} y={292} size={16} className="fill-muted">
          {th.clip.right}
        </HandText>
        <VecName name={answer} x={252} y={334} size={36} className="fill-good" />
      </Reveal>

      {question && beat === 'try' && (
        <Choices options={question.options} right={question.right} y={300} />
      )}

      <Reveal show={beat === 'result' || beat === 'end'} start={beat === 'end' ? 0.05 : 0.55} pop>
        <Expression
          text={`${lhs} = ${answer}`}
          x={WIDTH / 2}
          y={318}
          size={30}
          className="fill-good"
        />
      </Reveal>
    </Stage>
  );
}
