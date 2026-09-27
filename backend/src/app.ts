import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ENV } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';

const app = express();

app.use(
  cors({
    origin: ENV.CLIENT_URL,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Auth module routes (api.md §3 base URL /api/v1)
app.use('/api/v1/auth', authRoutes);
app.use('/api/auth', authRoutes); // convenient fallback

// Global error handler
app.use(errorHandler);

export default app;
