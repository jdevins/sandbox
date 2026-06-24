/**
 * Pre-commit smart-quote check.
 * Enforces standards rule: ui-no-smart-quote-attrs (error).
 *
 * Smart quotes (U+201C/U+201D " ", U+2018/U+2019 ' ') silently break HTML when
 * they land in an attribute-delimiter position inside an `html` tagged template,
 * e.g. class="collapsible" reads as the literal class "collapsible" and all CSS
 * fails with no error. We only flag a smart quote acting as a delimiter — one
 * immediately following `=` — so legitimate smart quotes in display TEXT
 * (don't, "Repack today") are left alone.
 */

import { execSync } from 'child_process'

const SMART = '[“”‘’]'
// A smart quote sitting right where an attribute's opening delimiter belongs.
const ATTR_DELIM = new RegExp('=' + SMART)

const staged = execSync('git diff --cached --name-only', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter(f => /\.(js|ejs)$/.test(f))

if (staged.length === 0) process.exit(0)

let hasError = false

for (const file of staged) {
  let content
  try {
    content = execSync(`git show :${file}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
  } catch {
    continue
  }

  content.split('\n').forEach((line, i) => {
    if (ATTR_DELIM.test(line)) {
      console.error(
        `[standards] ERROR (ui-no-smart-quote-attrs): ${file}:${i + 1} — smart quote used as an HTML attribute delimiter. ` +
        `Use a straight " or ' there. (Smart quotes in display text are fine.)`
      )
      console.error(`    ${line.trim()}`)
      hasError = true
    }
  })
}

process.exit(hasError ? 1 : 0)
