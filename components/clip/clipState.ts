// Where a clip that plays by itself has got to. Pure, so its rules can be tested without a clock.

export interface ClipState {
  index: number;
  total: number;
  paused: boolean;
  /** Goes up on a replay, so the drawing starts over from a clean first frame. */
  runs: number;
}

export type ClipAction =
  { type: 'next' } | { type: 'back' } | { type: 'toggle' } | { type: 'replay' };

export function initialClip(total: number): ClipState {
  return { index: 0, total, paused: false, runs: 0 };
}

export function clipReducer(state: ClipState, action: ClipAction): ClipState {
  switch (action.type) {
    case 'next':
      return { ...state, index: Math.min(state.index + 1, state.total - 1), paused: false };
    case 'back':
      return { ...state, index: Math.max(state.index - 1, 0), paused: false };
    case 'toggle':
      return { ...state, paused: !state.paused };
    case 'replay':
      return { ...state, index: 0, paused: false, runs: state.runs + 1 };
  }
}
