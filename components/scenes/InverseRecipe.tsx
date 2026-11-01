import { th } from '@/lib/content/th';
import type { InverseBeat, SceneSpecOf } from '@/lib/topics/matrix/scenes/types';
import {
  Fade,
  Highlight,
  Place,
  STAGE_WIDTH,
  SvgBracket,
  SvgMatrix,
  SvgNumber,
  SvgText,
  factorText,
  matrixBox,
} from './svg';

const ORDER: InverseBeat[] = ['show', 'swap', 'negate', 'det', 'divide', 'check'];

const SIZE = 16;

interface Props {
  spec: SceneSpecOf<'inverse_recipe'>;
  beat: InverseBeat;
}

/** SCENES §3.4. One working matrix changes in place: a and d swap, then b and c change sign. */
export function InverseRecipe({ spec, beat }: Props) {
  const { A, swapped, adjugate, ad, bc, det, inverse, identity, student } = spec.params;
  const reached = (name: InverseBeat) => ORDER.indexOf(beat) >= ORDER.indexOf(name);
  const flagged = spec.flagged === beat;

  const width = STAGE_WIDTH;
  const original = matrixBox(A, SIZE);
  const working = matrixBox(adjugate, SIZE);
  const finalBox = matrixBox(inverse, SIZE);

  const yTop = 16;
  const aX = 44;
  const arrowX = aX + original.width + 26;
  const workX = arrowX + 26;

  const yDet = yTop + Math.max(original.height, working.height) + 28;
  const yDivide = yDet + 66;
  const divideLeft = 16;
  const fractionX = divideLeft + 18;
  const adjX = fractionX + 24;
  const equalsX = adjX + working.width + 16;
  const inverseX = equalsX + 16;
  const yCompare = yDivide + finalBox.height + 18;
  const studentBox = student ? matrixBox(student, SIZE) : null;
  const identityBox = matrixBox(identity, SIZE);
  // The same for every beat, so nothing moves or rescales from one beat to the next.
  const height =
    yCompare +
    Math.max(studentBox?.height ?? 0, spec.beats.includes('check') ? identityBox.height : 0) +
    12;

  const at = (row: number, col: number) => ({
    x: workX + working.cellX(col),
    y: yTop + working.cellY(row),
  });

  // Where a and d sit: their own corners, then each other's.
  const aPlace = reached('swap') ? at(1, 1) : at(0, 0);
  const dPlace = reached('swap') ? at(0, 0) : at(1, 1);
  const swapTone = flagged && beat === 'swap' ? 'warn' : 'brand';
  const negateTone = flagged && beat === 'negate' ? 'warn' : 'brand';
  const divideTone = flagged && beat === 'divide' ? 'warn' : 'brand';

  const [[a, b], [c, d]] = A;
  const detLine = `det = ${factorText(a)}·${factorText(d)} − ${factorText(b)}·${factorText(c)}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" aria-hidden="true">
      <SvgText
        x={aX - 8}
        y={yTop + original.height / 2}
        size={15}
        anchor="end"
        className="fill-muted font-semibold"
      >
        A =
      </SvgText>
      <SvgMatrix value={A} box={original} x={aX} y={yTop} size={SIZE} />
      {/* Names the cells, because the captions talk about a, b, c and d. */}
      {[
        ['a', 0, 0],
        ['b', 0, 1],
        ['c', 1, 0],
        ['d', 1, 1],
      ].map(([letter, row, col]) => (
        <SvgText
          key={letter}
          x={aX + original.cellX(col as number) - original.colWidth / 2 + 3}
          y={yTop + original.cellY(row as number) - original.rowHeight / 2 + 4}
          size={9}
          anchor="start"
          className="fill-muted font-matrix"
        >
          {letter}
        </SvgText>
      ))}
      <SvgText
        x={arrowX}
        y={yTop + original.height / 2}
        size={18}
        className="fill-muted font-matrix"
      >
        →
      </SvgText>

      <Highlight
        x={workX + working.cellX(0) - working.colWidth / 2}
        y={yTop + working.cellY(0) - working.rowHeight / 2}
        width={working.colWidth}
        height={working.rowHeight}
        show={beat === 'swap'}
        tone={swapTone}
      />
      <Highlight
        x={workX + working.cellX(1) - working.colWidth / 2}
        y={yTop + working.cellY(1) - working.rowHeight / 2}
        width={working.colWidth}
        height={working.rowHeight}
        show={beat === 'swap'}
        tone={swapTone}
      />
      <Highlight
        x={workX + working.cellX(1) - working.colWidth / 2}
        y={yTop + working.cellY(0) - working.rowHeight / 2}
        width={working.colWidth}
        height={working.rowHeight}
        show={beat === 'negate'}
        tone={negateTone}
      />
      <Highlight
        x={workX + working.cellX(0) - working.colWidth / 2}
        y={yTop + working.cellY(1) - working.rowHeight / 2}
        width={working.colWidth}
        height={working.rowHeight}
        show={beat === 'negate'}
        tone={negateTone}
      />
      <g transform={`translate(${workX} ${yTop})`}>
        <SvgBracket width={working.width} height={working.height} />
      </g>

      <Place x={aPlace.x} y={aPlace.y}>
        <SvgNumber value={a} size={SIZE} />
      </Place>
      <Place x={dPlace.x} y={dPlace.y}>
        <SvgNumber value={d} size={SIZE} />
      </Place>
      <SignSwitch
        before={swapped[0][1]}
        after={adjugate[0][1]}
        at={at(0, 1)}
        negated={reached('negate')}
      />
      <SignSwitch
        before={swapped[1][0]}
        after={adjugate[1][0]}
        at={at(1, 0)}
        negated={reached('negate')}
      />

      <Fade show={reached('det')}>
        <SvgText x={width / 2} y={yDet} size={15} className="fill-ink font-matrix tabular-nums">
          {detLine}
        </SvgText>
      </Fade>
      <Fade show={reached('det')} start={0.3}>
        <SvgText
          x={width / 2}
          y={yDet + 24}
          size={15}
          className="fill-ink font-matrix tabular-nums"
        >
          {`= ${factorText(ad)} − ${factorText(bc)} = ${det.toString().replace('-', '−')}`}
        </SvgText>
      </Fade>

      <Fade show={reached('divide')}>
        <SvgText
          x={fractionX}
          y={yDivide + working.height / 2 - 11}
          size={14}
          className="fill-brand font-matrix font-semibold tabular-nums"
        >
          1
        </SvgText>
        <line
          x1={fractionX - 13}
          x2={fractionX + 13}
          y1={yDivide + working.height / 2}
          y2={yDivide + working.height / 2}
          strokeWidth={1.5}
          className="stroke-brand"
        />
        <SvgText
          x={fractionX}
          y={yDivide + working.height / 2 + 11}
          size={14}
          className="fill-brand font-matrix font-semibold tabular-nums"
        >
          {det.toString().replace('-', '−')}
        </SvgText>
        <SvgMatrix value={adjugate} box={working} x={adjX} y={yDivide} size={SIZE} />
        <SvgText x={equalsX} y={yDivide + working.height / 2} className="fill-muted font-matrix">
          =
        </SvgText>
      </Fade>
      <Fade show={reached('divide')} start={0.3}>
        <Highlight
          x={inverseX + 2}
          y={yDivide}
          width={finalBox.width - 4}
          height={finalBox.height}
          show={flagged && beat === 'divide'}
          tone={divideTone}
        />
        <SvgMatrix value={inverse} box={finalBox} x={inverseX} y={yDivide} size={SIZE} />
      </Fade>

      {student && studentBox && (
        <Fade show={reached('divide') && !reached('check')} start={0.5}>
          <SvgText
            x={adjX + 52}
            y={yCompare + studentBox.height / 2}
            size={13}
            anchor="end"
            className="fill-muted font-medium"
          >
            {th.scenes.player.student}
          </SvgText>
          <SvgMatrix value={student} box={studentBox} x={adjX + 60} y={yCompare} size={SIZE} />
          <line
            x1={adjX + 56}
            x2={adjX + 64 + studentBox.width}
            y1={yCompare + studentBox.height}
            y2={yCompare}
            strokeWidth={1.5}
            className="stroke-warn"
          />
        </Fade>
      )}

      {spec.beats.includes('check') && (
        <Fade show={reached('check')}>
          <SvgText
            x={width / 2 - 10}
            y={yCompare + identityBox.height / 2}
            size={15}
            anchor="end"
            className="fill-ink font-matrix"
          >
            A·A⁻¹ =
          </SvgText>
          <SvgMatrix value={identity} box={identityBox} x={width / 2} y={yCompare} size={SIZE} />
        </Fade>
      )}
    </svg>
  );
}

function SignSwitch({
  before,
  after,
  at,
  negated,
}: {
  before: Parameters<typeof SvgNumber>[0]['value'];
  after: Parameters<typeof SvgNumber>[0]['value'];
  at: { x: number; y: number };
  negated: boolean;
}) {
  return (
    <>
      <Fade show={!negated}>
        <SvgNumber value={before} x={at.x} y={at.y} size={SIZE} />
      </Fade>
      <Fade show={negated}>
        <SvgNumber value={after} x={at.x} y={at.y} size={SIZE} className="fill-brand" />
      </Fade>
    </>
  );
}
