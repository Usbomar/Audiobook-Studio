export type EditorSettings = {
  volume: number;
  speed: number;
  pitch: number;
  bass: number;
  mid: number;
  treble: number;
  intensity: number;
};

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  volume: 100,
  speed: 100,
  pitch: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  intensity: 0,
};

export const PITCH_OPTIONS = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6] as const;
