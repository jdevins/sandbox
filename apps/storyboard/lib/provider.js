import { spawn } from 'node:child_process';

export function cliProvider({ model } = {}) {
  return {
    name: 'cli',
    model: model || 'claude',
    async complete({ system, prompt } = {}) {
      return new Promise((resolve, reject) => {
        const args = ['-p'];
        if (model) args.push('--model', model);
        if (system) args.push('--system-prompt', system);
        const child = spawn('claude', args, { shell: false });
        let output = '', errOut = '';
        child.stdout.on('data', (d) => (output += d.toString()));
        child.stderr.on('data', (d) => (errOut += d.toString()));
        child.on('error', (err) => reject(new Error(`Failed to launch claude CLI: ${err.message}`)));
        child.on('close', (code) => {
          if (code !== 0 && !output.trim()) {
            reject(new Error(`claude CLI exited ${code}: ${errOut.trim() || '(no output)'}`));
          } else {
            resolve({ text: output.trim(), provider: 'cli', model: model || 'claude' });
          }
        });
        child.stdin.write(prompt || '');
        child.stdin.end();
      });
    },
  };
}

export function getProvider() {
  return cliProvider({ model: process.env.SB_MODEL });
}
