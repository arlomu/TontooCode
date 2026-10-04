/**
 * Tontoo desktop shell — Electron main process (CommonJS).
 *
 * Dev:  loads the Vite dev server (waits until it answers).
 * Prod:  loads the built renderer from ../ui/dist via loadFile()
 *        (works offline thanks to `base: './'` in the UI vite config).
 */
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('node:path');

const DEV_URL = process.env.ELECTRON_START_URL || 'http://127.0.0.1:5173';
// App icon: Frontend/assets/icon.png (1024x1024 source).
const APP_ICON = path.resolve(__dirname, '..', '..', 'assets', 'icon.png');

const isDev = !app.isPackaged;

// Must match TITLEBAR_HEIGHT in apps/ui/src/components/TitleBar.tsx
const TITLEBAR_HEIGHT = 38;

async function waitForServer(url, tries = 90) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok || res.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`dev server did not answer at ${url}`);
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    icon: APP_ICON,
    backgroundColor: '#eceef1',
    autoHideMenuBar: true,
    // Custom title bar: the app draws its own strip across the full width so
    // the sidebar reaches the top edge, while Windows keeps the native
    // caption buttons (min/max/close) overlaid on our strip.
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#eceef1', // matches --tt-panel so the strip reads as one frame
      symbolColor: '#55606d', // matches --tt-ink-2
      height: TITLEBAR_HEIGHT,
    },
    title: 'Tontoo',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.on('ready-to-show', () => {
    win.show();
    console.log('[tontoo] window ready');
  });

  if (isDev) {
    console.log(`[tontoo] waiting for dev server at ${DEV_URL} …`);
    await waitForServer(DEV_URL);
    await win.loadURL(DEV_URL);
  } else {
    await win.loadFile(path.resolve(__dirname, '..', 'ui', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  // Native file + folder pickers for the UI.
  ipcMain.handle('tontoo:pick-files', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const res = await dialog.showOpenDialog(win, {
      title: 'Attach files',
      properties: ['openFile', 'multiSelections'],
    });
    return res.canceled ? [] : res.filePaths;
  });
  ipcMain.handle('tontoo:pick-folder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const res = await dialog.showOpenDialog(win, {
      title: 'Choose folder',
      properties: ['openDirectory'],
    });
    return res.canceled ? [] : res.filePaths;
  });
  ipcMain.handle('tontoo:pick-folders', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const res = await dialog.showOpenDialog(win, {
      title: 'Pick folders',
      properties: ['openDirectory', 'multiSelections'],
    });
    return res.canceled ? [] : res.filePaths;
  });

  createWindow().catch((err) => {
    console.error('[tontoo] failed to open window:', err);
    app.quit();
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch((err) => console.error('[tontoo] failed to open window:', err));
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
