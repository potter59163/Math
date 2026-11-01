// Preferences that belong to a device rather than a student: a shared lab computer stays dark or light
// whoever sits at it. The page applies them from a small inline script before its first paint.

export type ColorScheme = 'system' | 'light' | 'dark';

export interface DeviceSettings {
  scheme: ColorScheme;
  reduceMotion: boolean;
  voice: boolean;
}

export const DEFAULT_SETTINGS: DeviceSettings = {
  scheme: 'system',
  reduceMotion: false,
  voice: false,
};

const KEY = 'math:settings';

export const SETTINGS_BOOT_SCRIPT = `try{var s=JSON.parse(localStorage.getItem('${KEY}')||'{}'),d=document.documentElement;if(s.scheme==='light'||s.scheme==='dark')d.dataset.scheme=s.scheme;if(s.reduceMotion)d.dataset.motion='reduce'}catch(e){}`;

let current: DeviceSettings | null = null;
const listeners = new Set<() => void>();

function read(): DeviceSettings {
  try {
    const stored = JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Partial<DeviceSettings>;
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function apply({ scheme, reduceMotion }: DeviceSettings) {
  const { dataset } = document.documentElement;
  if (scheme === 'system') delete dataset.scheme;
  else dataset.scheme = scheme;
  if (reduceMotion) dataset.motion = 'reduce';
  else delete dataset.motion;
}

export const deviceSettings = {
  /** Returns the same object until something changes, as useSyncExternalStore requires. */
  get(): DeviceSettings {
    current ??= read();
    return current;
  },
  getServer: () => DEFAULT_SETTINGS,
  set(change: Partial<DeviceSettings>) {
    current = { ...deviceSettings.get(), ...change };
    try {
      window.localStorage.setItem(KEY, JSON.stringify(current));
    } catch {
      // Blocked storage: it still applies until the page goes away.
    }
    apply(current);
    for (const listener of listeners) listener();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** The device's own Thai voice, where it has one. Without one this does nothing, and captions remain. */
export function speakThai(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'th-TH';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}
