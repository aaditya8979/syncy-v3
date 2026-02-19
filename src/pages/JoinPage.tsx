/**
 * JoinPage — Handles shareable /join/:id links
 *
 * If user is logged in → redirect directly to /room/:id
 * If not logged in → show a join screen, anonymous login, then redirect
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Music, Users, ArrowRight, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { getRoom } from '@/services/supabaseClient'
import type { Room } from '@/types'

export const JoinPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, loading, loginAnon } = useAuth()
  const [room, setRoom]           = useState<Room | null>(null)
  const [joining, setJoining]     = useState(false)
  const [error, setError]         = useState('')

  // Load room info for display
  useEffect(() => {
    if (!id) return
    getRoom(id).then(r => setRoom(r))
  }, [id])

  // If user is already logged in, go straight to room
  useEffect(() => {
    if (!loading && user && id) {
      navigate(`/room/${id}`, { replace: true })
    }
  }, [user, loading, id, navigate])

  const handleJoin = async () => {
    if (!id) return
    setJoining(true)
    setError('')
    try {
      await loginAnon()
      // Auth state change will trigger the effect above to redirect
    } catch (e) {
      setError('Failed to join. Please try again.')
      setJoining(false)
    }
  }

  if (loading || (user && id)) {
    return (
      <div className="min-h-screen bg-[#070710] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#070710] flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-violet-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center">
              <Music size={14} className="text-violet-400" />
            </div>
            <span className="text-xl font-bold font-[Syne] text-white">Syncy</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
              <Users size={18} className="text-violet-400" />
            </div>
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-0.5">You're invited to</p>
              <h1 className="text-lg font-semibold text-white font-[Syne]">
                {room ? room.name : 'a music room'}
              </h1>
            </div>
          </div>

          {room && (
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 mb-5">
              <p className="text-xs text-white/40 mb-1">Now playing</p>
              <p className="text-sm text-white/80 font-medium truncate">
                {room.current_song?.title ?? 'Nothing yet — be the first!'}
              </p>
              {room.current_song && (
                <p className="text-xs text-white/40 truncate">{room.current_song.artist}</p>
              )}
            </div>
          )}

          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 rounded-xl text-white text-sm font-semibold transition-all duration-200 shadow-lg shadow-violet-900/40"
          >
            {joining
              ? <><Loader2 size={16} className="animate-spin" /> Joining...</>
              : <><ArrowRight size={16} /> Join as Guest</>}
          </button>

          {error && <p className="text-xs text-red-400 text-center mt-3">{error}</p>}

          <p className="text-xs text-white/30 text-center mt-4">
            No account needed — listen in sync instantly
          </p>
        </div>

        <p className="text-center mt-6">
          <a href="/login" className="text-xs text-violet-400/60 hover:text-violet-400 transition-colors">
            Have an account? Sign in
          </a>
        </p>
      </div>
    </div>
  )
}
