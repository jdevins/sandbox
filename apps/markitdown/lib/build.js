// Build the standalone MarkItDown exe.
//   npm run markitdown:build
//
// Requires the venv to exist first (npm run markitdown:setup).
// Installs PyInstaller into the venv automatically if needed.
// Output: apps/markitdown/dist/markitdown/markitdown.exe
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERVICE_DIR, VENV_PYTHON } from './env.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(here, '..');
const DIST_DIR = path.join(APP_DIR, 'dist');
const SPEC = path.join(SERVICE_DIR, 'markitdown.spec');

const ok  = (m) => console.log(`\x1b[32m✓\x1b[0m ${m}`);
const info = (m) => console.log(`  ${m}`);
const die  = (m) => { console.error(`\x1b[31m✗ ${m}\x1b[0m`); process.exit(1); };

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { stdio: 'inherit', ...opts });
}

// 1. Check venv exists
if (!fs.existsSync(VENV_PYTHON)) {
  die('venv not found — run first: npm run markitdown:setup');
}
ok('venv found');

// 2. Install PyInstaller into the venv if missing
const pyiCheck = spawnSync(VENV_PYTHON, ['-m', 'PyInstaller', '--version'], { encoding: 'utf8' });
if (pyiCheck.status !== 0) {
  info('Installing PyInstaller into venv…');
  const r = run(VENV_PYTHON, ['-m', 'pip', 'install', 'pyinstaller', '--quiet']);
  if (r.status !== 0) die('Failed to install PyInstaller — see output above');
  ok('PyInstaller installed');
} else {
  ok(`PyInstaller ${(pyiCheck.stdout || '').trim()}`);
}

// 3. Run the build
info('Building executable (this takes a minute on first run)…');
const result = run(
  VENV_PYTHON,
  ['-m', 'PyInstaller', SPEC, '--noconfirm', '--distpath', DIST_DIR],
  { cwd: SERVICE_DIR },
);
if (result.status !== 0) die('PyInstaller failed — see output above');

console.log('');
ok(`Build complete.`);
info(`Output: apps/markitdown/dist/markitdown/`);
info(`Share:  zip that folder and send it. Double-click markitdown.exe to run.`);
info(`Toggle console window: set SHOW_CONSOLE in apps/markitdown/service/markitdown.spec`);
