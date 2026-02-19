import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getRoom,
  updateRoom,
  addToQueue,
  removeFromQueue,
  reorderQueue,
  createPoll,
  getActivePoll,
  castVote,
  joinRoom,
  leaveRoom,
} from '@/services/supabaseClient'
import type { Room, Song, Poll } from '@/types'
import { useEffect } from 'react'

export const useRoom = (roomId: string, userId: string, username: string) => {
  const qc = useQueryClient()

  const { data: room, isLoading } = useQuery({
    queryKey: ['room', roomId],
    queryFn: () => getRoom(roomId),
    refetchInterval: 8000,
    enabled: !!roomId,
  })

  const { data: activePoll } = useQuery({
    queryKey: ['poll', roomId],
    queryFn: () => getActivePoll(roomId),
    refetchInterval: 5000,
    enabled: !!roomId,
  })

  useEffect(() => {
    if (!roomId || !userId) return
    joinRoom(roomId, userId, username)
    return () => { leaveRoom(roomId, userId) }
  }, [roomId, userId, username])

  const addSongMutation = useMutation({
    mutationFn: async (song: Song) => {
      const current = room?.queue || []
      qc.setQueryData(['room', roomId], (old: Room | undefined) =>
        old ? { ...old, queue: [...old.queue, song] } : old
      )
      return addToQueue(roomId, song, current)
    },
    onError: () => qc.invalidateQueries({ queryKey: ['room', roomId] }),
  })

  const removeSongMutation = useMutation({
    mutationFn: async (songId: string) => {
      const current = room?.queue || []
      qc.setQueryData(['room', roomId], (old: Room | undefined) =>
        old ? { ...old, queue: old.queue.filter((s) => s.id !== songId) } : old
      )
      return removeFromQueue(roomId, songId, current)
    },
  })

  const reorderMutation = useMutation({
    mutationFn: (newQueue: Song[]) => reorderQueue(roomId, newQueue),
    onMutate: (newQueue) => {
      qc.setQueryData(['room', roomId], (old: Room | undefined) =>
        old ? { ...old, queue: newQueue } : old
      )
    },
  })

  const setCurrentSong = useCallback(
    async (song: Song | null, position = 0) => {
      const current = song ? { ...song, position, startedAt: Date.now() } : null
      qc.setQueryData(['room', roomId], (old: Room | undefined) =>
        old ? { ...old, current_song: current, status: song ? 'playing' : 'idle' } : old
      )
      await updateRoom(roomId, { current_song: current, status: song ? 'playing' : 'idle' })
    },
    [roomId, qc]
  )

  const updateStatus = useCallback(
    async (status: Room['status']) => {
      qc.setQueryData(['room', roomId], (old: Room | undefined) =>
        old ? { ...old, status } : old
      )
      await updateRoom(roomId, { status })
    },
    [roomId, qc]
  )

  const startPoll = useCallback(
    async (options: Song[]) => {
      await createPoll(roomId, options)
      qc.invalidateQueries({ queryKey: ['poll', roomId] })
    },
    [roomId, qc]
  )

  const vote = useCallback(
    async (pollId: string, songId: string) => {
      qc.setQueryData(['poll', roomId], (old: Poll | undefined) =>
        old ? { ...old, votes: { ...old.votes, [userId]: songId } } : old
      )
      await castVote(pollId, userId, songId)
      qc.invalidateQueries({ queryKey: ['poll', roomId] })
    },
    [roomId, userId, qc]
  )

  const skipToNext = useCallback(async () => {
    const currentRoom = qc.getQueryData<Room>(['room', roomId])
    if (!currentRoom) return
    const [next, ...rest] = currentRoom.queue
    if (next) {
      const newState = {
        current_song: { ...next, position: 0, startedAt: Date.now() },
        queue: rest,
        status: 'playing' as const,
      }
      qc.setQueryData(['room', roomId], (old: Room | undefined) =>
        old ? { ...old, ...newState } : old
      )
      await updateRoom(roomId, newState)
    } else {
      qc.setQueryData(['room', roomId], (old: Room | undefined) =>
        old ? { ...old, current_song: null, status: 'idle' } : old
      )
      await updateRoom(roomId, { current_song: null, status: 'idle' })
    }
  }, [roomId, qc])

  const applyRoomUpdate = useCallback(
    (data: Room) => qc.setQueryData(['room', roomId], data),
    [roomId, qc]
  )

  const applyPollUpdate = useCallback(
    (data: Poll) => qc.setQueryData(['poll', roomId], data),
    [roomId, qc]
  )

  const closePoll = useCallback(async (pollId: string) => {
    await updateRoom(roomId, {})  // triggers re-fetch
    qc.setQueryData(['poll', roomId], (old: Poll | undefined) =>
      old ? { ...old, active: false } : old
    )
    // Update poll in DB
    const { supabase } = await import('@/services/supabaseClient')
    await supabase.from('polls').update({ active: false }).eq('id', pollId)
    qc.invalidateQueries({ queryKey: ['poll', roomId] })
  }, [roomId, qc])

  return {
    room,
    activePoll,
    isLoading,
    addSong: addSongMutation.mutate,
    removeSong: removeSongMutation.mutate,
    reorderQueue: reorderMutation.mutate,
    setCurrentSong,
    updateStatus,
    startPoll,
    vote,
    skipToNext,
    closePoll,
    updateRoom: applyRoomUpdate,
    updatePoll: applyPollUpdate,
  }
}
