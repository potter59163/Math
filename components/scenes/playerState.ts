/** What `scene_views` records about one play of a scene (SPEC §13). */
export interface SceneView {
  beatsTotal: number;
  beatsSeen: number;
  replays: number;
  skipped: boolean;
  durationMs: number;
}
