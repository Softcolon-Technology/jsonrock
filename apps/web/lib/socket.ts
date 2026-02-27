'use client'

import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export const getSocket = (): Socket => {
  if (!socket) {
    // use undefined to connect to window.location (handles ngrok automatically)
    const url = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3005'
    socket = io(url, {
      path: '/api/socket/io',
      addTrailingSlash: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      autoConnect: false, // Critical: Only connect when explicitly requested
    })
  }
  return socket
}
