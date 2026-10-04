/**
 * Preload: the only bridge between the renderer and Node.
 * contextIsolation + sandbox stay on; the UI gets a tiny read-only API.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tontoo', {
  platform: process.platform,
  isElectron: true,
  titleBarHeight: 38,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  /** Native file picker — resolves to absolute paths, [] when cancelled. */
  pickFiles: () => ipcRenderer.invoke('tontoo:pick-files'),
  /** Native folder picker — resolves to absolute paths, [] when cancelled. */
  pickFolder: () => ipcRenderer.invoke('tontoo:pick-folder'),
  /** Native multi-folder picker — resolves to absolute paths, [] when cancelled. */
  pickFolders: () => ipcRenderer.invoke('tontoo:pick-folders'),
});
