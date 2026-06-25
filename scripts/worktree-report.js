#!/usr/bin/env node
/**
 * Reports on every git worktree: age, ahead/behind main, uncommitted changes,
 * and the commit subjects unique to its branch (since worktree names are
 * random and don't describe what the work is).
 */

import { execSync } from 'child_process'

const STALE_DAYS = Number(process.env.WORKTREE_STALE_DAYS ?? 3)

function sh(cmd, cwd) {
  return execSync(cmd, { encoding: 'utf8', cwd }).trim()
}

function parseWorktrees(porcelain) {
  const entries = []
  let cur = {}
  for (const line of porcelain.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (cur.path) entries.push(cur)
      cur = { path: line.slice('worktree '.length) }
    } else if (line.startsWith('branch ')) {
      cur.branch = line.slice('branch '.length).replace('refs/heads/', '')
    } else if (line === '') {
      // separator
    }
  }
  if (cur.path) entries.push(cur)
  return entries
}

const porcelain = sh('git worktree list --porcelain')
const worktrees = parseWorktrees(porcelain)
const mainEntry = worktrees.find(w => w.branch === 'main')
const mainPath = mainEntry?.path

const now = Date.now()
const report = []

for (const wt of worktrees) {
  if (wt.branch === 'main') continue

  const lastCommitIso = sh('git log -1 --format=%cI', wt.path)
  const ageDays = Math.floor((now - new Date(lastCommitIso).getTime()) / 86400000)

  let aheadBehind = '0/0'
  try {
    const out = sh(`git rev-list --left-right --count main...HEAD`, wt.path)
    const [behind, ahead] = out.split(/\s+/)
    aheadBehind = `${ahead} ahead / ${behind} behind`
  } catch {
    aheadBehind = 'unknown (no shared history with main)'
  }

  let subjects = []
  try {
    const log = sh(`git log main..HEAD --format=%s`, wt.path)
    subjects = log ? log.split('\n') : []
  } catch {
    subjects = []
  }

  let dirty = []
  try {
    const status = sh('git status --porcelain', wt.path)
    dirty = status ? status.split('\n') : []
  } catch {
    dirty = []
  }

  report.push({
    path: wt.path,
    branch: wt.branch,
    ageDays,
    aheadBehind,
    subjects,
    uncommittedCount: dirty.length,
    stale: ageDays >= STALE_DAYS
  })
}

console.log(`Worktree report — ${new Date().toISOString().slice(0, 10)} (main: ${mainPath})\n`)

if (report.length === 0) {
  console.log('No worktrees besides main.')
  process.exit(0)
}

for (const r of report) {
  console.log(`${r.stale ? '[STALE] ' : ''}${r.branch}`)
  console.log(`  path: ${r.path}`)
  console.log(`  last commit: ${r.ageDays}d ago | ${r.aheadBehind} vs main | ${r.uncommittedCount} uncommitted file(s)`)
  if (r.subjects.length) {
    console.log('  commits unique to this branch:')
    for (const s of r.subjects) console.log(`    - ${s}`)
  } else {
    console.log('  commits unique to this branch: (none — branch matches main)')
  }
  console.log('')
}

const staleCount = report.filter(r => r.stale).length
console.log(`${staleCount} of ${report.length} worktree(s) are stale (>= ${STALE_DAYS}d since last commit).`)
