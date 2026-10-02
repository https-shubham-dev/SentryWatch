import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../modules/auth/jwt.utils.js';
import { ENV } from '../config/env.js';
import { subscribeSystemEvents, SystemEvent } from './redisPubSub.js';

export function setupSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: ENV.CLIENT_URL,
      credentials: true,
    },
  });

  // Socket.IO Handshake Authentication Middleware
  io.use((socket: Socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication error: Missing access token'));
    }

    try {
      const payload = verifyAccessToken(token);
      (socket as unknown as { user: typeof payload }).user = payload;
      next();
    } catch (_err) {
      return next(new Error('Authentication error: Invalid or expired access token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as unknown as { user: { userId: string; organizationId: string } }).user;
    const orgRoom = `org:${user.organizationId}`;

    // Join tenant-isolated organization room (architecture.md §6)
    socket.join(orgRoom);
    console.info(`[Socket] User ${user.userId} connected and joined room '${orgRoom}'`);

    socket.on('disconnect', () => {
      console.info(`[Socket] User ${user.userId} disconnected from room '${orgRoom}'`);
    });
  });

  // Connect Redis Pub/Sub subscriber to forward events to Socket.IO org rooms
  subscribeSystemEvents((event: SystemEvent) => {
    const room = `org:${event.organizationId}`;
    io.to(room).emit(event.type, event.payload);
    console.info(`[Socket Broadcast] Emitted '${event.type}' to room '${room}'`);
  });

  return io;
}
