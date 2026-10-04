/** Typed access to the Electron preload bridge (absent in plain browsers). */
export interface TontooBridge {
  platform?: string;
  isElectron?: boolean;
  titleBarHeight?: number;
  /** Native file picker — absolute paths, [] when cancelled. */
  pickFiles?: () => Promise<string[]>;
  /** Native folder picker — absolute paths, [] when cancelled. */
  pickFolder?: () => Promise<string[]>;
  /** Native multi-folder picker — absolute paths, [] when cancelled. */
  pickFolders?: () => Promise<string[]>;
  /** Recolor the native caption-button strip (theme sync). */
  setTitleOverlay?: (colors: { color: string; symbolColor: string }) => Promise<void>;
}

declare global {
  interface Window {
    tontoo?: TontooBridge;
  }
}

export {};
