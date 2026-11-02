// Where a clip that plays by itself has got to. Pure, so its rules can be tested without a clock.

export interface ClipState {
  index: number;
  total: number;
  /** The furthest beat reached, for what `scene_views` records. */
  furthest: number;
  paused: boolean;
  /** Goes up on a replay, so the drawing starts over from a clean first frame. */
  runs: number;
}

export type ClipAction =
  { type: 'next' } | { type: 'back' } | { type: 'toggle' } | { type: 'replay' };

export function initialClip(total: number): ClipState {
  return { index: 0, total, furthest: 0, paused: false, runs: 0 };
}

export function clipReducer(state: ClipState, action: ClipAction): ClipState {
  switch (action.type) {
    case 'next': {
      const index = Math.min(state.index + 1, state.total - 1);
      return { ...state, index, furthest: Math.max(state.furthest, index), paused: false };
    }
    case 'back':
      return { ...state, index: Math.max(state.index - 1, 0), paused: false };
    case 'toggle':
      return { ...state, paused: !state.paused };
    case 'replay':
      return { ...state, index: 0, paused: false, runs: state.runs + 1 };
  }
}
