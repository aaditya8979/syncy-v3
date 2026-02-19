import { useState, useEffect } from 'react'
import { BarChart2, Check, Music, X, Trophy, Timer, Zap, Crown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Poll, Song } from '@/types'
import { cn } from '@/lib/utils'

// ─── Poll Sidebar (always visible on right) ───────────────────────────────────

interface PollSidebarProps {
  poll: Poll | null
  isHost: boolean
  currentUserId: string
  queue: Song[]
  onVote: (pollId: string, songId: string) => void
  onClose: () => void
  onCreatePoll: () => void
  onPickWinner: (songId: string) => void
}

export const PollSidebar = ({
  poll,
  isHost,
  currentUserId,
  queue,
  onVote,
  onClose,
  onCreatePoll,
  onPickWinner,
}: PollSidebarProps) => {
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  // Countdown timer
  useEffect(() => {
    if (!poll?.active || !poll.ends_at) return
    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(poll.ends_at!).getTime() - Date.now()) / 1000))
      setTimeLeft(left)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [poll?.id, poll?.ends_at, poll?.active])

  const hasPoll = poll?.active

  return (
    <div className="w-[260px] flex-shrink-0 border-l border-s-border/40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-s-border/40 flex-shrink-0">
        <div className="flex items-center gap-2">
          <BarChart2 size={14} className="text-s-violet" />
          <span className="text-sm font-display font-semibold text-s-text">Poll</span>
          {hasPoll && (
            <span className="text-xs bg-s-violet/20 text-s-violet px-1.5 py-0.5 rounded-full animate-pulse">
              LIVE
            </span>
          )}
        </div>
        {isHost && hasPoll && (
          <button
            onClick={onClose}
            className="text-s-muted hover:text-s-text transition-colors"
            aria-label="Close poll"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        <AnimatePresence mode="wait">
          {hasPoll && poll ? (
            <motion.div
              key="active-poll"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-3"
            >
              {/* Timer */}
              {timeLeft !== null && (
                <div className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs',
                  timeLeft > 15
                    ? 'border-s-violet/30 bg-s-violet/10 text-s-violet'
                    : timeLeft > 5
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                    : 'border-red-500/30 bg-red-500/10 text-red-400 animate-pulse'
                )}>
                  <Timer size={12} />
                  {timeLeft > 0 ? `${timeLeft}s remaining` : 'Poll ended'}
                </div>
              )}

              <p className="text-xs text-s-sub px-1">
                {Object.keys(poll.votes).length} vote{Object.keys(poll.votes).length !== 1 ? 's' : ''} cast
              </p>

              {/* Options */}
              {poll.options.map(song => {
                const voteCount = Object.values(poll.votes).filter(v => v === song.id).length
                const total = Object.keys(poll.votes).length
                const pct = total === 0 ? 0 : Math.round((voteCount / total) * 100)
                const voted = poll.votes[currentUserId] === song.id
                const isLeading = poll.options.every(
                  o => voteCount >= Object.values(poll.votes).filter(v => v === o.id).length
                ) && total > 0

                return (
                  <motion.div key={song.id} layout className="relative">
                    <button
                      onClick={() => !poll.votes[currentUserId] && onVote(poll.id, song.id)}
                      disabled={!!poll.votes[currentUserId]}
                      className={cn(
                        'relative w-full p-3 rounded-xl border text-left transition-all overflow-hidden',
                        voted
                          ? 'border-s-violet bg-s-violet/10'
                          : poll.votes[currentUserId]
                          ? 'border-s-border bg-s-surface cursor-default'
                          : 'border-s-border bg-s-surface hover:border-s-violet/40 hover:bg-s-card cursor-pointer'
                      )}
                    >
                      {/* Progress fill */}
                      {poll.votes[currentUserId] && (
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          className={cn(
                            'absolute inset-0 rounded-xl',
                            isLeading ? 'bg-s-violet/15' : 'bg-s-border/20'
                          )}
                        />
                      )}

                      <div className="relative flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex-shrink-0 overflow-hidden bg-s-card border border-s-border/40">
                          {song.coverUrl
                            ? <img src={song.coverUrl} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center"><Music size={10} className="text-s-muted" /></div>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-s-text truncate">{song.title}</p>
                          <p className="text-xs text-s-muted truncate">{song.artist}</p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          {poll.votes[currentUserId] ? (
                            <span className={cn('text-xs font-mono font-bold', isLeading ? 'text-s-violet' : 'text-s-muted')}>
                              {pct}%
                            </span>
                          ) : (
                            <div className={cn(
                              'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                              voted ? 'border-s-violet bg-s-violet' : 'border-s-border'
                            )}>
                              {voted && <Check size={10} className="text-white" />}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Leading indicator */}
                      {isLeading && poll.votes[currentUserId] && (
                        <div className="relative flex items-center gap-1 mt-1.5 text-xs text-s-violet">
                          <Zap size={10} />
                          Leading
                        </div>
                      )}
                    </button>
                  </motion.div>
                )
              })}

              {/* Host: pick winner */}
              {isHost && poll.votes[currentUserId] !== undefined && (
                <div className="space-y-2 pt-2 border-t border-s-border/40">
                  <p className="text-xs text-s-muted">Pick winner</p>
                  {poll.options.map(song => {
                    const vc = Object.values(poll.votes).filter(v => v === song.id).length
                    const total = Object.keys(poll.votes).length
                    const pct = total > 0 ? Math.round((vc / total) * 100) : 0
                    return (
                      <button
                        key={song.id}
                        onClick={() => onPickWinner(song.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-s-card border border-s-border hover:border-s-violet/40 text-xs transition-all"
                      >
                        <Trophy size={12} className="text-amber-400 flex-shrink-0" />
                        <span className="flex-1 text-left truncate text-s-text">{song.title}</span>
                        <span className="font-mono text-s-violet">{pct}%</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {!poll.votes[currentUserId] && (
                <p className="text-center text-xs text-s-muted py-2 animate-pulse">
                  Tap to vote!
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="no-poll"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center gap-3 py-8 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-s-card border border-s-border flex items-center justify-center">
                <BarChart2 size={20} className="text-s-muted" />
              </div>
              <div>
                <p className="text-sm text-s-sub">No active poll</p>
                <p className="text-xs text-s-muted mt-0.5">Let members vote on the next song</p>
              </div>
              {isHost && (
                <button
                  onClick={onCreatePoll}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-s-violet/15 border border-s-violet/30 text-s-violet hover:bg-s-violet/20 transition-all"
                >
                  <BarChart2 size={12} />
                  Create Poll
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Create Poll Modal ────────────────────────────────────────────────────────

interface CreatePollModalProps {
  queue: Song[]
  onClose: () => void
  onCreate: (options: Song[]) => void
}

export const CreatePollModal = ({ queue, onClose, onCreate }: CreatePollModalProps) => {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setSelected(s => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else if (n.size < 3) n.add(id)
      return n
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="relative w-full max-w-sm bg-s-card border border-s-border rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-s-border">
          <div>
            <h3 className="font-display font-semibold text-s-text">Create Poll</h3>
            <p className="text-xs text-s-muted mt-0.5">Select 2–3 songs for members to vote on</p>
          </div>
          <button onClick={onClose} className="text-s-muted hover:text-s-text transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {/* Progress */}
          <div className="flex gap-1">
            {[1, 2, 3].map(i => (
              <div key={i} className={cn(
                'h-1 flex-1 rounded-full transition-all duration-300',
                i <= selected.size ? 'bg-s-violet' : 'bg-s-border'
              )} />
            ))}
          </div>

          {queue.length === 0 ? (
            <p className="text-center text-s-muted text-sm py-4">Add songs to queue first</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {queue.map(song => {
                const isSelected = selected.has(song.id)
                const isDisabled = !isSelected && selected.size >= 3
                return (
                  <button
                    key={song.id}
                    onClick={() => toggle(song.id)}
                    disabled={isDisabled}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                      isSelected
                        ? 'border-s-violet bg-s-violet/10'
                        : isDisabled
                        ? 'border-s-border opacity-40 cursor-not-allowed'
                        : 'border-s-border hover:border-s-violet/40 hover:bg-s-surface cursor-pointer'
                    )}
                  >
                    <div className={cn(
                      'w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all',
                      isSelected ? 'border-s-violet bg-s-violet' : 'border-s-border'
                    )}>
                      {isSelected && <Check size={10} className="text-white" />}
                    </div>
                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-s-deep flex-shrink-0">
                      {song.coverUrl
                        ? <img src={song.coverUrl} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><Music size={12} className="text-s-muted" /></div>
                      }
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-s-text truncate">{song.title}</p>
                      <p className="text-xs text-s-muted truncate">{song.artist}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          <button
            onClick={() => onCreate(queue.filter(s => selected.has(s.id)))}
            disabled={selected.size < 2}
            className="w-full py-3 rounded-xl bg-s-violet hover:bg-s-violet/90 text-white font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-98 flex items-center justify-center gap-2"
          >
            <BarChart2 size={16} />
            Start Poll ({selected.size} selected)
          </button>
        </div>
      </motion.div>
    </div>
  )
}
