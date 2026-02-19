import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Music2, LogOut, ArrowRight, RefreshCw,
  Clock, X, Loader2, Radio, Crown, Disc3,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { listRooms, createRoom } from '@/services/supabaseClient'
import type { Room } from '@/types'
import { cn } from '@/lib/utils'

export const Dashboard = () => {
  const navigate = useNavigate()
  const { user, username, logout } = useAuth()
  const qc = useQueryClient()

  const [showCreate, setShowCreate] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [joinId, setJoinId] = useState('')

  const { data: rooms = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['rooms'],
    queryFn: listRooms,
    refetchInterval: 20_000,
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user || !roomName.trim()) throw new Error('Room name required')
      return createRoom(roomName.trim(), user.id)
    },
    onSuccess: (room) => {
      if (room) {
        qc.invalidateQueries({ queryKey: ['rooms'] })
        navigate(`/room/${room.id}`)
      }
    },
  })

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault()
    const id = joinId.trim()
    if (!id) return
    // Handle full URL or just ID
    const match = id.match(/room\/([a-f0-9-]+)/)
    navigate(`/room/${match ? match[1] : id}`)
  }

  const timeAgo = (date: string) => {
    const d = (Date.now() - new Date(date).getTime()) / 1000
    if (d < 60) return 'just now'
    if (d < 3600) return `${Math.floor(d / 60)}m ago`
    if (d < 86400) return `${Math.floor(d / 3600)}h ago`
    return `${Math.floor(d / 86400)}d ago`
  }

  return (
    <div className="h-screen bg-s-bg overflow-hidden flex flex-col relative font-body">
      {/* Background */}
      <div className="fixed inset-0 bg-grid-fine bg-grid pointer-events-none" />
      <div className="fixed top-0 right-0 w-[500px] h-[400px] bg-s-violet/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[300px] h-[300px] bg-s-indigo/4 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-s-border/40 bg-s-bg/60 backdrop-blur-xl flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 disc-outer flex items-center justify-center">
            <div className="w-5 h-5 rounded-full bg-s-violet flex items-center justify-center z-10">
              <Music2 size={10} className="text-white" />
            </div>
          </div>
          <div>
            <span className="font-display font-bold text-lg text-gradient">Syncy</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-right">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-s-violet to-s-indigo flex items-center justify-center text-white text-xs font-bold uppercase">
              {username[0]}
            </div>
            <div>
              <p className="text-sm font-medium text-s-text leading-none">{username}</p>
              <p className="text-xs text-s-muted mt-0.5">{user?.email || 'Guest'}</p>
            </div>
          </div>
          <button
            onClick={async () => { await logout(); navigate('/login') }}
            className="flex items-center gap-1.5 text-sm text-s-sub hover:text-s-text transition-colors"
          >
            <LogOut size={15} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main className="relative z-10 flex-1 overflow-y-auto px-6 py-6 max-w-3xl mx-auto w-full">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h2 className="font-display font-bold text-2xl text-s-text">Rooms</h2>
          <p className="text-s-sub text-sm mt-1">Create a room or join one to listen together</p>
        </motion.div>

        {/* Create + Join */}
        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-4 p-4 bg-s-violet rounded-2xl text-white hover:bg-s-violet/90 transition-all group shadow-glow-sm active:scale-98"
          >
            <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
              <Plus size={20} />
            </div>
            <div className="text-left flex-1">
              <p className="font-semibold text-sm">Create Room</p>
              <p className="text-white/70 text-xs">Start a new session</p>
            </div>
            <ArrowRight size={16} className="text-white/60 group-hover:translate-x-0.5 transition-transform" />
          </motion.button>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
          >
            <form onSubmit={handleJoin} className="flex gap-2 p-3 bg-s-card border border-s-border rounded-2xl h-full items-center">
              <input
                value={joinId}
                onChange={e => setJoinId(e.target.value)}
                placeholder="Paste room link or ID…"
                className="flex-1 bg-transparent text-sm text-s-text placeholder-s-muted focus:outline-none"
              />
              <button
                type="submit"
                disabled={!joinId.trim()}
                className="px-3 py-1.5 bg-s-surface border border-s-border hover:border-s-violet/40 text-s-text text-xs rounded-lg transition-all disabled:opacity-40"
              >
                Join
              </button>
            </form>
          </motion.div>
        </div>

        {/* Room list */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold text-s-text text-sm">Recent Rooms</h3>
          <button
            onClick={() => refetch()}
            className={cn('text-s-muted hover:text-s-text transition-colors', isFetching && 'animate-spin text-s-violet')}
          >
            <RefreshCw size={13} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={22} className="text-s-violet animate-spin" />
          </div>
        ) : rooms.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-3 py-16 text-s-muted"
          >
            <Disc3 size={40} strokeWidth={1} />
            <p className="text-sm">No rooms yet — create one to get started!</p>
          </motion.div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2.5">
            {rooms.map((room: Room, i) => (
              <motion.button
                key={room.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => navigate(`/room/${room.id}`)}
                className="flex items-center gap-3 p-4 bg-s-card border border-s-border hover:border-s-violet/40 rounded-2xl text-left transition-all group active:scale-98"
              >
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-s-violet/20 to-s-indigo/20 border border-s-violet/20 flex items-center justify-center">
                    <Music2 size={16} className="text-s-violet" />
                  </div>
                  {room.status === 'playing' && (
                    <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-s-green rounded-full border-2 border-s-bg flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="font-medium text-sm text-s-text truncate">{room.name}</p>
                    {room.host_id === user?.id && <Crown size={10} className="text-amber-400 flex-shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={10} className="text-s-muted" />
                    <span className="text-xs text-s-muted">{timeAgo(room.created_at)}</span>
                    <span className={cn('text-xs',
                      room.status === 'playing' ? 'text-s-green' :
                      room.status === 'paused' ? 'text-amber-400' : 'text-s-muted'
                    )}>
                      {room.status === 'playing' ? '▶ Playing' : room.status === 'paused' ? '⏸ Paused' : '⏹ Idle'}
                    </span>
                  </div>
                </div>

                <ArrowRight size={15} className="text-s-muted group-hover:text-s-violet group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </motion.button>
            ))}
          </div>
        )}
      </main>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
              onClick={() => setShowCreate(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="relative w-full max-w-sm bg-s-card border border-s-border rounded-2xl shadow-card"
            >
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-s-border">
                <div>
                  <h3 className="font-display font-semibold text-s-text">New Room</h3>
                  <p className="text-xs text-s-muted mt-0.5">Give it a catchy name</p>
                </div>
                <button onClick={() => setShowCreate(false)} className="text-s-muted hover:text-s-text transition-colors">
                  <X size={18} />
                </button>
              </div>
              <form
                onSubmit={(e) => { e.preventDefault(); createMutation.mutate() }}
                className="p-5 space-y-4"
              >
                <input
                  type="text"
                  value={roomName}
                  onChange={e => setRoomName(e.target.value)}
                  placeholder="Friday Night Vibes…"
                  required
                  maxLength={50}
                  autoFocus
                  className="w-full px-4 py-3 bg-s-deep border border-s-border rounded-xl text-sm text-s-text placeholder-s-muted/50 focus:outline-none focus:border-s-violet/60 transition-colors"
                />
                {createMutation.error && (
                  <p className="text-xs text-red-400">{(createMutation.error as Error).message}</p>
                )}
                <button
                  type="submit"
                  disabled={createMutation.isPending || !roomName.trim()}
                  className="w-full py-3 bg-s-violet hover:bg-s-violet/90 text-white font-medium text-sm rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-98"
                >
                  {createMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Radio size={15} />}
                  Create Room
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
