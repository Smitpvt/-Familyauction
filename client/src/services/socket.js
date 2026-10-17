import { io } from 'socket.io-client';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    // Priority: VITE_SOCKET_URL -> VITE_API_URL -> window.location.origin
    const rawUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || window.location.origin;
    const SOCKET_URL = rawUrl.replace(/\/+$/, '');

    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 30,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    socket.on('connect', () => {
      console.log('[Socket.IO connected]:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.warn('[Socket.IO disconnected]:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket.IO connect error]:', error.message);
    });
  }
  return socket;
};
