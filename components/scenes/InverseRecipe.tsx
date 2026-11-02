import * as m from 'motion/react-m';
import { useContext } from 'react';
import {
  Band,
  BoardMatrix,
  Choices,
  Cross,
  HandText,
  Reveal,
  Stage,
  Tick,
  WIDTH,
  boxAt,
  cellRect,
  fitted,
  matrixFont,
} from '@/components/clip/kit';
import { th } from '@/lib/content/th';
import { factorText, rationalText } from '@/lib/topics/matrix/format';
import type { InverseBeat, SceneSpecOf } from '@/lib/topics/matrix/scenes/types';
import { BeatClockContext, Fade, SvgBracket, SvgNumber, SvgText, useTween } from './svg';

const ORDER: InverseBeat[] = [
  'show',
  'swap',
  'negate',
  'det',
  'divide',
  'check',
  'try',
  'try_done',
];

const TOP = 28;
const CELL = 50;
const CARD_Y = 152;
const CARD_LINE = 34;
const LOW = 276;

const STEPS = ['swap', 'negate', 'divide'] as const;

interface Props {
  spec: SceneSpecOf<'inverse_recipe'>;
  beat: InverseBeat;
}

/** SCENES §3.4. One working matrix changes in place: a and d swap, then b and c change sign. */
export function InverseRecipe({ spec, beat }: Props) {
  const { A, swapped, adjugate, ad, bc, det, inverse, identity, student } = spec.params;
  const { try: question } = spec.params;
  const copy = th.scenes.inverse;
  const reached = (name: InverseBeat) => ORDER.indexOf(beat) >= ORDER.indexOf(name);
  const tween = useTween();
  const { still } = useContext(BeatClockContext);

  const box = boxAt(52, TOP, 2, 2, CELL);
  const work = boxAt(208, TOP, 2, 2, CELL);
  const font = matrixFont(A, CELL);
  const middleY = TOP + CELL + 2;
  const [[a, b], [c, d]] = A;

  const flaggedStep = spec.flagged;
  const detLine = `det = ${factorText(a)}·${factorText(d)} − ${factorText(b)}·${factorText(c)}`;
  const detValue = `= ${factorText(ad)} − ${factorText(bc)} = ${rationalText(det)}`;

  const swapping = reached('swap');
  const at = (row: number, col: number) => ({ x: work.cx(col), y: work.cy(row) });
  const aFrom = at(0, 0);
  const aTo = at(1, 1);
  // Each goes round the other, so that they never pass through the middle of the matrix.
  const path = (from: { x: number; y: number }, to: { x: number; y: number }, bend: number) =>
    swapping
      ? {
          x: [from.x, (from.x + to.x) / 2 + bend, to.x],
          y: [from.y, (from.y + to.y) / 2 - bend, to.y],
        }
      : from;

  const final = boxAt(
    214,
    LOW + 8,
    2,
    2,
    48,
    inverse.flat().some((value) => !value.isInteger()) ? 56 : 48,
  );

  return (
    <Stage>
      <SvgText x={38} y={middleY} size={18} className="fill-muted font-hand">
        A
      </SvgText>
      <BoardMatrix value={A} box={box} />
      {(
        [
          ['a', 0, 0],
          ['b', 0, 1],
          ['c', 1, 0],
          ['d', 1, 1],
        ] as const
      ).map(([letter, row, col]) => (
        <SvgText
          key={letter}
          x={box.cx(col) - CELL / 2 + 8}
          y={box.cy(row) - CELL / 2 + 8}
          size={11}
          className="fill-muted font-hand"
        >
          {letter}
        </SvgText>
      ))}
      <SvgText x={180} y={middleY} size={22} className="fill-muted font-matrix">
        →
      </SvgText>

      <Band box={cellRect(work, 0, 0)} tone="row" show={beat === 'swap'} />
      <Band box={cellRect(work, 1, 1)} tone="row" show={beat === 'swap'} />
      <Band box={cellRect(work, 0, 1)} tone="col" show={beat === 'negate'} />
      <Band box={cellRect(work, 1, 0)} tone="col" show={beat === 'negate'} />
      <g transform={`translate(${work.x} ${work.y})`}>
        <SvgBracket width={work.width} height={work.height} />
      </g>

      <m.g
        initial={false}
        animate={path(aFrom, aTo, 34)}
        transition={still ? { duration: 0 } : tween(0.15, 0.55)}
      >
        <SvgNumber value={a} size={font} />
      </m.g>
      <m.g
        initial={false}
        animate={path(aTo, aFrom, -34)}
        transition={still ? { duration: 0 } : tween(0.15, 0.55)}
      >
        <SvgNumber value={d} size={font} />
      </m.g>
      <Fade show={!reached('negate')}>
        <SvgNumber value={swapped[0][1]} x={at(0, 1).x} y={at(0, 1).y} size={font} />
        <SvgNumber value={swapped[1][0]} x={at(1, 0).x} y={at(1, 0).y} size={font} />
      </Fade>
      <Reveal show={reached('negate')} start={beat === 'negate' ? 0.3 : 0} pop>
        <SvgNumber
          value={adjugate[0][1]}
          x={at(0, 1).x}
          y={at(0, 1).y}
          size={font}
          className="fill-brand"
        />
      </Reveal>
      <Reveal show={reached('negate')} start={beat === 'negate' ? 0.36 : 0} pop>
        <SvgNumber
          value={adjugate[1][0]}
          x={at(1, 0).x}
          y={at(1, 0).y}
          size={font}
          className="fill-brand"
        />
      </Reveal>

      {/* ---- the recipe on a card, ticked off as it goes */}
      <g className="paper">
        <rect
          x={36}
          y={CARD_Y}
          width={WIDTH - 72}
          height={CARD_LINE * 3 + 8}
          rx={8}
          transform={`rotate(-0.6 ${WIDTH / 2} ${CARD_Y + 50})`}
          className="fill-surface"
          style={{ filter: 'drop-shadow(0 4px 8px rgb(0 0 0 / 0.35))' }}
        />
        {STEPS.map((step, index) => {
          const y = CARD_Y + 21 + index * CARD_LINE;
          const isFlagged = flaggedStep === step;
          const lit = beat === step;
          return (
            <g key={step}>
              <Reveal show={lit} length={0.08}>
                <rect
                  x={44}
                  y={y - 15}
                  width={WIDTH - 88}
                  height={30}
                  rx={6}
                  className={isFlagged ? 'fill-warn/25' : 'fill-marker'}
                />
              </Reveal>
              <HandText
                x={56}
                y={y}
                size={19}
                anchor="start"
                className={isFlagged && reached(step) ? 'fill-warn' : 'fill-ink'}
              >
                {copy.steps[step]}
              </HandText>
              {isFlagged ? (
                <Cross
                  x={WIDTH - 62}
                  y={y}
                  size={9}
                  show={reached(step)}
                  start={beat === step ? 0.6 : 0}
                />
              ) : (
                <Tick
                  x={WIDTH - 62}
                  y={y}
                  size={10}
                  show={reached(step)}
                  start={beat === step ? 0.6 : 0}
                />
              )}
            </g>
          );
        })}
      </g>

      {/* ---- what they answered */}
      {student && (
        <Reveal show={beat === 'show'} start={0.3}>
          <HandText x={120} y={LOW + 62} size={18} className="fill-warn">
            {th.clip.mine}
          </HandText>
          <BoardMatrix
            value={student}
            box={boxAt(170, LOW + 16, 2, 2, 48, 44)}
            numberClass="fill-brand"
          />
          <Cross x={219} y={LOW + 62} size={34} show={beat === 'show'} start={0.5} />
        </Reveal>
      )}

      {/* ---- det, and the division */}
      <Reveal show={beat === 'det'}>
        <HandText x={WIDTH / 2} y={LOW + 44} size={fitted(detLine, 30)}>
          {detLine}
        </HandText>
      </Reveal>
      <Reveal show={beat === 'det'} start={0.35} pop>
        <HandText
          x={WIDTH / 2}
          y={LOW + 96}
          size={fitted(detValue, 32)}
          className="fill-cta font-semibold"
        >
          {detValue}
        </HandText>
      </Reveal>

      <Reveal show={reached('divide') && !reached('check') && !reached('try')}>
        <HandText x={44} y={LOW + 44} size={20} className="fill-cta font-semibold">
          1
        </HandText>
        <line x1={24} x2={64} y1={LOW + 62} y2={LOW + 62} strokeWidth={2} className="stroke-cta" />
        <HandText x={44} y={LOW + 82} size={20} className="fill-cta font-semibold">
          {rationalText(det)}
        </HandText>
        <BoardMatrix value={adjugate} box={boxAt(70, LOW + 12, 2, 2, 44, 48)} />
      </Reveal>
      <Reveal show={reached('divide') && !reached('check') && !reached('try')} start={0.4}>
        <SvgText x={190} y={LOW + 62} size={22} className="fill-muted font-matrix">
          =
        </SvgText>
        <BoardMatrix value={inverse} box={final} numberClass="fill-cta" />
      </Reveal>

      {spec.beats.includes('check') && (
        <Reveal show={beat === 'check'}>
          <HandText x={120} y={LOW + 62} size={22}>
            A·A⁻¹ =
          </HandText>
          <BoardMatrix value={identity} box={boxAt(170, LOW + 16, 2, 2, 48, 44)} />
        </Reveal>
      )}

      {/* ---- their turn */}
      {question && beat === 'try' && (
        <Choices options={question.options} right={question.right} y={LOW - 2} />
      )}
      {question && (
        <Reveal show={beat === 'try_done'} start={0.1} pop>
          <HandText
            x={WIDTH / 2}
            y={LOW + 62}
            size={fitted(question.options[question.right], 36)}
            className="fill-cta font-semibold"
          >
            {question.options[question.right]}
          </HandText>
        </Reveal>
      )}
    </Stage>
  );
}
