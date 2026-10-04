/**
 * Dev launcher: starts the Vite dev server for the UI, waits for it to
 * answer, then starts Electron pointed at it. Ctrl+C tears both down.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const uiDir = resolve(here, '..', '..', 'ui');
const viteBin = resolve(uiDir, 'node_modules', 'vite', 'bin', 'vite.js');
const URL_ = process.env.ELECTRON_START_URL || 'http://127.0.0.1:5173';

const children = [];
function shutdown(code = 0) {
  for (const c of children) {
    if (c.exitCode === null) c.kill();
  }
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('[tontoo] starting vite dev server …');
const vite = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {
  cwd: uiDir,
  stdio: 'inherit',
  shell: false,
});
children.push(vite);
vite.on('exit', (c) => {
  console.log(`[tontoo] vite exited (${c})`);
  shutdown(c ?? 0);
});

async function waitForServer(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok || res.status < 500) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

if (!(await waitForServer(URL_))) {
  console.error(`[tontoo] dev server never answered at ${URL_}`);
  shutdown(1);
}

console.log('[tontoo] starting electron …');
const electronBin = (await import('electron')).default;
const electron = spawn(electronBin, ['.'], {
  cwd: resolve(here, '..'),
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_START_URL: URL_ },
  shell: false,
});
children.push(electron);
electron.on('exit', (c) => {
  console.log(`[tontoo] electron exited (${c})`);
  shutdown(c ?? 0);
});