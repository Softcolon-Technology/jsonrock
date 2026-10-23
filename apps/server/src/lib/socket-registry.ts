import type { Server } from 'socket.io'

let ioInstance: Server | null = null

export const userRoom = (clerkUserId: string) => `user:${clerkUserId}`

export function setIo(io: Server): void {
  ioInstance = io
}

export function getIo(): Server | null {
  return ioInstance
}

/** True when at least one socket is joined to the user's private room. */
export function isUserOnline(clerkUserId: string): boolean {
  const room = ioInstance?.sockets.adapter.rooms.get(userRoom(clerkUserId))
  return Boolean(room && room.size > 0)
}

/** Emit to every socket of a user (no-op if the server isn't ready / user offline). */
export function emitToUser(
  clerkUserId: string,
  event: string,
  payload: unknown
): void {
  ioInstance?.to(userRoom(clerkUserId)).emit(event, payload)
}
