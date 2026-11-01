/** What `scene_views` records about one play of a scene (SPEC §13). */
export interface SceneView {
  beatsTotal: number;
  beatsSeen: number;
  replays: number;
  skipped: boolean;
  durationMs: number;
}

export interface PlayerState {
  beat: number;
  total: number;
  furthest: number;
  replays: number;
  skipped: boolean;
  finished: boolean;
}

export type PlayerAction = { type: 'next' } | { type: 'replay' } | { type: 'skip' };

export function initialPlayer(total: number): PlayerState {
  return { beat: 0, total, furthest: 0, replays: 0, skipped: false, finished: false };
}

/** The student sets the pace: nothing moves on without a tap (SCENES §1). */
export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  if (state.finished) return state;
  const atLast = state.furthest === state.total - 1;
  switch (action.type) {
    case 'next': {
      if (state.beat === state.total - 1) return { ...state, finished: true };
      const beat = state.beat + 1;
      return { ...state, beat, furthest: Math.max(state.furthest, beat) };
    }
    case 'replay':
      return { ...state, beat: 0, replays: state.replays + 1 };
    case 'skip':
      return { ...state, finished: true, skipped: !atLast };
  }
}

export function viewOf(state: PlayerState, durationMs: number): SceneView {
  return {
    beatsTotal: state.total,
    beatsSeen: state.furthest + 1,
    replays: state.replays,
    skipped: state.skipped,
    durationMs,
  };
}
