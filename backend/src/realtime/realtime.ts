import type { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { verifyAccessToken } from '../lib/jwt';

// Real-time hodisa nomlari (frontend bilan kelishilgan)
export type RealtimeEvent =
  | 'tables:changed' // stollar/zallar holati o'zgardi
  | 'order:changed' // aniq buyurtma o'zgardi (payload: { orderId })
  | 'kds:changed' // oshxona navbati o'zgardi
  | 'stock:changed'; // ombor qoldig'i o'zgardi

let io: Server | null = null;

const roomOf = (branchId: string) => `branch:${branchId}`;

// Socket.IO serverini HTTP serverga ulaydi va JWT autentifikatsiyani o'rnatadi
export function initRealtime(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGIN.split(','), credentials: true },
    path: '/socket.io',
  });

  // Handshake paytida tokenni tekshiramiz
  io.use((socket: Socket, next) => {
    const token = (socket.handshake.auth?.token as string) || '';
    try {
      const payload = verifyAccessToken(token);
      socket.data.user = payload;
      if (payload.branchId) socket.join(roomOf(payload.branchId));
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as { sub: string; branchId: string | null } | undefined;
    logger.debug({ userId: user?.sub }, 'WS ulanish');

    // Filiali yo'q foydalanuvchilar (masalan super-admin) qo'lda room'ga qo'shilishi mumkin
    socket.on('join-branch', (branchId: string) => {
      if (typeof branchId === 'string' && branchId) socket.join(roomOf(branchId));
    });
    socket.on('leave-branch', (branchId: string) => {
      if (typeof branchId === 'string' && branchId) socket.leave(roomOf(branchId));
    });
  });

  logger.info('🔌 Real-time (Socket.IO) yoqildi');
  return io;
}

export const realtime = {
  // Filial room'idagi barcha ulangan mijozlarga hodisa yuboradi
  emitToBranch(branchId: string | null | undefined, event: RealtimeEvent, payload: Record<string, unknown> = {}) {
    if (!io || !branchId) return;
    io.to(roomOf(branchId)).emit(event, payload);
  },
};
