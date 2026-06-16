/**
 * Light auth — intentionally minimal for prototyping.
 *
 * If the SANDBOX_TOKEN env var is unset, this is a pass-through and the whole
 * server is open. If it is set, every request must supply the token via either:
 *   - Header:  Authorization: Bearer <token>   (or  X-Sandbox-Token: <token>)
 *   - Query:   ?token=<token>                    (handy for browser testing)
 *
 * Replace this with real auth before exposing the server publicly.
 */
export function lightAuth(req, res, next) {
  const expected = process.env.SANDBOX_TOKEN;
  if (!expected) return next();

  const header = req.get('authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
  const provided = bearer || req.get('x-sandbox-token') || req.query.token;

  if (provided === expected) return next();

  res.status(401).json({ error: 'Unauthorized. Provide SANDBOX_TOKEN.' });
}
