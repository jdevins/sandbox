import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Auto-discovers features under features/. Mirrors the server's app discovery,
 * but scoped to this app so features stay isolated and swappable: drop a folder
 * with an index.js exporting `meta` + `createFeature(ctx)`, and it appears on the
 * app dashboard and is mounted at /features/<id>.
 */
export async function discoverFeatures(featuresDir) {
  const features = [];
  let dirents = [];
  try {
    dirents = await fs.readdir(featuresDir, { withFileTypes: true });
  } catch {
    return features;
  }
  for (const d of dirents) {
    if (!d.isDirectory() || d.name.startsWith('.') || d.name.startsWith('_')) continue;
    const entry = path.join(featuresDir, d.name, 'index.js');
    try {
      const mod = await import(pathToFileURL(entry).href);
      if (typeof mod.createFeature !== 'function') continue;
      features.push({
        id: d.name,
        meta: { name: d.name, description: '', icon: '🧩', ...(mod.meta || {}) },
        createFeature: mod.createFeature,
      });
    } catch (err) {
      features.push({ id: d.name, meta: { name: d.name, description: '(failed)', icon: '⚠️' }, error: err.message });
    }
  }
  return features.sort((a, b) => a.meta.name.localeCompare(b.meta.name));
}
