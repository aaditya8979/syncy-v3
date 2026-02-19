/**
 * Syncy Socket Server — Hardened v3
 *
 * Features:
 * - Member deduplication by userId (multiple tabs = 1 member)
 * - Accurate mid-session join sync with server-side time tracking
 * - Host reassignment on disconnect
 * - Position heartbeat from host stored server-side
 */
import { createServer } from 'http'
import { Server, Socket } from 'socket.io'

const PORT        = parseInt(process.env.PORT || '3001', 10)
const FRONTEND_URL = process.env.FRONTEND_URL || '*'

const httpServer = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ status: 'ok', server: 'Syncy Socket Server' }))
})

const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL === '*' ? '*' : FRONTEND_URL.split(','),
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingInterval: 10_000,
  pingTimeout: 25_000,
})

// ── Types ────────────────────────────────────────────────────────────────────

interface Member {
  userId:   string
  username: string
  socketId: string   // latest socket ID (re-join updates this)
  joinedAt: string
}

interface Song {
  id: string; title: string; artist: string
  url: string; source: string; coverUrl?: string; duration?: number
}

interface RoomState {
  // Members keyed by userId (not socketId) to prevent duplicates
  members:     Map<string, Member>
  // socketId → userId mapping for disconnect handling
  socketToUser: Map<string, string>
  hostUserId:  string | null
  currentSong: Song | null
  position:    number   // playback position at lastSync
  status:      'playing' | 'paused' | 'idle'
  lastSync:    number   // Date.now() when position was last updated
}

const rooms = new Map<string, RoomState>()

function getRoom(roomId: string): RoomState {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      members:      new Map(),
      socketToUser: new Map(),
      hostUserId:   null,
      currentSong:  null,
      position:     0,
      status:       'idle',
      lastSync:     Date.now(),
    })
  }
  return rooms.get(roomId)!
}

function getCurrentPosition(room: RoomState): number {
  if (room.status !== 'playing') return room.position
  const elapsed = (Date.now() - room.lastSync) / 1000
  return room.position + elapsed
}

function serializeMembers(room: RoomState, roomId: string) {
  return Array.from(room.members.values()).map(m => ({
    user_id:   m.userId,
    username:  m.username,
    room_id:   roomId,
    joined_at: m.joinedAt,
  }))
}

// ── Connection handler ───────────────────────────────────────────────────────

io.on('connection', (socket: Socket) => {
  let currentRoomId: string | null = null
  let currentUserId: string | null = null

  console.log(`[+] ${socket.id}`)

  // ── join_room ──────────────────────────────────────────────────────────────
  socket.on('join_room', ({ room_id, user_id, username }: {
    room_id: string; user_id: string; username: string
  }) => {
    if (!room_id || !user_id) return

    // Leave previous room if any
    if (currentRoomId && currentRoomId !== room_id) {
      doLeave(currentRoomId)
    }

    currentRoomId = room_id
    currentUserId = user_id
    socket.join(room_id)

    const room = getRoom(room_id)
    const isRejoin = room.members.has(user_id)

    // Upsert member (deduplication by userId)
    room.members.set(user_id, {
      userId:   user_id,
      username: username || 'Anonymous',
      socketId: socket.id,
      joinedAt: isRejoin
        ? (room.members.get(user_id)?.joinedAt ?? new Date().toISOString())
        : new Date().toISOString(),
    })
    room.socketToUser.set(socket.id, user_id)

    // First member in room becomes host
    if (!room.hostUserId) {
      room.hostUserId = user_id
      console.log(`[Room ${room_id.slice(0,8)}] Host: "${username}"`)
    }

    console.log(`[Room ${room_id.slice(0,8)}] "${username}" ${isRejoin ? 're-' : ''}joined (${room.members.size} members)`)

    // Tell EVERYONE (including joiner) about updated member list
    io.to(room_id).emit('members_update', {
      room_id,
      members: serializeMembers(room, room_id),
    })

    // Tell THIS socket the current room state (for mid-session sync)
    socket.emit('room_state', {
      room_id,
      currentSong: room.currentSong,
      position:    getCurrentPosition(room),
      status:      room.status,
      server_time: Date.now(),
      members:     serializeMembers(room, room_id),
    })
  })

  // ── request_state (explicit re-sync request) ──────────────────────────────
  socket.on('request_state', ({ room_id }: { room_id: string }) => {
    const room = rooms.get(room_id)
    if (!room) return

    socket.emit('room_state', {
      room_id,
      currentSong: room.currentSong,
      position:    getCurrentPosition(room),
      status:      room.status,
      server_time: Date.now(),
      members:     serializeMembers(room, room_id),
    })
  })

  // ── sync_position (host heartbeat → listeners) ────────────────────────────
  socket.on('sync_position', (event: {
    room_id: string; position: number; status: string; server_time: number
  }) => {
    const room = rooms.get(event.room_id)
    if (room) {
      room.position = event.position
      room.status   = event.status as RoomState['status']
      room.lastSync = Date.now()
    }
    // Relay to everyone EXCEPT sender (host)
    socket.to(event.room_id).emit('sync_position', {
      ...event,
      server_time: Date.now(),
    })
  })

  // ── play ──────────────────────────────────────────────────────────────────
  socket.on('play', ({ room_id, position }: { room_id: string; position: number }) => {
    const room = rooms.get(room_id)
    if (room) {
      room.position = position
      room.status   = 'playing'
      room.lastSync = Date.now()
    }
    socket.to(room_id).emit('sync_position', {
      room_id,
      position,
      status:      'playing',
      server_time: Date.now(),
    })
    console.log(`[Room ${room_id.slice(0,8)}] ▶ Play @ ${position.toFixed(2)}s`)
  })

  // ── pause ─────────────────────────────────────────────────────────────────
  socket.on('pause', ({ room_id, position }: { room_id: string; position: number }) => {
    const room = rooms.get(room_id)
    if (room) {
      room.position = position
      room.status   = 'paused'
      room.lastSync = Date.now()
    }
    socket.to(room_id).emit('sync_position', {
      room_id,
      position,
      status:      'paused',
      server_time: Date.now(),
    })
    console.log(`[Room ${room_id.slice(0,8)}] ⏸ Pause @ ${position.toFixed(2)}s`)
  })

  // ── song_change ───────────────────────────────────────────────────────────
  socket.on('song_change', ({ room_id, song }: { room_id: string; song: Song | null }) => {
    const room = rooms.get(room_id)
    if (room) {
      room.currentSong = song
      room.position    = 0
      room.status      = song ? 'playing' : 'idle'
      room.lastSync    = Date.now()
    }
    socket.to(room_id).emit('song_change', { room_id, song })
    if (song) console.log(`[Room ${room_id.slice(0,8)}] 🎵 Song: ${song.title}`)
  })

  // ── next_song ─────────────────────────────────────────────────────────────
  socket.on('next_song', ({ room_id }: { room_id: string }) => {
    const room = rooms.get(room_id)
    if (room) {
      room.position = 0
      room.lastSync = Date.now()
    }
    socket.to(room_id).emit('next_song', { room_id })
  })

  // ── vote ──────────────────────────────────────────────────────────────────
  socket.on('vote', (data) => {
    if (data.room_id) socket.to(data.room_id).emit('vote', data)
  })

  // ── leave_room (explicit) ─────────────────────────────────────────────────
  socket.on('leave_room', ({ room_id }: { room_id: string }) => {
    doLeave(room_id)
  })

  // ── disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    console.log(`[-] ${socket.id} (${reason})`)
    if (currentRoomId) doLeave(currentRoomId)
  })

  // ── Internal leave helper ─────────────────────────────────────────────────
  function doLeave(roomId: string) {
    const room = rooms.get(roomId)
    if (!room) return

    // Find the user by socketId (handle re-joins where socketId changed)
    const userId = room.socketToUser.get(socket.id) || currentUserId
    if (userId) {
      // Only remove if this socket is the CURRENT socket for that user
      const member = room.members.get(userId)
      if (member && member.socketId === socket.id) {
        room.members.delete(userId)
        console.log(`[Room ${roomId.slice(0,8)}] "${member.username}" left (${room.members.size} remaining)`)
      }
      room.socketToUser.delete(socket.id)
    }

    socket.leave(roomId)

    if (room.members.size === 0) {
      rooms.delete(roomId)
      console.log(`[Room ${roomId.slice(0,8)}] Empty — deleted`)
      return
    }

    // Reassign host if needed
    if (room.hostUserId === userId) {
      const allMembers = Array.from(room.members.values())
      const newHost = allMembers[0]
      room.hostUserId = newHost?.userId ?? null
      if (newHost) {
        console.log(`[Room ${roomId.slice(0,8)}] New host: "${newHost.username}"`)
        io.to(newHost.socketId).emit('promoted_to_host', { room_id: roomId })
      }
    }

    io.to(roomId).emit('members_update', {
      room_id: roomId,
      members: serializeMembers(room, roomId),
    })

    if (roomId === currentRoomId) {
      currentRoomId = null
      currentUserId = null
    }
  }
})

httpServer.listen(PORT, () => {
  console.log(`\n🎵 Syncy Socket Server running on port ${PORT}`)
  console.log(`   CORS origin: ${FRONTEND_URL}\n`)
})
