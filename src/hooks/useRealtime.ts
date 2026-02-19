/**
 * useRealtime — Real-time sync hook
 *
 * Architecture:
 * - Socket.io for ultra-low-latency sync events (play/pause/seek/position)
 * - Supabase Realtime for DB changes (room row, polls)
 * - Members tracked via Socket.io server-side room state
 *
 * Connection flow:
 * 1. Socket module creates connection at import time
 * 2. Effect registers named handlers for clean removal on unmount
 * 3. joinRoomChannel: sends join_room immediately if connected, or queues via once('connect')
 * 4. Server responds with room_state → sets members + syncs position
 * 5. All subsequent members_update events keep member list current
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/services/supabaseClient'
import {
  getSocket,
  joinRoomChannel,
  leaveRoomChannel,
  emitSync,
  emitPlay,
  emitPause,
  emitNextSong,
  emitSongChange,
  emitRequestState,
} from '@/services/socket'
import type { Room, Poll, RoomMember, SyncEvent, Song } from '@/types'

interface UseRealtimeOptions {
  roomId:    string
  userId:    string
  username:  string
  isHost:    boolean
  onSync?:         (event: SyncEvent) => void
  onRoomUpdate?:   (room: Room) => void
  onPollUpdate?:   (poll: Poll) => void
  onSongChange?:   (song: Song | null) => void
  onMembersUpdate?: (members: RoomMember[]) => void
  // ADDED: Queue update callback
  onQueueUpdate?:  (queue: Song[]) => void
}

export const useRealtime = ({
  roomId, userId, username, isHost,
  onSync, onRoomUpdate, onPollUpdate, onSongChange, onMembersUpdate, onQueueUpdate,
}: UseRealtimeOptions) => {
  const [connected, setConnected] = useState(() => getSocket().connected)
  const [members, setMembers]     = useState<RoomMember[]>([])

  // Stable refs
  const isHostRef      = useRef(isHost)
  const onSyncRef      = useRef(onSync)
  const onSongChRef    = useRef(onSongChange)
  const onQueueRef     = useRef(onQueueUpdate)
  const onMembersRef   = useRef(onMembersUpdate)

  useEffect(() => { isHostRef.current  = isHost       }, [isHost])
  useEffect(() => { onSyncRef.current  = onSync       }, [onSync])
  useEffect(() => { onSongChRef.current = onSongChange }, [onSongChange])
  useEffect(() => { onQueueRef.current = onQueueUpdate }, [onQueueUpdate])
  useEffect(() => { onMembersRef.current = onMembersUpdate }, [onMembersUpdate])

  // ── Socket.io ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId || !userId) return

    const socket = getSocket()

    const handleConnect = () => {
      console.log('[Syncy] ✅ Socket connected — joining room:', roomId)
      setConnected(true)
      socket.emit('join_room', { room_id: roomId, user_id: userId, username })
    }

    const handleDisconnect = (reason: string) => {
      console.warn('[Syncy] ⚠️ Socket disconnected:', reason)
      setConnected(false)
    }

    // Handles the full initial state when joining or reconnecting
    const handleRoomState = (data: {
      room_id: string
      currentSong: Song | null
      queue: Song[]
      position: number
      status: 'playing' | 'paused' | 'idle'
      server_time: number
      members: RoomMember[]
    }) => {
      if (data.room_id !== roomId) return
      console.log('[Syncy] room_state →', data.members.length, 'members, status:', data.status)
      
      setMembers([...data.members])
      onMembersRef.current?.(data.members)

      // Sync everything
      if (data.queue) onQueueRef.current?.(data.queue)
      onSongChRef.current?.(data.currentSong)

      // Non-host: seek to current live position
      if (!isHostRef.current && (data.status === 'playing' || data.status === 'paused')) {
        onSyncRef.current?.({
          room_id: data.room_id,
          position: data.position,
          status: data.status,
          server_time: data.server_time,
        })
      }
    }

    const handleQueueUpdate = (data: { room_id: string; queue: Song[] }) => {
      if (data.room_id !== roomId) return
      console.log('[Syncy] queue_update →', data.queue.length, 'songs')
      onQueueRef.current?.(data.queue)
    }

    const handleMembersUpdate = (data: { room_id: string; members: RoomMember[] }) => {
      if (data.room_id !== roomId) return
      setMembers([...data.members])
      onMembersRef.current?.(data.members)
    }

    const handleSyncPosition = (event: SyncEvent) => {
      if (event.room_id !== roomId) return
      if (isHostRef.current) return
      onSyncRef.current?.(event)
    }

    const handleSongChange = (data: { room_id: string; song: Song | null }) => {
      if (data.room_id !== roomId) return
      if (isHostRef.current) return
      onSongChRef.current?.(data.song)
    }

    // Register handlers
    socket.on('connect',        handleConnect)
    socket.on('disconnect',     handleDisconnect)
    socket.on('room_state',     handleRoomState)
    socket.on('queue_update',   handleQueueUpdate) // ADDED
    socket.on('members_update', handleMembersUpdate)
    socket.on('sync_position',  handleSyncPosition)
    socket.on('song_change',    handleSongChange)

    // Join logic
    if (socket.connected) {
      socket.emit('join_room', { room_id: roomId, user_id: userId, username })
      if (!isHost) {
        setTimeout(() => emitRequestState(roomId), 200)
      }
    }

    setConnected(socket.connected)

    return () => {
      socket.off('connect',        handleConnect)
      socket.off('disconnect',     handleDisconnect)
      socket.off('room_state',     handleRoomState)
      socket.off('queue_update',   handleQueueUpdate)
      socket.off('members_update', handleMembersUpdate)
      socket.off('sync_position',  handleSyncPosition)
      socket.off('song_change',    handleSongChange)
      leaveRoomChannel(roomId, userId)
    }
  }, [roomId, userId, username])

  // ── Supabase Realtime ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return
    const channel = supabase.channel(`db:room:${roomId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (p) => onRoomUpdate?.(p.new as Room)
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'polls', filter: `room_id=eq.${roomId}` },
        (p) => onPollUpdate?.(p.new as Poll)
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'polls', filter: `room_id=eq.${roomId}` },
        (p) => onPollUpdate?.(p.new as Poll)
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [roomId])

  // ── Broadcast helpers ─────────────────────────────────────────────────────
  const broadcastPlay = useCallback((position: number) => {
    if (!isHostRef.current) return
    emitPlay(roomId, position)
  }, [roomId])

  const broadcastPause = useCallback((position: number) => {
    if (!isHostRef.current) return
    emitPause(roomId, position)
  }, [roomId])

  const broadcastNext = useCallback(() => {
    if (!isHostRef.current) return
    emitNextSong(roomId)
  }, [roomId])

  const broadcastPosition = useCallback((position: number, status: 'playing' | 'paused') => {
    if (!isHostRef.current) return
    emitSync({ room_id: roomId, position, status, server_time: Date.now() })
  }, [roomId])

  const broadcastSongChange = useCallback((song: Song | null) => {
    if (!isHostRef.current) return
    emitSongChange(roomId, song)
  }, [roomId])

  return {
    connected,
    members,
    broadcastPlay,
    broadcastPause,
    broadcastNext,
    broadcastPosition,
    broadcastSongChange,
  }
}