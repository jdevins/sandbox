import { createServer } from './src/app.js';
import { startScheduler } from './src/scheduler.js';

const PORT = process.env.PORT || 3000;

const { app, appManager } = await createServer();

await appManager.discoverAll();

startScheduler();

app.listen(PORT, () => {
  const apps = appManager.list();
  console.log(`\n  Sandbox server running → http://localhost:${PORT}`);
  console.log(`  Dashboard            → http://localhost:${PORT}/`);
  console.log(`  Discovered ${apps.length} app(s): ${apps.map((a) => a.name).join(', ') || '(none)'}\n`);
});
