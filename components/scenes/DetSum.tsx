import type { SceneSpecOf } from '@/lib/topics/matrix/scenes/types';
import { Fade, STAGE_WIDTH, SvgMatrix, SvgText, matrixBox } from './svg';

const SIZE = 16;
const MIN_COLUMN = 30;
const OP_WIDTH = 24;
const TOP = 26;

interface Props {
  spec: SceneSpecOf<'det_sum'>;
  beat: SceneSpecOf<'det_sum'>['beats'][number];
}

/** SCENES §3.7. The wrong way stays on screen, struck through, so it can be compared with the right one. */
export function DetSum({ spec, beat }: Props) {
  const { A, B, sum, wrongLine, rightLine } = spec.params;
  const now = spec.beats.indexOf(beat);
  const added = now >= spec.beats.indexOf('add_first');
  const worked = now >= spec.beats.indexOf('det_of_sum');

  const boxA = matrixBox(A, SIZE, MIN_COLUMN);
  const boxB = matrixBox(B, SIZE, MIN_COLUMN);
  const boxSum = matrixBox(sum, SIZE, MIN_COLUMN);
  const total = boxA.width + OP_WIDTH + boxB.width + OP_WIDTH + boxSum.width;
  const width = Math.max(STAGE_WIDTH, total + 8);
  const startX = (width - total) / 2;
  const middle = TOP + boxA.height / 2;
  const rightX = startX + boxA.width + OP_WIDTH;
  const sumX = rightX + boxB.width + OP_WIDTH;

  const wrongY = TOP + boxA.height + 34;
  const rightY = wrongY + 44;
  const height = rightY + 26;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" aria-hidden="true">
      <SvgMatrix value={A} box={boxA} size={SIZE} x={startX} y={TOP} label="A" />
      <SvgText
        x={startX + boxA.width + OP_WIDTH / 2}
        y={middle}
        size={18}
        className="fill-muted font-matrix"
      >
        +
      </SvgText>
      <SvgMatrix value={B} box={boxB} size={SIZE} x={rightX} y={TOP} label="B" />
      <Fade show={added}>
        <SvgText x={sumX - OP_WIDTH / 2} y={middle} size={18} className="fill-muted font-matrix">
          =
        </SvgText>
        <SvgMatrix value={sum} box={boxSum} size={SIZE} x={sumX} y={TOP} label="A + B" />
      </Fade>

      <g>
        <SvgText x={width / 2} y={wrongY} size={16} className="fill-warn font-matrix font-semibold">
          {wrongLine}
        </SvgText>
        <Fade show={added}>
          <line
            x1={16}
            x2={width - 16}
            y1={wrongY}
            y2={wrongY}
            strokeWidth={2}
            className="stroke-warn"
          />
        </Fade>
      </g>
      <Fade show={worked}>
        <SvgText x={width / 2} y={rightY} size={17} className="fill-good font-matrix font-semibold">
          {rightLine}
        </SvgText>
      </Fade>
    </svg>
  );
}
