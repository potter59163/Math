import type { ScenePurpose, TemplateId } from '@/lib/topics/matrix/scenes';
import type { StorageLike } from './store';

// `scene_view` has nowhere to go until /api/event in Phase 5, so views stay on this device, apart
// from the profile. Nothing here is ever sent. Phase 5 replaces this with the real event.

/** The fields of `scene_views` in SPEC §13. */
export interface SceneViewRecord {
  studentId: string;
  decisionId: null;
  template: TemplateId;
  purpose: ScenePurpose;
  beatsTotal: number;
  beatsSeen: number;
  replays: number;
  skipped: boolean;
  durationMs: number;
  createdAt: string;
}

/** A class period plays far fewer than this. The newest views stay. */
export const MAX_SCENE_VIEWS = 200;

const logKey = (studentId: string) => `math:scene-views:${studentId}`;

export function createSceneLog(getStorage: () => StorageLike) {
  const read = (storage: StorageLike, studentId: string): SceneViewRecord[] => {
    const text = storage.getItem(logKey(studentId));
    if (text === null) return [];
    const stored: unknown = JSON.parse(text);
    return Array.isArray(stored) ? (stored as SceneViewRecord[]) : [];
  };

  const all = (studentId: string): SceneViewRecord[] => {
    try {
      return read(getStorage(), studentId);
    } catch {
      return [];
    }
  };

  return {
    all,
    add(view: SceneViewRecord): void {
      try {
        const views = [...all(view.studentId), view].slice(-MAX_SCENE_VIEWS);
        getStorage().setItem(logKey(view.studentId), JSON.stringify(views));
      } catch {
        // Losing a log line must never get in the way of the lesson.
      }
    },
  };
}

export const sceneLog = createSceneLog(() => window.localStorage);
