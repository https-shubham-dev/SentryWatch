import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ENV } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import apisRoutes from './modules/apis/apis.routes.js';
import incidentsRoutes from './modules/incidents/incidents.routes.js';

const app = express();

// Security headers (CSP, X-Frame-Options, X-Content-Type-Options, etc.)
app.use(
  helmet({
    // SPA on a different origin (Vercel) calls this API — allow cross-origin reads
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

app.use(
  cors({
    origin: ENV.CLIENT_URL,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

// Health check endpoint (unauthenticated, not rate-limited beyond infra)
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Module routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/auth', authRoutes);

app.use('/api/v1/apis', apisRoutes);
app.use('/api/apis', apisRoutes);

app.use('/api/v1/incidents', incidentsRoutes);
app.use('/api/incidents', incidentsRoutes);

// Global error handler
app.use(errorHandler);

export default app;
