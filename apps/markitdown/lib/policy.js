import fs from 'node:fs';
import path from 'node:path';
import { APP_DIR } from './env.js';

// The acceptance policy — single source of truth shared with the Python service
// (which enforces it). Read once; the file is part of the app, always present.
let cached = null;

export function policy() {
  if (cached) return cached;
  try {
    cached = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'policy.json'), 'utf8'));
  } catch {
    // Safe fallback if the file is somehow unreadable.
    cached = { extensions: [], maxFileMB: 50, oneOffBatch: { maxFiles: 100, maxTotalMB: 250 } };
  }
  return cached;
}
