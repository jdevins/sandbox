import { runClaude } from '../../../src/llmObserver.js';

// Routed through the shared observer (src/llmObserver.js) so every completion
// is tagged app='storyboard' and shows up live in the observability
// dashboard. `feature`/`agent` default at construction time; a per-call
// complete({ feature, agent }) overrides them.
export function cliProvider({ model, feature = null, agent = null } = {}) {
  return {
    name: 'cli',
    model: model || 'claude',
    async complete({ system, prompt, model: callModel, feature: callFeature, agent: callAgent } = {}) {
      const result = await runClaude({
        app: 'storyboard',
        feature: callFeature || feature,
        agent: callAgent || agent,
        prompt,
        system,
        model: callModel || model,
      });
      if (result.status === 'error') throw new Error(result.text || 'claude CLI error');
      return { text: (result.text || '').trim(), provider: 'cli', model: callModel || model || 'claude' };
    },
  };
}

export function getProvider(opts = {}) {
  return cliProvider({ model: process.env.SB_MODEL, ...opts });
}
