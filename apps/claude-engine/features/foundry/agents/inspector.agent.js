// The inspector is the EVALUATOR. It builds nothing; each tick it checks the
// work against the goal and reports progress, declaring the mission complete
// when every target cell is filled. In richer scenarios this is where a
// critic/quality loop would reject bad output and send work back.

export const definition = {
  id: 'inspector',
  name: 'Inspector',
  role: 'inspector',
  strategy: {},
};

export function decide(p, _ctx) {
  const total = p.view.targets.length;
  const filled = p.view.targets.filter((t) => t.filled).length;
  if (filled === total) {
    return { tool: 'inspect', args: { done: true }, rationale: `all ${total} cells verified — structure complete` };
  }
  return { tool: 'inspect', args: { done: false }, rationale: `verified ${filled}/${total} cells` };
}
