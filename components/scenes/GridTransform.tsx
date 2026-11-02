import { useContext, useId, useLayoutEffect, useRef } from 'react';
import {
  Choices,
  HEIGHT,
  HandText,
  Reveal,
  Stage,
  Tick,
  WIDTH,
  fitted,
} from '@/components/clip/kit';
import type { Matrix } from '@/lib/core/types';
import type { GridBeat, GridBounds, SceneSpecOf } from '@/lib/topics/matrix/scenes/types';
import { BeatClockContext, SvgMatrix, SvgText, matrixBox } from './svg';

/** A beat whose frame differs from the one before animates for this share of its length. */
const MOVE_SHARE = 0.75;
/** Room under the picture for what a beat concludes, or for a question. */
const BOTTOM = 84;

interface Props {
  spec: SceneSpecOf<'grid_transform'>;
  beat: GridBeat;
}

/** A float for drawing only. No answer ever comes from here; the frames are exact in the spec. */
const approx = ([[a, b], [c, d]]: Matrix): Transform => [
  a.n / a.d,
  b.n / b.d,
  c.n / c.d,
  d.n / d.d,
];

type Transform = [a: number, b: number, c: number, d: number];

const lerp = (from: Transform, to: Transform, t: number): Transform =>
  from.map((value, index) => value + (to[index] - value) * t) as Transform;

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

interface PanelGeometry {
  /** Pixel position of a grid point. y points up on the grid and down on the screen. */
  sx(x: number): number;
  sy(y: number): number;
  unit: number;
}

function geometryOf(bounds: GridBounds, x: number, y: number, width: number, height: number) {
  const pad = 1;
  const spanX = bounds.maxX - bounds.minX + pad;
  const spanY = bounds.maxY - bounds.minY + pad;
  const unit = Math.min(width / spanX, height / spanY);
  const offsetX = x + (width - (bounds.maxX - bounds.minX) * unit) / 2;
  const offsetY = y + (height - (bounds.maxY - bounds.minY) * unit) / 2;
  return {
    unit,
    sx: (gridX: number) => offsetX + (gridX - bounds.minX) * unit,
    sy: (gridY: number) => offsetY + (bounds.maxY - gridY) * unit,
  } satisfies PanelGeometry;
}

/** Lines every 1, 2 or 5 units, so a large transform does not turn the grid into a solid block. */
function gridStep(unit: number): number {
  if (unit >= 9) return 1;
  return unit >= 4.5 ? 2 : 5;
}

function Lattice({
  bounds,
  geometry,
  width,
  height,
  x,
  y,
}: {
  bounds: GridBounds;
  geometry: PanelGeometry;
  width: number;
  height: number;
  x: number;
  y: number;
}) {
  const step = gridStep(geometry.unit);
  const lines = [];
  const spanMargin = 1;
  for (let gx = bounds.minX - spanMargin; gx <= bounds.maxX + spanMargin; gx += 1) {
    if (gx % step !== 0) continue;
    const px = geometry.sx(gx);
    if (px < x || px > x + width) continue;
    lines.push(
      <line
        key={`x${gx}`}
        x1={px}
        x2={px}
        y1={y}
        y2={y + height}
        strokeWidth={gx === 0 ? 1.5 : 1}
        className={gx === 0 ? 'stroke-edge' : 'stroke-line'}
      />,
    );
  }
  for (let gy = bounds.minY - spanMargin; gy <= bounds.maxY + spanMargin; gy += 1) {
    if (gy % step !== 0) continue;
    const py = geometry.sy(gy);
    if (py < y || py > y + height) continue;
    lines.push(
      <line
        key={`y${gy}`}
        x1={x}
        x2={x + width}
        y1={py}
        y2={py}
        strokeWidth={gy === 0 ? 1.5 : 1}
        className={gy === 0 ? 'stroke-edge' : 'stroke-line'}
      />,
    );
  }
  return <g>{lines}</g>;
}

interface ShapeProps {
  from: Transform;
  to: Transform;
  geometry: PanelGeometry;
  /** Warns when the beat is about losing area or flipping. */
  tone: 'brand' | 'warn';
}

/** The unit square and î, ĵ under I + t(M − I), set directly on the nodes so React stays out of it. */
function Shape({ from, to, geometry, tone }: ShapeProps) {
  const { ms, still } = useContext(BeatClockContext);
  const polygon = useRef<SVGPolygonElement>(null);
  const iLine = useRef<SVGLineElement>(null);
  const jLine = useRef<SVGLineElement>(null);
  // Goes inside url(#…), which not every browser reads with the punctuation useId can return.
  const markerI = useId().replace(/\W/g, '');
  const markerJ = useId().replace(/\W/g, '');

  const pointsOf = ([a, b, c, d]: Transform) => {
    const { sx, sy } = geometry;
    return {
      origin: [sx(0), sy(0)],
      i: [sx(a), sy(c)],
      j: [sx(b), sy(d)],
      corner: [sx(a + b), sy(c + d)],
    };
  };

  const draw = (transform: Transform) => {
    const { origin, i, j, corner } = pointsOf(transform);
    polygon.current?.setAttribute('points', `${origin} ${i} ${corner} ${j}`);
    iLine.current?.setAttribute('x2', String(i[0]));
    iLine.current?.setAttribute('y2', String(i[1]));
    jLine.current?.setAttribute('x2', String(j[0]));
    jLine.current?.setAttribute('y2', String(j[1]));
  };

  // Before paint: React has just drawn the end of the beat, and this puts the start back.
  useLayoutEffect(() => {
    if (still || from.every((value, index) => value === to[index])) {
      draw(to);
      return;
    }
    draw(from);
    const duration = ms * MOVE_SHARE;
    let startedAt: number | null = null;
    let frame = requestAnimationFrame(function tick(now) {
      startedAt ??= now;
      const t = Math.min(1, (now - startedAt) / duration);
      draw(lerp(from, to, easeInOut(t)));
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `to` only changes with the beat.
  }, [to.join(), from.join(), ms, still]);

  const { origin, i, j, corner } = pointsOf(to);
  const stroke = tone === 'warn' ? 'stroke-warn' : 'stroke-cta';
  const fill = tone === 'warn' ? 'fill-warn' : 'fill-cta';

  return (
    <g>
      <defs>
        <marker
          id={markerI}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
        >
          <path d="M0 0L10 5L0 10z" className="fill-brand" />
        </marker>
        <marker
          id={markerJ}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
        >
          <path d="M0 0L10 5L0 10z" className="fill-good" />
        </marker>
      </defs>
      <polygon
        ref={polygon}
        points={`${origin} ${i} ${corner} ${j}`}
        strokeWidth={2.5}
        strokeLinejoin="round"
        fillOpacity={0.25}
        className={`${stroke} ${fill}`}
      />
      <line
        ref={iLine}
        x1={origin[0]}
        y1={origin[1]}
        x2={i[0]}
        y2={i[1]}
        strokeWidth={3}
        markerEnd={`url(#${markerI})`}
        className="stroke-brand"
      />
      <line
        ref={jLine}
        x1={origin[0]}
        y1={origin[1]}
        x2={j[0]}
        y2={j[1]}
        strokeWidth={3}
        markerEnd={`url(#${markerJ})`}
        className="stroke-good"
      />
    </g>
  );
}

/** The frame before this beat in the spec's own order, so a beat always animates from what is showing. */
function previousFrame(spec: Props['spec'], beat: GridBeat): Matrix[] | undefined {
  const index = spec.beats.indexOf(beat);
  for (let k = index - 1; k >= 0; k -= 1) {
    const frame = spec.params.frames[spec.beats[k]];
    if (frame) return frame;
  }
  return undefined;
}

/** SCENES §3.3. The picture is a parallelogram on a fixed lattice, with î and ĵ in their own colors. */
export function GridTransform({ spec, beat }: Props) {
  const { params } = spec;
  const panels = params.frames[beat] ?? params.frames.unit ?? [];
  const previous = previousFrame(spec, beat);
  const isWarn = beat === 'cant_undo' || beat === 'flip';

  const shown = params.shown;
  const boxes = shown.map(({ value }) => matrixBox(value, 16, 26));
  const bandHeight = Math.max(...boxes.map((box) => box.height)) + 22;
  const panelLabel = params.panels ? 24 : 0;
  const panelTop = bandHeight + panelLabel;
  const stageHeight = HEIGHT - panelTop - BOTTOM;
  const count = panels.length;
  const gap = 12;
  const panelWidth = (WIDTH - gap * (count - 1)) / count;

  // Room for "−2A =", which is wider than "A =".
  const nameWidths = shown.map(({ label }) => label.length * 8 + 22);
  const labelWidths = shown.map((_, index) => boxes[index].width + nameWidths[index]);
  const bandWidth = labelWidths.reduce((sum, value) => sum + value, 0) + 12 * (shown.length - 1);
  const labelX = (index: number) =>
    (WIDTH - bandWidth) / 2 +
    labelWidths.slice(0, index).reduce((sum, value) => sum + value + 12, 0);
  const lowY = HEIGHT - BOTTOM / 2;
  const mark = params.marks[beat];

  return (
    <Stage>
      {shown.map(({ label, value, from }, index) => {
        const box = boxes[index];
        const x = labelX(index);
        const visible = from === 'unit' || spec.beats.indexOf(beat) >= spec.beats.indexOf(from);
        const y = 6 + (bandHeight - 22 - box.height) / 2;
        return (
          <Reveal key={label} show={visible}>
            <SvgText
              x={x + nameWidths[index] - 6}
              y={y + box.height / 2}
              size={14}
              anchor="end"
              className="fill-muted font-hand"
            >
              {`${label} =`}
            </SvgText>
            <SvgMatrix value={value} box={box} size={16} x={x + nameWidths[index]} y={y} />
          </Reveal>
        );
      })}

      {panels.map((panel, index) => {
        const x = index * (panelWidth + gap);
        const geometry = geometryOf(params.bounds, x, panelTop, panelWidth, stageHeight);
        const from = approx(previous?.[index] ?? panel);
        return (
          <g key={index}>
            {params.panels && (
              <HandText
                x={x + panelWidth / 2}
                y={panelTop - 12}
                size={18}
                className="fill-ink font-semibold"
              >
                {params.panels[index]}
              </HandText>
            )}
            <Lattice
              bounds={params.bounds}
              geometry={geometry}
              x={x}
              y={panelTop}
              width={panelWidth}
              height={stageHeight}
            />
            <Shape
              from={from}
              to={approx(panel)}
              geometry={geometry}
              tone={isWarn ? 'warn' : 'brand'}
            />
          </g>
        );
      })}

      {mark && (
        <Reveal show start={0.3} pop>
          <HandText
            x={WIDTH / 2}
            y={lowY}
            size={fitted(mark, 38)}
            className={`font-semibold ${isWarn ? 'fill-warn' : 'fill-cta'}`}
          >
            {mark}
          </HandText>
        </Reveal>
      )}

      {params.try && beat === 'try' && (
        <Choices options={params.try.options} right={params.try.right} y={HEIGHT - BOTTOM + 14} />
      )}
      {params.try && (
        <>
          <Reveal show={beat === 'try_done'} start={0.1} pop>
            <HandText
              x={WIDTH / 2 - 16}
              y={lowY}
              size={fitted(params.try.options[params.try.right], 36, 240)}
              className="fill-cta font-semibold"
            >
              {params.try.options[params.try.right]}
            </HandText>
          </Reveal>
          <Tick x={WIDTH / 2 + 120} y={lowY} size={14} show={beat === 'try_done'} start={0.25} />
        </>
      )}
    </Stage>
  );
}
