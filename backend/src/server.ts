import app from './app.js';
import { ENV } from './config/env.js';
import { connectDB } from './config/db.js';

const PORT = ENV.PORT;

async function startServer() {
  await connectDB();
  app.listen(PORT, () => {
    console.info(`[Server] SentryWatch backend listening on port ${PORT}`);
  });
}

startServer();
