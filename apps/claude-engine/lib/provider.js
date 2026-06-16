/**
 * LLM provider interface — modular and swappable.
 *
 * A provider implements:
 *   name: string
 *   model: string
 *   async complete({ system, prompt, model }) -> { text, usage, provider, model }
 *
 * The mock provider is the default so the whole engine runs offline and
 * deterministically. Swap in a real Anthropic provider by setting
 * ANTHROPIC_API_KEY (and implementing the call) without touching callers.
 */

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
 * Placeholder for the live provider. Intentionally not wired — implement the
 * fetch to https://api.anthropic.com/v1/messages here when going live.
 */
export function anthropicProvider({ apiKey, model = 'claude-opus-4-8' } = {}) {
  return {
    name: 'anthropic',
    model,
    async complete() {
      throw new Error(
        'anthropicProvider is not wired yet. Implement the API call in lib/provider.js ' +
          'or unset ANTHROPIC_API_KEY to use the mock provider.',
      );
    },
  };
}

/** Choose a provider from the environment. Defaults to mock. */
export function getProvider(env = process.env) {
  if (env.ANTHROPIC_API_KEY && env.ENGINE_LLM === 'anthropic') {
    return anthropicProvider({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return mockProvider();
}
