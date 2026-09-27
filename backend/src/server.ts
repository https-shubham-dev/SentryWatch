import app from './app.js';
import { ENV } from './config/env.js';
import { connectDB } from './config/db.js';
import { reconcileScheduledJobs } from './workers/scheduler.js';
import { startCheckWorker } from './workers/checkWorker.js';

const PORT = ENV.PORT;

async function startServer() {
  await connectDB();

  // Reconcile and register scheduled repeatable jobs on boot
  await reconcileScheduledJobs();

  // Start background worker instance
  startCheckWorker();

  app.listen(PORT, () => {
    console.info(`[Server] SentryWatch backend listening on port ${PORT}`);
  });
}

startServer();
