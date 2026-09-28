import http from 'http';
import { AddressInfo } from 'net';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import app from '../src/app.js';
import { setupSocketServer } from '../src/sockets/incidentSocket.js';
import { generateAccessToken } from '../src/modules/auth/jwt.utils.js';
import { publishSystemEvent } from '../src/sockets/redisPubSub.js';

describe('Socket.IO Real-Time & Tenant Isolation Tests', () => {
  let httpServer: http.Server;
  let port: number;
  const orgA = '507f1f77bcf86cd799439011';
  const orgB = '507f1f77bcf86cd799439022';
  let tokenOrgA: string;
  let tokenOrgB: string;

  beforeAll((done) => {
    tokenOrgA = generateAccessToken('user-1', orgA, 'admin');
    tokenOrgB = generateAccessToken('user-2', orgB, 'member');

    httpServer = http.createServer(app);
    setupSocketServer(httpServer);

    httpServer.listen(0, () => {
      port = (httpServer.address() as AddressInfo).port;
      done();
    });
  });

  afterAll((done) => {
    httpServer.close(done);
  });

  it('should reject socket connection with missing or invalid token', (done) => {
    const socket = ClientSocket(`http://localhost:${port}`, {
      auth: { token: 'invalid-token' },
      reconnection: false,
    });

    socket.on('connect_error', (err: Error) => {
      expect(err.message).toContain('Authentication error');
      socket.disconnect();
      done();
    });
  });

  it('should accept valid JWT and join organization room', (done) => {
    const socket = ClientSocket(`http://localhost:${port}`, {
      auth: { token: tokenOrgA },
      reconnection: false,
    });

    socket.on('connect', () => {
      expect(socket.connected).toBe(true);
      socket.disconnect();
      done();
    });
  });

  it('should isolate real-time events strictly per organization room (Multi-Tenancy Guard)', (done) => {
    const socketOrgA: ClientSocketType = ClientSocket(`http://localhost:${port}`, {
      auth: { token: tokenOrgA },
      reconnection: false,
    });

    const socketOrgB: ClientSocketType = ClientSocket(`http://localhost:${port}`, {
      auth: { token: tokenOrgB },
      reconnection: false,
    });

    let receivedByOrgA = false;
    let receivedByOrgB = false;

    socketOrgA.on('incident:created', (payload: any) => {
      expect(payload.reason).toBe('Org A Failure Test');
      receivedByOrgA = true;
    });

    socketOrgB.on('incident:created', () => {
      receivedByOrgB = true;
    });

    let connectedCount = 0;
    const onConnect = () => {
      connectedCount++;
      if (connectedCount === 2) {
        publishSystemEvent({
          type: 'incident:created',
          organizationId: orgA,
          payload: { id: 'inc-101', reason: 'Org A Failure Test' },
        });

        setTimeout(() => {
          expect(receivedByOrgA).toBe(true);
          expect(receivedByOrgB).toBe(false);

          socketOrgA.disconnect();
          socketOrgB.disconnect();
          done();
        }, 500);
      }
    };

    socketOrgA.on('connect', onConnect);
    socketOrgB.on('connect', onConnect);
  });
});
