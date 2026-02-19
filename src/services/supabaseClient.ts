import { createClient } from '@supabase/supabase-js'
import type { Room, Poll, RoomMember } from '@/types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars not set. Using demo mode.')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  }
)

// Auth helpers
export const signInAnon = () => supabase.auth.signInAnonymously()

export const signInEmail = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password })

export const signUpEmail = (email: string, password: string) =>
  supabase.auth.signUp({ email, password })

export const signOut = () => supabase.auth.signOut()

export const getSession = () => supabase.auth.getSession()

// Room helpers
export const createRoom = async (name: string, hostId: string): Promise<Room | null> => {
  const { data, error } = await supabase
    .from('rooms')
    .insert({
      name,
      host_id: hostId,
      current_song: null,
      queue: [],
      status: 'idle',
    })
    .select()
    .single()
  if (error) { console.error('createRoom:', error); return null }
  return data as Room
}

export const getRoom = async (id: string): Promise<Room | null> => {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', id)
    .single()
  if (error) { console.error('getRoom:', error); return null }
  return data as Room
}

export const listRooms = async (): Promise<Room[]> => {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) { console.error('listRooms:', error); return [] }
  return (data || []) as Room[]
}

export const updateRoom = async (id: string, updates: Partial<Room>) => {
  const { error } = await supabase.from('rooms').update(updates).eq('id', id)
  if (error) console.error('updateRoom:', error)
}

// Queue helpers
export const addToQueue = async (roomId: string, song: import('@/types').Song, currentQueue: import('@/types').Song[]) => {
  const newQueue = [...currentQueue, song]
  await updateRoom(roomId, { queue: newQueue })
  return newQueue
}

export const removeFromQueue = async (roomId: string, songId: string, currentQueue: import('@/types').Song[]) => {
  const newQueue = currentQueue.filter(s => s.id !== songId)
  await updateRoom(roomId, { queue: newQueue })
  return newQueue
}

export const reorderQueue = async (roomId: string, newQueue: import('@/types').Song[]) => {
  await updateRoom(roomId, { queue: newQueue })
}

// Poll helpers
export const createPoll = async (roomId: string, options: import('@/types').Song[]): Promise<Poll | null> => {
  const endsAt = new Date(Date.now() + 60_000).toISOString() // 60s
  const { data, error } = await supabase
    .from('polls')
    .insert({ room_id: roomId, options, votes: {}, active: true, ends_at: endsAt })
    .select()
    .single()
  if (error) { console.error('createPoll:', error); return null }
  return data as Poll
}

export const getActivePoll = async (roomId: string): Promise<Poll | null> => {
  const { data } = await supabase
    .from('polls')
    .select('*')
    .eq('room_id', roomId)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data as Poll | null
}

export const castVote = async (pollId: string, userId: string, songId: string) => {
  const { data: poll } = await supabase
    .from('polls')
    .select('votes')
    .eq('id', pollId)
    .single()
  if (!poll) return
  const newVotes = { ...(poll.votes || {}), [userId]: songId }
  await supabase.from('polls').update({ votes: newVotes }).eq('id', pollId)
}

// Room members
export const joinRoom = async (roomId: string, userId: string, username: string) => {
  await supabase.from('room_members').upsert({ room_id: roomId, user_id: userId, username })
}

export const leaveRoom = async (roomId: string, userId: string) => {
  await supabase.from('room_members').delete().eq('room_id', roomId).eq('user_id', userId)
}

export const getRoomMembers = async (roomId: string): Promise<RoomMember[]> => {
  const { data } = await supabase
    .from('room_members')
    .select('*')
    .eq('room_id', roomId)
  return (data || []) as RoomMember[]
}
