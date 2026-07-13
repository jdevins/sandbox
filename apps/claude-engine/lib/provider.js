/**
 * LLM provider interface — modular and swappable.
 *
 * A provider implements:
 *   name: string
 *   model: string
 *   async complete({ system, prompt, model }) -> { text, usage, provider, model }
 *
 * Default: cliProvider — shells out to the local `claude -p` CLI, no API key needed.
 * Set ENGINE_LLM=mock to force offline/deterministic mode.
 */

import { runClaude } from '../../../src/llmObserver.js';

export function mockProvider() {
  return {
    name: 'mock',
    model: 'mock-1',
    async complete({ system, prompt, model } = {}) {
      const basis = `${system || ''}\n${prompt || ''}`.trim();
      const words = basis.split(/\s+/).filter(Boolean);
      const text =
        `「mock reply」 ${words.length} input tokens(ish). ` +
        `Echo: ${basis.slice(0, 160)}${basis.length > 160 ? '…' : ''}`;
      return {
        text,
        usage: { input: words.length, output: text.split(/\s+/).length },
        provider: 'mock',
        model: model || 'mock-1',
      };
    },
  };
}

/**
 * Shells out to the local `claude -p` CLI via the shared observer
 * (src/llmObserver.js), so every completion is tagged app='claude-engine' and
 * shows up live (tool calls, usage) in the observability dashboard — not just
 * as a final blob here. `feature`/`agent` at construction time are the
 * default tags; a per-call `complete({ feature, agent })` overrides them,
 * so a feature-scoped provider can still be re-tagged per agent/skill run.
 */
export function cliProvider({ model, feature = null, agent = null } = {}) {
  return {
    name: 'cli',
    model: model || 'claude',
    async complete({ system, prompt, model: callModel, feature: callFeature, agent: callAgent } = {}) {
      // Use the CLI's native --system-prompt flag instead of hand-wrapping in
      // literal <system> tags — that wrapper was itself indistinguishable from
      // a real injection attempt and is what triggered recurring false-positive
      // flagging, independent of anything in the content.
      const result = await runClaude({
        app: 'claude-engine',
        feature: callFeature || feature,
        agent: callAgent || agent,
        prompt,
        system,
        model: callModel || model,
      });
      if (result.status === 'error') throw new Error(result.text || 'claude CLI error');
      return { text: (result.text || '').trim(), usage: result.usage || {}, provider: 'cli', model: callModel || model || 'claude' };
    },
  };
}

/** Choose a provider from the environment. Defaults to local CLI. */
export function getProvider(env = process.env, { feature, agent } = {}) {
  if (env.ENGINE_LLM === 'mock') return mockProvider();
  return cliProvider({ model: env.ENGINE_MODEL, feature, agent });
}

/** Re-tags an existing provider instance with a feature/agent for one scope — e.g. an agent run wrapping the engine's shared ctx.provider. */
export function withTags(provider, tags) {
  return { ...provider, complete: (args) => provider.complete({ ...args, ...tags }) };
}
