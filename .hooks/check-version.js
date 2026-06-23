/**
 * Pre-commit version check.
 * Enforces standards rules: process-version-required (error) and
 * process-version-on-commit (warning).
 */

import { execSync } from 'child_process'

const staged = execSync('git diff --cached --name-only', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)

// Only care about app entry points
const appIndexFiles = staged.filter(f => /^apps\/[^/]+\/index\.js$/.test(f))

if (appIndexFiles.length === 0) process.exit(0)

let hasError = false

for (const file of appIndexFiles) {
  const appName = file.split('/')[1]

  let stagedContent
  try {
    stagedContent = execSync(`git show :${file}`, { encoding: 'utf8' })
  } catch {
    continue
  }

  const versionMatch = stagedContent.match(/version:\s*['"]([^'"]+)['"]/)
  if (!versionMatch) {
    console.error(`[standards] ERROR (process-version-required): ${appName}/index.js meta is missing a version field.`)
    hasError = true
    continue
  }

  const stagedVersion = versionMatch[1]

  let headContent
  try {
    headContent = execSync(`git show HEAD:${file}`, { encoding: 'utf8' })
  } catch {
    // New app — no HEAD to compare against
    continue
  }

  const headVersionMatch = headContent.match(/version:\s*['"]([^'"]+)['"]/)
  const headVersion = headVersionMatch ? headVersionMatch[1] : null

  if (headVersion && stagedVersion === headVersion) {
    // Warning only — prints but does not block
    console.warn(`[standards] WARNING (process-version-on-commit): ${appName} changed but version is still ${stagedVersion}. Consider incrementing meta.version.`)
  }
}

process.exit(hasError ? 1 : 0)
