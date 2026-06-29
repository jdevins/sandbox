import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { html } from '../../lib/html.js';

export const meta = {
  name: 'Obsidian Workflow',
  description: 'How the Wiki and Brainstem vaults work, and whether memory is active on this machine.',
  icon: '🪶',
};

const BRAINSTEM_MARKER = 'obsidian-brainstem:start';

const WIKI_TREE = ['clients/', 'systems/', 'processes/', 'roles/', 'prompts/', 'unsorted/', 'archive/'];
const BRAINSTEM_TREE = ['Claude/Memory/', 'Claude/Daily/', 'Claude/Decisions/', 'Claude/Research/', 'Claude/Projects/', 'Claude/_bench/'];

const MAINTENANCE = [
  { group: 'Housekeeping', tag: 'auto, silent', items: ['Freshness Sweep', 'Link Repair', 'Auto-Filing', 'Metadata Backfill'] },
  { group: 'Tidying', tag: 'auto, reports back', items: ['Consolidation', 'Structure Review', 'Retirement'] },
  { group: 'Drift Watch', tag: 'flag only — your judgment', items: ['Boundary Check', 'Skill Watch'] },
  { group: 'Efficiency Check', tag: 'on-demand only', items: ['Token/tool-call comparison, vault-on vs vault-off'] },
];

export function createFeature(ctx) {
  const { ui, page, base } = ctx;
  const router = express.Router();
  const crumb = [{ href: base, label: 'Obsidian Workflow' }];
  const shell = (title, body) => page({ title, active: 'obsidian-workflow', breadcrumb: crumb, body });

  router.get('/', async (req, res) => {
    const claudeMdPath = path.join(os.homedir(), '.claude', 'CLAUDE.md');
    let brainstemActive = false;
    try {
      const text = await fs.readFile(claudeMdPath, 'utf8');
      brainstemActive = text.includes(BRAINSTEM_MARKER);
    } catch {
      /* no global CLAUDE.md yet — treat as inactive */
    }

    const vaultCard = ({ title, sub, tree, statusBadge, runHref, testHref, exportHref }) => ui.card({
      title,
      badge: statusBadge,
      desc: sub,
      meta: html`<pre class="eng-source" style="margin-top:8px">${tree.join('\n')}</pre>`,
      actions: [
        ui.btn({ href: runHref, label: 'Run' }),
        ui.btn({ href: testHref, label: 'Test (undoable)' }),
        ui.btn({ href: exportHref, label: 'Export ⤓' }),
      ],
    });

    const registryBase = `${ctx.appName ? `/apps/${ctx.appName}` : ''}/features/skills-registry`;

    const body = html`
      ${ui.pageHead({
        title: '🪶 Obsidian Workflow',
        subtitle: 'Two vaults, two jobs: a Wiki you always read, a Brainstem Claude only writes to when you turn it on.',
      })}

      <div class="eng-cols">
        ${vaultCard({
          title: 'Wiki — always on',
          sub: 'Domain knowledge: clients, systems, processes, roles. Claude reads this every time, no opt-in needed.',
          tree: WIKI_TREE,
          statusBadge: ui.badge('read-always', 'running'),
          runHref: `${registryBase}/claude-engine/obsidian-wiki/run`,
          testHref: `${registryBase}/claude-engine/obsidian-wiki/test`,
          exportHref: `${registryBase}/claude-engine/obsidian-wiki/export`,
        })}
        ${vaultCard({
          title: 'Brainstem — opt-in',
          sub: "Claude's own memory: decisions, research, daily notes. Only becomes Claude's primary memory once activated on a machine.",
          tree: BRAINSTEM_TREE,
          statusBadge: brainstemActive
            ? ui.badge('active on this machine', 'running')
            : ui.badge('not activated here', ''),
          runHref: `${registryBase}/claude-engine/obsidian-brainstem/run`,
          testHref: `${registryBase}/claude-engine/obsidian-brainstem/test`,
          exportHref: `${registryBase}/claude-engine/obsidian-brainstem/export`,
        })}
      </div>

      <h3 class="eng-section">The one rule</h3>
      ${ui.empty('Claude writes only inside Claude/. It reads the Wiki for context, but never edits it. The Wiki is yours to curate; the Brainstem is Claude\'s to maintain.')}

      <h3 class="eng-section">Maintenance, by what it actually does for you</h3>
      ${ui.table(
        ['Group', 'Automation', 'Tasks'],
        MAINTENANCE.map((m) => [m.group, m.tag, m.items.join(', ')]),
      )}

      <h3 class="eng-section">Onboarding a new machine</h3>
      ${ui.table(
        ['Step', 'What happens'],
        [
          ['1. Point at a folder', 'Existing or new — Obsidian treats any folder as a vault once opened.'],
          ['2. Run the setup skill', 'Scaffolds the folder structure and a README, only adding what\'s missing.'],
          ['3. Open it in Obsidian', 'Nothing left to configure on Obsidian\'s side.'],
          ['4. Activate memory (optional)', 'Only for the Brainstem vault — writes the directive into this machine\'s global CLAUDE.md.'],
        ],
      )}
    `;
    res.send(shell('Obsidian Workflow', body));
  });

  return router;
}
