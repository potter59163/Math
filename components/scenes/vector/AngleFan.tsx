import { Choices, HandText, Reveal, Stage, Struck } from '@/components/clip/kit';
import type { Surd } from '@/lib/core/surd';
import type { AngleBeat, VectorSceneOf } from '@/lib/topics/vector/scenes/types';
import { surdText } from '@/lib/topics/vector/format';
import { SideBySide, SvgSurd, WorkLine } from './kit';
import { Line } from './Line';

interface Props {
  spec: VectorSceneOf<'angle_fan'>;
  beat: AngleBeat;
}

const CX = 170;
const CY = 172;
const R = 118;

const surdNum = (s: Surd): number => (s.coeff.n / s.coeff.d) * Math.sqrt(s.radicand);
const onArc = (degrees: number) => ({
  x: CX + R * Math.cos((degrees * Math.PI) / 180),
  y: CY - R * Math.sin((degrees * Math.PI) / 180),
});

/** VECTORS §5 `angle_fan`. cos θ is a place on the diameter; θ is the angle straight above it. */
export function AngleFan({ spec, beat }: Props) {
  const {
    dotLine,
    normsLine,
    cosLine,
    cos,
    theta,
    ticks,
    mirror,
    wrongLine,
    student,
    mode,
    try: question,
  } = spec.params;
  const now = spec.beats.indexOf(beat);
  const seen = (step: AngleBeat) =>
    spec.beats.indexOf(step) >= 0 && now >= spec.beats.indexOf(step);
  const comparing = beat === 'compare';
  const reading = seen('fan');
  const c = surdNum(cos);
  const degrees = theta ?? (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
  const point = { x: CX + R * c, y: CY };
  const tip = onArc(degrees);
  const named = (angle: number) =>
    angle === 0 || angle === 90 || angle === 180 || (angle === mirror && angle !== theta);

  return (
    <Stage>
      {/* ---- the fan: a half circle of the standard angles over the cos θ line */}
      <path
        d={`M${CX - R} ${CY} A${R} ${R} 0 0 1 ${CX + R} ${CY}`}
        fill="none"
        strokeWidth={1.5}
        className="stroke-edge"
      />
      <line
        x1={CX - R - 8}
        x2={CX + R + 8}
        y1={CY}
        y2={CY}
        strokeWidth={1.5}
        className="stroke-edge"
      />
      {ticks.map(({ theta: angle, cos: value }) => {
        const at = onArc(angle);
        const outside = onArc(angle);
        const label = {
          x: CX + (R + 18) * Math.cos((angle * Math.PI) / 180),
          y: CY - (R + 14) * Math.sin((angle * Math.PI) / 180),
        };
        return (
          <g key={angle}>
            <circle cx={at.x} cy={at.y} r={2.5} className="fill-muted" />
            <line
              x1={outside.x}
              y1={outside.y}
              x2={CX + R * surdNum(value)}
              y2={CY}
              strokeWidth={0.8}
              strokeDasharray="2 5"
              className="stroke-line"
            />
            {named(angle) && (
              <HandText x={label.x} y={label.y} size={13} className="fill-muted">
                {`${angle}°`}
              </HandText>
            )}
          </g>
        );
      })}
      {ticks
        .filter(({ theta: angle }) => angle === 0 || angle === 90 || angle === 180)
        .map(({ theta: angle, cos: value }) => (
          <SvgSurd
            key={angle}
            value={value}
            x={CX + R * surdNum(value)}
            y={CY + 16}
            size={13}
            className="fill-muted"
          />
        ))}
      <HandText x={CX + R + 10} y={CY + 32} size={13} className="fill-muted">
        cos θ
      </HandText>

      {/* ---- where this cos θ is, and the angle above it */}
      <Reveal show={seen('cos') || comparing}>
        <circle cx={point.x} cy={point.y} r={5} className={c < 0 ? 'fill-warn' : 'fill-good'} />
        <g transform={`translate(${point.x} ${CY + 34})`}>
          <rect x={-30} y={-14} width={60} height={28} rx={6} className="fill-canvas" />
          <SvgSurd value={cos} size={17} className={c < 0 ? 'fill-warn' : 'fill-good'} />
        </g>
      </Reveal>
      <Line a={point} b={tip} tone="good" dashed width={2} show={reading} start={0.1} />
      <Line a={{ x: CX, y: CY }} b={tip} tone="good" width={4} show={reading} start={0.3} />
      {mirror !== undefined && (
        <Line
          a={{ x: CX, y: CY }}
          b={onArc(mirror)}
          tone="warn"
          width={3}
          dashed
          show={comparing || beat === 'try' || beat === 'fan'}
          start={0.2}
        />
      )}
      {theta !== null && (
        <Reveal show={reading} start={0.5} pop>
          <HandText
            x={tip.x + (tip.x < CX ? -26 : 26)}
            y={tip.y - 6}
            size={20}
            className="fill-good font-semibold"
          >
            {`${theta}°`}
          </HandText>
        </Reveal>
      )}

      {/* ---- the working */}
      <WorkLine
        text={dotLine}
        y={256}
        show={seen('dot') && !comparing && beat !== 'try'}
        start={0.2}
        size={22}
      />
      <WorkLine
        text={normsLine}
        y={294}
        show={seen('norms') && !comparing && beat !== 'try'}
        start={0.2}
        size={22}
      />
      <WorkLine
        text={cosLine}
        y={336}
        show={seen('cos') && !comparing}
        start={0.3}
        size={24}
        className="fill-good font-semibold"
      />

      {student !== undefined && (
        <>
          <SideBySide
            mine={student}
            right={mode === 'cosine' ? surdText(cos) : `${theta}°`}
            show={comparing}
            y={248}
          />
          {wrongLine && <Struck text={wrongLine} y={340} show={comparing} start={0.45} size={24} />}
        </>
      )}
      {question && beat === 'try' && (
        <Choices options={question.options} right={question.right} y={360} />
      )}
    </Stage>
  );
}
