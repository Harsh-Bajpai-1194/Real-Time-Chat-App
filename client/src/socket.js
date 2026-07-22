import { io } from 'socket.io-client';

export const getSocketUrl = () => {
  if (process.env.REACT_APP_SOCKET_URL) {
    return process.env.REACT_APP_SOCKET_URL;
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return 'http://localhost:3000';
};

export const socket = io(getSocketUrl(), {
  transports: ['websocket', 'polling'],
});
