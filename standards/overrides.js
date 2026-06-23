/**
 * Per-app rule exceptions.
 *
 * If an app intentionally violates a standard, declare it here with a reason.
 * Three or more overrides of the same rule is a signal the rule needs review.
 *
 * Shape: { appName, ruleId, reason }
 */

export const overrides = [
  // Example (remove when first real override is added):
  // {
  //   appName: 'markitdown',
  //   ruleId: 'ui-dark-theme',
  //   reason: 'Renders output from external tool that ships its own light-mode styles.',
  // },
]

export function getOverrides(appName) {
  return overrides.filter(o => o.appName === appName)
}

export function isOverridden(appName, ruleId) {
  return overrides.some(o => o.appName === appName && o.ruleId === ruleId)
}
