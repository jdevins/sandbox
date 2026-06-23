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

import { spawn } from 'node:child_process';

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

/** Shells out to the local `claude -p` CLI. No API key required. */
export function cliProvider({ model } = {}) {
  return {
    name: 'cli',
    model: model || 'claude',
    async complete({ system, prompt } = {}) {
      const fullPrompt = system
        ? `<system>\n${system}\n</system>\n\n${prompt || ''}`
        : (prompt || '');

      return new Promise((resolve, reject) => {
        const args = ['-p'];
        if (model) args.push('--model', model);

        const child = spawn('claude', args, { shell: true });
        let output = '';
        let errOut = '';

        child.stdout.on('data', (d) => (output += d.toString()));
        child.stderr.on('data', (d) => (errOut += d.toString()));
        child.on('error', (err) => reject(new Error(`Failed to launch claude CLI: ${err.message}`)));
        child.on('close', (code) => {
          if (code !== 0 && !output.trim()) {
            reject(new Error(`claude CLI exited ${code}: ${errOut.trim() || '(no output)'}`));
          } else {
            resolve({ text: output.trim(), usage: {}, provider: 'cli', model: model || 'claude' });
          }
        });

        child.stdin.write(fullPrompt);
        child.stdin.end();
      });
    },
  };
}

/** Choose a provider from the environment. Defaults to local CLI. */
export function getProvider(env = process.env) {
  if (env.ENGINE_LLM === 'mock') return mockProvider();
  return cliProvider({ model: env.ENGINE_MODEL });
}
