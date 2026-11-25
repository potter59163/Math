import {
  Choices,
  Cross,
  HandText,
  Reveal,
  Ring,
  Stage,
  WIDTH,
  fitted,
} from '@/components/clip/kit';
import { thVector } from '@/lib/content/th.vector';
import type { VectorSceneOf, QuantityBeat } from '@/lib/topics/vector/scenes/types';
import { Place } from '../svg';
import { Arrow, VecName } from './kit';

interface Props {
  spec: VectorSceneOf<'quantity_sort'>;
  beat: QuantityBeat;
}

const CARD_W = 136;
const CARD_H = 42;
const PILE_X = { scalar: 90, vector: 250 } as const;
/** Beats where the arrows of the intro take the board, and the cards step aside. */
const ARROWS: QuantityBeat[] = ['arrow', 'equal', 'opposite'];

/** VECTORS §5 `quantity_sort`. Cards sort into two piles by whether they need a direction. */
export function QuantitySort({ spec, beat }: Props) {
  const { cards, student, pair, answer, try: question } = spec.params;
  const copy = thVector.scenes.sort;
  const at = (step: QuantityBeat) => spec.beats.indexOf(step);
  const now = spec.beats.indexOf(beat);
  const sorted = at('sort') >= 0 && now >= at('sort');
  const pairing = beat === 'pair' || beat === 'try';
  const arrows = ARROWS.includes(beat);

  const placeOf = (i: number) => {
    if (!sorted) return { x: 92 + (i % 2) * 156, y: 86 + Math.floor(i / 2) * 64 };
    const kind = cards[i].kind;
    const k = cards.slice(0, i).filter((card) => card.kind === kind).length;
    return { x: PILE_X[kind], y: 96 + k * 54 };
  };

  return (
    <Stage>
      <Reveal show={sorted && !arrows}>
        <HandText x={PILE_X.scalar} y={44} size={22} className="fill-cta font-semibold">
          {copy.scalarWord}
        </HandText>
        <HandText x={PILE_X.vector} y={44} size={22} className="fill-brand font-semibold">
          {copy.vectorWord}
        </HandText>
        <line
          x1={WIDTH / 2}
          x2={WIDTH / 2}
          y1={30}
          y2={260}
          strokeWidth={1.5}
          strokeDasharray="3 6"
          className="stroke-edge"
        />
      </Reveal>

      {cards.map((card, i) => {
        const { x, y } = placeOf(i);
        const inPair = pair?.includes(i) ?? false;
        const faint = arrows || (pairing && !inPair);
        return (
          <Place
            key={i}
            x={x}
            y={y}
            opacity={faint ? (arrows ? 0 : 0.3) : 1}
            start={arrows ? 0 : 0.05 + 0.08 * i}
            length={arrows ? 0.12 : 0.4}
          >
            <g className="paper">
              <rect
                x={-CARD_W / 2}
                y={-CARD_H / 2}
                width={CARD_W}
                height={CARD_H}
                rx={9}
                className="fill-surface"
                style={{ filter: 'drop-shadow(0 3px 5px rgb(0 0 0 / 0.35))' }}
              />
              <HandText
                x={sorted && card.kind === 'vector' ? -12 : 0}
                y={0}
                size={fitted(card.label, 22, CARD_W - 40)}
              >
                {card.label}
              </HandText>
            </g>
            {/* What a vector quantity has and a scalar has not. */}
            <Reveal show={sorted && card.kind === 'vector'} start={0.5}>
              <path
                d="M40 0 H58 M52 -5 L58 0 L52 5"
                fill="none"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="stroke-brand"
              />
            </Reveal>
          </Place>
        );
      })}

      {/* ---- what they picked */}
      {student !== undefined && (
        <>
          <Ring
            cx={placeOf(student).x}
            cy={placeOf(student).y}
            r={34}
            show={beat === 'compare'}
            start={0.1}
          />
          <Cross
            x={placeOf(student).x + CARD_W / 2 - 6}
            y={placeOf(student).y - CARD_H / 2}
            size={9}
            show={beat === 'compare'}
            start={0.3}
          />
        </>
      )}
      <Reveal show={beat === 'ask' || beat === 'cards'} start={0.3}>
        <HandText x={WIDTH / 2} y={300} size={22} className="fill-muted">
          {`${copy.size}  ${copy.or}  ${copy.size} + ${copy.direction} ?`}
        </HandText>
      </Reveal>
      {pair && (
        <Reveal show={pairing && sorted} start={0.25}>
          <path
            d={`M${placeOf(pair[1]).x + CARD_W / 2 - 4} ${placeOf(pair[1]).y} L${placeOf(pair[0]).x - CARD_W / 2 + 4} ${placeOf(pair[0]).y}`}
            strokeWidth={2}
            strokeDasharray="4 5"
            className="stroke-muted"
            fill="none"
          />
        </Reveal>
      )}
      <Reveal show={beat === 'end' && sorted} start={0.2}>
        <Ring
          cx={placeOf(answer).x}
          cy={placeOf(answer).y}
          r={34}
          tone="good"
          show={beat === 'end'}
        />
      </Reveal>

      {/* ---- the intro: a vector is an arrow */}
      <Arrow
        from={{ x: 40, y: 320 }}
        to={{ x: 280, y: 150 }}
        tone="col"
        show={beat === 'arrow'}
        start={0.1}
        length={0.4}
        width={4}
      />
      <Reveal show={beat === 'arrow'} start={0.45}>
        <HandText x={150} y={262} size={22} className="fill-cta">
          {copy.size}
        </HandText>
        <HandText x={290} y={124} size={22} className="fill-brand">
          {copy.direction}
        </HandText>
      </Reveal>
      <Arrow
        from={{ x: 30, y: 300 }}
        to={{ x: 160, y: 180 }}
        tone="col"
        show={beat === 'equal'}
        start={0.05}
        label={<VecName name="u" className="fill-brand" />}
        labelSide={-1}
      />
      <Arrow
        from={{ x: 180, y: 330 }}
        to={{ x: 310, y: 210 }}
        tone="col"
        show={beat === 'equal'}
        start={0.3}
        label={<VecName name="v" className="fill-brand" />}
        labelSide={-1}
      />
      <Arrow
        from={{ x: 30, y: 300 }}
        to={{ x: 160, y: 180 }}
        tone="col"
        show={beat === 'opposite'}
        start={0.05}
        label={<VecName name="u" className="fill-brand" />}
        labelSide={-1}
      />
      <Arrow
        from={{ x: 310, y: 210 }}
        to={{ x: 180, y: 330 }}
        tone="warn"
        show={beat === 'opposite'}
        start={0.3}
        label={<VecName name="−u" className="fill-warn" />}
        labelSide={-1}
      />

      {question && beat === 'try' && (
        <Choices options={question.options} right={question.right} y={300} />
      )}
    </Stage>
  );
}
