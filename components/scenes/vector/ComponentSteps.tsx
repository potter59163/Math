import { Choices, HandText, Reveal, Stage, WIDTH } from '@/components/clip/kit';
import { linearExprText, surdVecText, vecText } from '@/lib/topics/vector/format';
import type { ComponentBeat, VectorSceneOf } from '@/lib/topics/vector/scenes/types';
import {
  Arrow,
  Axes,
  Column,
  Guides,
  axisEnds,
  PointMark,
  SideBySide,
  VecName,
  WorkLine,
  centersOf,
  columnBox,
  frameFor,
  reachOf,
  toNums,
  type Entry,
} from './kit';

interface Props {
  spec: VectorSceneOf<'component_steps'>;
  beat: ComponentBeat;
}

const SIZE = 19;
const GAP = 10;

type Piece =
  | { kind: 'text'; text: string; className?: string }
  | {
      kind: 'col';
      entries: Entry[];
      label?: string;
      labelClass?: string;
      lit?: number;
      tone?: 'row' | 'col' | 'good' | 'warn';
      show?: boolean;
      hidden?(i: number): boolean;
      entryClass?(i: number): string;
    };

/** Lays pieces out side by side, centered, and draws them: "3 [2, −1, 3] − 2 [1, 4, −2]". */
function Row({ pieces, y, size = SIZE }: { pieces: Piece[]; y: number; size?: number }) {
  const widths = pieces.map((piece) =>
    piece.kind === 'text'
      ? piece.text.length * size * 0.55 + 4
      : columnBox(piece.entries, 0, y, size).width,
  );
  const centers = centersOf(widths, GAP);
  return (
    <g>
      {pieces.map((piece, i) => {
        const x = centers[i];
        if (piece.kind === 'text') {
          const height = 3 * size * 1.6;
          return (
            <HandText
              key={i}
              x={x}
              y={y + height / 2}
              size={size + 2}
              className={piece.className ?? 'fill-muted'}
            >
              {piece.text}
            </HandText>
          );
        }
        const box = columnBox(piece.entries, x, y, size);
        return (
          <Column
            key={i}
            entries={piece.entries}
            box={box}
            size={size}
            lit={piece.lit}
            tone={piece.tone}
            show={piece.show ?? true}
            label={
              piece.label && (
                <VecName
                  name={piece.label}
                  size={16}
                  className={piece.labelClass ?? 'fill-muted'}
                />
              )
            }
            entryClass={(j) =>
              piece.hidden?.(j) ? 'fill-transparent' : (piece.entryClass?.(j) ?? 'fill-ink')
            }
          />
        );
      })}
    </g>
  );
}

const compIndex = (beat: string): number | null => {
  const match = /^comp_(\d+)$/.exec(beat);
  return match ? Number(match[1]) - 1 : null;
};
const scaleIndex = (beat: string): number | null => {
  const match = /^scale_(\d+)$/.exec(beat);
  return match ? Number(match[1]) - 1 : null;
};

/** VECTORS §5 `component_steps`. One component at a time, lit across every vector at once. */
export function ComponentSteps({ spec, beat }: Props) {
  return spec.params.mode === 'points' ? (
    <Points spec={spec} beat={beat} />
  ) : (
    <Linear spec={spec} beat={beat} />
  );
}

function Points({ spec, beat }: Props) {
  const { A, B, result, lines, student, size, try: question } = spec.params;
  const now = spec.beats.indexOf(beat);
  const reached = (step: ComponentBeat) =>
    spec.beats.indexOf(step) >= 0 && now >= spec.beats.indexOf(step);
  const comparing = beat === 'compare' || beat === 'try';
  const lit = compIndex(beat);
  const done = (i: number) => {
    const at = spec.beats.indexOf(`comp_${i + 1}`);
    return at >= 0 && now >= at;
  };
  const a = toNums(A!);
  const b = toNums(B!);
  const origin = a.map(() => 0);
  const reach = reachOf([a, b], size);
  const frame = frameFor(
    [origin, a, b, ...axisEnds(reach)],
    { x: 30, y: 10, width: 280, height: 168 },
    { maxUnit: 36 },
  );
  const working = reached('setup');

  return (
    <Stage>
      {/* ---- the points in space */}
      <Axes frame={frame} reach={reach} dims={size} />
      <Guides frame={frame} p={a} show={beat !== 'axes'} />
      <Guides frame={frame} p={b} show={beat !== 'axes'} />
      <PointMark at={frame.at(a)} label="A" show={beat !== 'axes'} tone="row" />
      <PointMark at={frame.at(b)} label="B" show={beat !== 'axes'} tone="col" />
      <Arrow
        from={frame.at(a)}
        to={frame.at(b)}
        tone="good"
        show={reached('setup') || beat === 'compare'}
        start={0.2}
        label={<VecName name="AB" size={16} className="fill-good" />}
      />
      <Arrow from={frame.at(b)} to={frame.at(a)} tone="warn" show={comparing} start={0.45} dashed />

      {/* ---- what they answered */}
      {student && (
        <SideBySide
          mine={surdVecText(student)}
          right={vecText(result)}
          show={beat === 'compare'}
          y={214}
        />
      )}
      {question && beat === 'try' && (
        <Choices options={question.options} right={question.right} y={230} />
      )}

      {/* ---- B − A, one component at a time */}
      <Reveal show={working}>
        <Row
          y={196}
          pieces={[
            {
              kind: 'col',
              entries: B!,
              label: 'OB',
              labelClass: 'fill-brand',
              lit: lit ?? undefined,
            },
            { kind: 'text', text: '−' },
            {
              kind: 'col',
              entries: A!,
              label: 'OA',
              labelClass: 'fill-cta',
              lit: lit ?? undefined,
            },
            { kind: 'text', text: '=' },
            {
              kind: 'col',
              entries: result,
              label: 'AB',
              labelClass: 'fill-good',
              lit: lit ?? undefined,
              tone: 'good',
              hidden: (i) => !done(i),
              entryClass: () => 'fill-good',
            },
          ]}
        />
      </Reveal>
      {lines.map((line, i) => (
        <WorkLine
          key={i}
          text={line}
          y={380}
          show={lit === i}
          start={0.3}
          size={26}
          className="fill-ink"
        />
      ))}
      <WorkLine
        text={`AB = ${vecText(result)}`}
        y={380}
        show={beat === 'done'}
        start={0.1}
        size={28}
        className="fill-good font-semibold"
        pop
      />
    </Stage>
  );
}

function Linear({ spec, beat }: Props) {
  const { terms = [], result, lines, student, expression, ijk, try: question } = spec.params;
  const now = spec.beats.indexOf(beat);
  const seen = (step: ComponentBeat) =>
    spec.beats.indexOf(step) >= 0 && now >= spec.beats.indexOf(step);
  const scaling = scaleIndex(beat);
  const scaledYet = (i: number) => terms[i].k === 1 || seen(`scale_${i + 1}`);
  const summed = seen('sum') || beat === 'done';
  const comparing = beat === 'compare';

  const given: Piece[] = terms.flatMap((term, i): Piece[] => {
    const sign = i === 0 ? (term.k < 0 ? '−' : '') : term.k < 0 ? '−' : '+';
    const size = Math.abs(term.k);
    const scalar = `${sign}${size === 1 ? '' : size}`;
    return [
      ...(scalar
        ? [
            {
              kind: 'text' as const,
              text: scalar,
              className: scaling === i ? 'fill-cta' : 'fill-muted',
            },
          ]
        : []),
      {
        kind: 'col',
        entries: term.vec,
        label: term.name,
        labelClass: scaling === i ? 'fill-cta' : 'fill-muted',
      },
    ];
  });
  const scaled: Piece[] = terms.flatMap((term, i): Piece[] => [
    ...(i > 0 ? [{ kind: 'text' as const, text: '+' }] : []),
    {
      kind: 'col',
      entries: term.scaled,
      label: linearExprText([{ k: term.k, name: term.name }]),
      labelClass: scaling === i ? 'fill-cta' : 'fill-muted',
      tone: 'row',
      lit: undefined,
      hidden: () => !scaledYet(i),
      entryClass: () => (scaling === i ? 'fill-cta' : 'fill-ink'),
    },
  ]);
  const sumPieces: Piece[] = [
    ...scaled,
    { kind: 'text', text: '=' },
    {
      kind: 'col',
      entries: result,
      label: expression.replace(/ /g, ''),
      labelClass: 'fill-good',
      hidden: () => !summed,
      entryClass: () => 'fill-good',
    },
  ];
  const bottom = scaling !== null ? terms[scaling].lines : beat === 'sum' ? lines : null;

  return (
    <Stage>
      <Row y={34} pieces={given} />
      <Reveal show={!comparing && beat !== 'try' && beat !== 'read'}>
        <Row y={176} pieces={sumPieces} />
      </Reveal>

      {/* ---- i, j, k written as components */}
      <Reveal show={beat === 'read'} start={0.15}>
        {(ijk ?? []).map((line, i) => (
          <HandText key={i} x={WIDTH / 2} y={210 + i * 34} size={22} className="fill-ink">
            {line}
          </HandText>
        ))}
      </Reveal>

      {bottom?.map((line, i) => (
        <WorkLine
          key={`${beat}${i}`}
          text={line}
          y={338 + i * 30}
          show
          start={0.25 + 0.12 * i}
          size={20}
          className="fill-ink"
        />
      ))}

      {student && (
        <SideBySide mine={surdVecText(student)} right={vecText(result)} show={comparing} y={214} />
      )}
      {question && beat === 'try' && (
        <Choices options={question.options} right={question.right} y={230} />
      )}
      <WorkLine
        text={`${expression} = ${vecText(result)}`}
        y={396}
        show={beat === 'done'}
        size={24}
        className="fill-good font-semibold"
        pop
      />
    </Stage>
  );
}
