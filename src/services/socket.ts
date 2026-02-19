/**
 * socket.ts — Bulletproof Socket.io singleton
 *
 * Key design: socket is created ONCE at module load (autoConnect: true).
 * joinRoomChannel works whether socket is connected or not.
 */
import { io, Socket } from 'socket.io-client'
import type { SyncEvent, Song } from '@/types'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'

// Singleton — created once, lives forever
let _socket: Socket | null = null

export const getSocket = (): Socket => {
  if (_socket) return _socket

  _socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 15000,
    autoConnect: true,
  })

  _socket.on('connect',       () => console.log('[Socket] ✅ Connected:', _socket!.id))
  _socket.on('disconnect',    (r) => console.warn('[Socket] ⚠️ Disconnected:', r))
  _socket.on('connect_error', (e) => console.warn('[Socket] ❌ Error:', e.message))

  return _socket
}

// Initialize immediately so connection starts before any component mounts
getSocket()

export const joinRoomChannel = (roomId: string, userId: string, username: string) => {
  const sock = getSocket()
  const payload = { room_id: roomId, user_id: userId, username }
  if (sock.connected) {
    sock.emit('join_room', payload)
  } else {
    // Will be sent as soon as we connect
    sock.once('connect', () => sock.emit('join_room', payload))
  }
}

export const leaveRoomChannel = (roomId: string, userId: string) => {
  const sock = getSocket()
  if (sock.connected) sock.emit('leave_room', { room_id: roomId, user_id: userId })
}

export const emitSync       = (e: SyncEvent) => getSocket().emit('sync_position', e)
export const emitPlay       = (roomId: string, pos: number) =>
  getSocket().emit('play', { room_id: roomId, position: pos, server_time: Date.now() })
export const emitPause      = (roomId: string, pos: number) =>
  getSocket().emit('pause', { room_id: roomId, position: pos, server_time: Date.now() })
export const emitNextSong   = (roomId: string) =>
  getSocket().emit('next_song', { room_id: roomId })
export const emitSongChange = (roomId: string, song: Song | null) =>
  getSocket().emit('song_change', { room_id: roomId, song })
export const emitAddSong    = (roomId: string, song: Song) =>
  getSocket().emit('add_song', { room_id: roomId, song })
export const emitVote       = (pollId: string, userId: string, songId: string) =>
  getSocket().emit('vote', { poll_id: pollId, user_id: userId, song_id: songId })
export const emitRequestState = (roomId: string) =>
  getSocket().emit('request_state', { room_id: roomId })
