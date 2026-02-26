/** Reactive settings store with LocalStorage persistence */

const STORAGE_KEY = 'spacepunch_settings';

export interface Settings {
  useStagePresets: boolean;
  meteorIntensity: number; // 1–10
  trailSpeed: number;      // 1–10
  selectedSkinId: string;
  muted: boolean;
}

type Listener = (s: Settings) => void;

const DEFAULTS: Settings = {
  useStagePresets: true,
  meteorIntensity: 4,
  trailSpeed: 4,
  selectedSkinId: 'default',
  muted: false,
};

function loadFromStorage(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...parsed };
    }
  } catch { /* ignore corrupt data */ }
  return { ...DEFAULTS };
}

function saveToStorage(s: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch { /* storage full or unavailable */ }
}

class SettingsStore {
  private settings: Settings = loadFromStorage();
  private listeners: Listener[] = [];

  get(): Readonly<Settings> {
    return this.settings;
  }

  set(partial: Partial<Settings>): void {
    Object.assign(this.settings, partial);
    saveToStorage(this.settings);
    this.notify();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  private notify(): void {
    for (const fn of this.listeners) fn(this.settings);
  }
}

export const settingsStore = new SettingsStore();
