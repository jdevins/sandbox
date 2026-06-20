import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve everything relative to this app folder so it travels as a unit.
const here = path.dirname(fileURLToPath(import.meta.url));
export const APP_DIR = path.resolve(here, '..');
export const SERVICE_DIR = path.join(APP_DIR, 'service');

const isWin = process.platform === 'win32';

/** Path to the python inside the service venv (created by setup). */
export const VENV_PYTHON = isWin
  ? path.join(SERVICE_DIR, '.venv', 'Scripts', 'python.exe')
  : path.join(SERVICE_DIR, '.venv', 'bin', 'python');

/**
 * Single source of truth for config. Every knob has a sane default so a fresh
 * machine works with zero env vars set.
 */
export function config() {
  const port = Number(process.env.MARKITDOWN_PORT) || 8200;
  return {
    port,
    url: process.env.MARKITDOWN_URL || `http://127.0.0.1:${port}`,
    // 'spawn' (Node manages python) | 'external' (you run it) | 'off'
    launch: (process.env.MARKITDOWN_LAUNCH || 'spawn').toLowerCase(),
    // which python to spawn with; default to the venv, fall back to PATH python
    python: process.env.MARKITDOWN_PYTHON || VENV_PYTHON,
  };
}
