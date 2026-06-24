// Shared build-stamp helper.
//
// Renders the bottom-right "ghost" stamp every page carries: the app version
// plus how long ago the *running code* loaded. The point is a glance-test —
// "am I looking at my latest change?" — not a release date:
//   green dot + "loaded just now"  → fresh: the running module loaded seconds
//                                    ago, i.e. your save/restart took effect.
//   dim       + "loaded 6m ago"    → stale tab, or a different server/worktree
//                                    that never picked up your change.
// The relative time is live-ticked client-side from the embedded load epoch,
// so a tab you switch back to keeps counting up (and stays honestly stale until
// you reload).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Server-process boot time. Captured when this module is first evaluated — i.e.
// at process start; a `node --watch` restart re-evaluates it. Used for the
// dashboard's own pages, whose "reload" is a server restart.
export const BOOT = Date.now();

// Dashboard/server version, read once from package.json.
export const serverVersion = (() => {
  try {
    return JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')).version || null;
  } catch {
    return null;
  }
})();

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// One self-contained script, inlined with the stamp so it works on every page
// regardless of which JS bundle (if any) that page loads. Idempotent.
const SCRIPT = `<script>(function(){if(window.__ghostStamp)return;window.__ghostStamp=1;
function fmt(ms){var s=Math.round(ms/1000);if(s<10)return'just now';if(s<60)return s+'s ago';var m=Math.round(s/60);if(m<60)return m+'m ago';var h=Math.round(m/60);if(h<24)return h+'h ago';return Math.round(h/24)+'d ago';}
function tick(){var el=document.querySelector('.ghost-version');if(!el)return;var t=+el.getAttribute('data-loaded');if(!t)return;var age=Date.now()-t;var a=el.querySelector('.gv-age');if(a)a.textContent='loaded '+fmt(age);el.classList.toggle('fresh',age<60000);}
tick();setInterval(tick,1000);document.addEventListener('visibilitychange',tick);})();</script>`;

/**
 * Returns the ghost-stamp HTML fragment (plus its tick script). Drop it just
 * before </body>. `loadedAt` should be the module-load epoch of the rendering
 * app (see each app's LOADED_AT) so it resets on both a process restart and a
 * dashboard Restart.
 */
export function ghostStamp({ version, loadedAt } = {}) {
  const v = version ? `<span class="gv-v">v${esc(version)}</span>` : '';
  const at = Number(loadedAt) || Date.now();
  return (
    `<div class="ghost-version" data-loaded="${at}">` +
    `${v}<span class="gv-dot"></span><span class="gv-age">loaded just now</span>` +
    `</div>${SCRIPT}`
  );
}
