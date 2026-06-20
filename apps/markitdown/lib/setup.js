// One-command, idiot-proof setup for the markitdown service.
//   npm run markitdown:setup
// Finds a working python, creates the service venv, installs requirements, and
// verifies markitdown imports. Every failure prints exactly what to do next.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { SERVICE_DIR, VENV_PYTHON } from './env.js';

const ok = (m) => console.log(`\x1b[32m✓\x1b[0m ${m}`);
const info = (m) => console.log(`  ${m}`);
const die = (m) => { console.error(`\x1b[31m✗ ${m}\x1b[0m`); process.exit(1); };

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: SERVICE_DIR, stdio: 'inherit', ...opts });
  return r.status === 0;
}

function probe(cmd) {
  const r = spawnSync(cmd, ['--version'], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  const out = (r.stdout || r.stderr || '').trim();
  const m = out.match(/(\d+)\.(\d+)/);
  if (!m) return null;
  return { cmd, major: +m[1], minor: +m[2], version: out };
}

// 1. Find a usable python (3.10+)
const candidates = process.platform === 'win32'
  ? ['py', 'python', 'python3']
  : ['python3', 'python'];
let py = null;
for (const c of candidates) {
  const p = probe(c);
  if (p && (p.major > 3 || (p.major === 3 && p.minor >= 10))) { py = p; break; }
}
if (!py) {
  die('No python 3.10+ found on PATH. Install from https://python.org then re-run: npm run markitdown:setup');
}
ok(`Found ${py.version} (${py.cmd})`);

// 2. Create the venv (skip if already there)
if (fs.existsSync(VENV_PYTHON)) {
  ok('venv already exists');
} else {
  info('Creating venv…');
  if (!run(py.cmd, ['-m', 'venv', '.venv'])) {
    die('Failed to create venv. On Debian/Ubuntu you may need: sudo apt install python3-venv');
  }
  ok('venv created');
}

// 3. Install requirements into the venv
info('Installing markitdown[all] + fastapi + uvicorn (first run downloads a lot)…');
run(VENV_PYTHON, ['-m', 'pip', 'install', '--upgrade', 'pip', '--quiet']);
if (!run(VENV_PYTHON, ['-m', 'pip', 'install', '-r', path.join(SERVICE_DIR, 'requirements.txt')])) {
  die('pip install failed — scroll up for the error.');
}
ok('dependencies installed');

// 4. Verify markitdown actually imports
if (!run(VENV_PYTHON, ['-c', 'import markitdown; print("markitdown", markitdown.__version__ if hasattr(markitdown,"__version__") else "ok")'])) {
  die('markitdown installed but failed to import — see error above.');
}

console.log('');
ok('Setup complete. Start the sandbox with: npm run dev');
info('The markitdown app will auto-start the service (MARKITDOWN_LAUNCH=spawn).');
