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

/** Event used to join an authenticated, server-verified room (e.g. `user:{clerkUserId}`). */
export const AUTH_JOIN_EVENT = 'auth/join'

export const userRoom = (clerkUserId: string) => `user:${clerkUserId}`

/**
 * Connect (if needed) with a Clerk token and join the signed-in user's private
 * room so the server can push `project-invite` events. Shares the same socket as
 * slug rooms; it never leaves/rejoins them. Returns a cleanup function.
 */
export function joinUserRoom(
  getToken: () => Promise<string | null>,
  clerkUserId: string
): () => void {
  const socket = getSocket()
  const room = userRoom(clerkUserId)
  let cancelled = false

  const join = async () => {
    const token = await getToken()
    if (cancelled || !token) return
    // Used by the next handshake; also sent with the join for already-open sockets.
    socket.auth = { token }
    socket.emit(AUTH_JOIN_EVENT, room, { token })
  }

  const onConnect = () => {
    void join()
  }
  // Refresh the (short-lived) token before every automatic reconnect attempt.
  const onReconnectAttempt = () => {
    void getToken().then((token) => {
      if (!cancelled && token) socket.auth = { token }
    })
  }

  socket.on('connect', onConnect)
  socket.io.on('reconnect_attempt', onReconnectAttempt)

  void getToken().then((token) => {
    if (cancelled || !token) return
    socket.auth = { token }
    if (socket.connected) void join()
    else socket.connect()
  })

  return () => {
    cancelled = true
    socket.off('connect', onConnect)
    socket.io.off('reconnect_attempt', onReconnectAttempt)
    if (socket.connected) socket.emit('leave-room', room)
  }
}
