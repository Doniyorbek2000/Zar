import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../store/auth';

// Backend bilan kelishilgan hodisalar
type OrderChangedPayload = { orderId?: string };

/**
 * Socket.IO orqali jonli yangilanish.
 * Server hodisa yuborganda tegishli React Query keshlarini "invalidate" qiladi,
 * shunda KDS, stollar va faol buyurtma avtomatik qayta yuklanadi.
 * Layout ichida bir marta chaqiriladi (autentifikatsiyalangan zona).
 */
export function useRealtime(): { connected: boolean } {
  const qc = useQueryClient();
  const token = useAuth((s) => s.accessToken);
  const branchId = useAuth((s) => s.user?.branchId);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    const socket: Socket = io({
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      setConnected(true);
      if (branchId) socket.emit('join-branch', branchId);
    });
    socket.on('disconnect', () => setConnected(false));
    socket.io.on('reconnect', () => {
      if (branchId) socket.emit('join-branch', branchId);
    });

    // Stollar/zallar holati o'zgardi
    socket.on('tables:changed', () => {
      qc.invalidateQueries({ queryKey: ['halls'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    });

    // Aniq buyurtma o'zgardi
    socket.on('order:changed', (p: OrderChangedPayload) => {
      if (p?.orderId) qc.invalidateQueries({ queryKey: ['order', p.orderId] });
      qc.invalidateQueries({ queryKey: ['halls'] });
    });

    // Oshxona navbati o'zgardi
    socket.on('kds:changed', () => {
      qc.invalidateQueries({ queryKey: ['kds'] });
    });

    // Ombor qoldig'i o'zgardi
    socket.on('stock:changed', () => {
      qc.invalidateQueries({ queryKey: ['stock'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    });

    return () => {
      socket.disconnect();
    };
  }, [token, branchId, qc]);

  return { connected };
}
