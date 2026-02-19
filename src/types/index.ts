export type MusicSource = 'jamendo' | 'youtube' | 'jiosaavn'

export interface Song {
  id: string
  title: string
  artist: string
  url: string           // Audio URL (MP3) or YouTube video ID
  coverUrl?: string
  duration?: number     // seconds
  source: MusicSource
  addedBy?: string
}

export interface CurrentSong extends Song {
  position: number      // seconds offset
  startedAt?: number    // server timestamp when play began
}

export interface Room {
  id: string
  name: string
  host_id: string
  current_song: CurrentSong | null
  queue: Song[]
  status: 'playing' | 'paused' | 'idle'
  created_at: string
  member_count?: number
}

export interface Poll {
  id: string
  room_id: string
  options: Song[]                  // songs to vote on
  votes: Record<string, string>    // user_id -> song_id
  created_at: string
  ends_at?: string | null
  active: boolean
}

export interface RoomMember {
  room_id: string
  user_id: string
  username: string
  joined_at: string
}

export interface User {
  id: string
  email?: string
  username?: string
}

export interface SyncEvent {
  room_id: string
  position: number
  status: 'playing' | 'paused'
  server_time: number
}

export interface QueueEvent {
  room_id: string
  song: Song
}

export interface VoteEvent {
  poll_id: string
  user_id: string
  song_id: string
}

export interface SearchResult {
  id: string
  title: string
  artist: string
  url: string
  coverUrl?: string
  duration?: number
  source: MusicSource
}
