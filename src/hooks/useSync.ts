/**
 * useSync — Pure Supabase Realtime sync engine
 *
 * NO Socket.io. NO external server needed.
 *
 * Architecture:
 *   ┌─────────────────────────────────────────────────────────┐
 *   │  Supabase Realtime WebSocket (already open for auth)    │
 *   ├──────────────────────┬──────────────────────────────────┤
 *   │  Broadcast channel   │  Presence channel                │
 *   │  (sync events)       │  (member list)                   │
 *   │  ~20-80ms latency    │  auto-cleanup on disconnect      │
 *   ├──────────────────────┴──────────────────────────────────┤
 *   │  DB Realtime (postgres_changes)                         │
 *   │  queue / current_song / poll updates                    │
 *   └─────────────────────────────────────────────────────────┘
 *
 * Sync protocol:
 *   Host plays  → broadcasts { PLAY, position, startedAt: now }
 *   Listener    → seekTo(position + networkDelta), play()
 *   Host hearts → broadcasts PLAY every 2s (drift correction)
 *   Drift > 300ms → listener silently re-seeks
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import {
  supabase,
  createSyncChannel,
  createPresenceChannel,
  createDbChannel,
  type SyncChannel,
  type PresenceChannel,
} from '@/services/supabaseClient'
import type { BroadcastEvent, Room, Poll, Song, CurrentSong, RoomMember } from '@/types'

export interface UseSyncOptions {
  roomId:    string
  userId:    string
  username:  string
  isHost:    boolean

  // Imperative player surface
  onPlay:       (position: number) => void
  onPause:      (position: number) => void
  onSongChange: (song: CurrentSong | null, autoPlay: boolean) => void

  // DB change callbacks
  onRoomUpdate: (room: Room) => void
  onPollUpdate: (poll: Poll) => void
}

export const useSync = ({
  roomId, userId, username, isHost,
  onPlay, onPause, onSongChange,
  onRoomUpdate, onPollUpdate,
}: UseSyncOptions) => {
  const [members,   setMembers]   = useState<RoomMember[]>([])
  const [connected, setConnected] = useState(false)

  const syncRef    = useRef<SyncChannel | null>(null)
  const presRef    = useRef<PresenceChannel | null>(null)
  const hbRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const isHostRef  = useRef(isHost)
  const getTimeRef = useRef<() => number>(() => 0)

  useEffect(() => { isHostRef.current = isHost }, [isHost])

  // ── Register live-time getter (called by Room) ─────────────────────────────
  const registerGetTime = useCallback((fn: () => number) => {
    getTimeRef.current = fn
  }, [])

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId || !userId) return

    // 1. Broadcast sync channel
    const sync = createSyncChannel(roomId)
    syncRef.current = sync
    sync.onEvent((evt) => {
      if (isHostRef.current) return  // host never applies its own events
      dispatch(evt)
    })

    // 2. Presence channel
    const pres = createPresenceChannel(roomId)
    presRef.current = pres
    pres.onChange((m) => {
      setMembers(m.map(p => ({ userId: p.userId, username: p.username })))
    })
    pres.track({ userId, username }).then(() => {
      setMembers(pres.members().map(p => ({ userId: p.userId, username: p.username })))
      setConnected(true)
    })

    // 3. DB realtime
    const dbCh = createDbChannel(roomId, onRoomUpdate, onPollUpdate)

    return () => {
      stopHeartbeat()
      sync.destroy()
      pres.destroy()
      supabase.removeChannel(dbCh)
      setConnected(false)
      syncRef.current = null
      presRef.current = null
    }
  }, [roomId, userId, username])

  // ── Dispatch incoming events ───────────────────────────────────────────────
  const dispatch = useCallback((evt: BroadcastEvent) => {
    switch (evt.type) {
      case 'PLAY': {
        const net = (Date.now() - evt.startedAt) / 1000
        onPlay(evt.position + net)
        break
      }
      case 'PAUSE': {
        onPause(evt.position)
        break
      }
      case 'SEEK': {
        const net = evt.playing ? (Date.now() - evt.startedAt) / 1000 : 0
        const pos = evt.position + net
        if (evt.playing) onPlay(pos)
        else             onPause(pos)
        break
      }
      case 'SONG_CHANGE': {
        onSongChange(evt.song, true)
        break
      }
    }
  }, [onPlay, onPause, onSongChange])

  // ── Heartbeat ──────────────────────────────────────────────────────────────
  const stopHeartbeat = useCallback(() => {
    if (hbRef.current) { clearInterval(hbRef.current); hbRef.current = null }
  }, [])

  const startHeartbeat = useCallback((startedAt: number) => {
    stopHeartbeat()
    hbRef.current = setInterval(async () => {
      if (!syncRef.current || !isHostRef.current) return
      const pos = getTimeRef.current()
      await syncRef.current.send({ type: 'PLAY', position: pos, startedAt: Date.now() })
    }, 1500)  // every 1.5s — tight enough for <300ms drift correction
  }, [stopHeartbeat])

  // ── Host broadcast helpers ─────────────────────────────────────────────────
  const broadcastPlay = useCallback(async (position: number) => {
    if (!syncRef.current) return
    const startedAt = Date.now()
    await syncRef.current.send({ type: 'PLAY', position, startedAt })
    startHeartbeat(startedAt)
  }, [startHeartbeat])

  const broadcastPause = useCallback(async (position: number) => {
    stopHeartbeat()
    if (!syncRef.current) return
    await syncRef.current.send({ type: 'PAUSE', position })
  }, [stopHeartbeat])

  const broadcastSeek = useCallback(async (position: number, playing: boolean) => {
    if (!syncRef.current) return
    const startedAt = Date.now()
    await syncRef.current.send({ type: 'SEEK', position, startedAt, playing })
    if (playing) startHeartbeat(startedAt)
    else stopHeartbeat()
  }, [startHeartbeat, stopHeartbeat])

  const broadcastSongChange = useCallback(async (song: CurrentSong | null) => {
    stopHeartbeat()
    if (!syncRef.current) return
    await syncRef.current.send({ type: 'SONG_CHANGE', song })
    if (song) {
      setTimeout(() => {
        if (isHostRef.current) startHeartbeat(Date.now())
      }, 700)
    }
  }, [stopHeartbeat, startHeartbeat])

  return {
    members,
    connected,
    registerGetTime,
    broadcastPlay,
    broadcastPause,
    broadcastSeek,
    broadcastSongChange,
    stopHeartbeat,
  }
}
