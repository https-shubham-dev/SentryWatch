import http from 'http';
import app from './app.js';
import { ENV } from './config/env.js';
import { connectDB } from './config/db.js';
import { reconcileScheduledJobs } from './workers/scheduler.js';
import { startCheckWorker } from './workers/checkWorker.js';
import { setupSocketServer } from './sockets/incidentSocket.js';

const PORT = ENV.PORT;
const server = http.createServer(app);

// Attach Socket.IO server with JWT authentication & org rooms
setupSocketServer(server);

async function startServer() {
  await connectDB();

  // Reconcile and register scheduled repeatable jobs on boot
  await reconcileScheduledJobs();

  // Start background worker instance
  startCheckWorker();

  server.listen(PORT, () => {
    console.info(`[Server] SentryWatch backend listening on port ${PORT}`);
  });
}

startServer();
