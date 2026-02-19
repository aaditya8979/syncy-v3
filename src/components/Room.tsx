import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Play, Pause, SkipForward, Volume2, VolumeX,
  Users, ListMusic, Search, BarChart2, Copy, Check,
  GripVertical, Trash2, Crown, Radio, WifiOff,
  ChevronLeft, Music, Shuffle, Repeat, Plus,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { PlayerEmbed, type PlayerHandle } from './PlayerEmbed'
import { SongSearch } from './SongSearch'
import { PollSidebar, CreatePollModal } from './PollModal'
import { useRoom } from '@/hooks/useRoom'
import { useRealtime } from '@/hooks/useRealtime'
import type { Song, SyncEvent, SearchResult, Room as RoomType } from '@/types'
import { cn } from '@/lib/utils'

interface RoomProps {
  roomId: string
  userId: string
  username: string
}

type Panel = 'queue' | 'search' | 'members'

export const Room = ({ roomId, userId, username }: RoomProps) => {
  const navigate = useNavigate()
  const playerRef = useRef<PlayerHandle>(null)
  const syncIntervalRef = useRef<number>(0)
  const discRef = useRef<HTMLDivElement>(null)
  const discRotationRef = useRef(0)
  const lastTimestampRef = useRef<number>(0)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [isMuted, setIsMuted] = useState(false)
  const [prevVolume, setPrevVolume] = useState(0.8)
  const [panel, setPanel] = useState<Panel>('queue')
  const [showCreatePoll, setShowCreatePoll] = useState(false)
  const [copied, setCopied] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [isRepeat, setIsRepeat] = useState(false)

  const {
    room, activePoll, isLoading,
    addSong, removeSong, reorderQueue,
    setCurrentSong, updateStatus, startPoll, vote, skipToNext, closePoll,
    updateRoom: applyRoomUpdate, updatePoll,
  } = useRoom(roomId, userId, username)

  const isHost = room?.host_id === userId
  const currentSong = room?.current_song
  const duration = currentSong?.duration || 0
  const effectiveVolume = isMuted ? 0 : volume

  // ── Disc animation ─────────────────────────────────────────────────────────
  useEffect(() => {
    let animId: number
    const animate = (ts: number) => {
      if (isPlaying && discRef.current) {
        const delta = lastTimestampRef.current ? (ts - lastTimestampRef.current) / 1000 : 0
        discRotationRef.current = (discRotationRef.current + delta * 30) % 360
        discRef.current.style.transform = `rotate(${discRotationRef.current}deg)`
      }
      lastTimestampRef.current = ts
      animId = requestAnimationFrame(animate)
    }
    animId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animId)
  }, [isPlaying])

  // ── Sync handler ───────────────────────────────────────────────────────────
  const handleSync = useCallback((event: SyncEvent) => {
    if (isHost) return
    const networkLatency = (Date.now() - event.server_time) / 1000
    const expectedPos = event.position + networkLatency
    const player = playerRef.current
    if (!player) return

    const localTime = player.getCurrentTime()
    const drift = Math.abs(localTime - expectedPos)

    if (drift > 0.3) {
      player.seekTo(expectedPos)
    }

    if (event.status === 'playing') {
      player.play().catch(() => {})
      setIsPlaying(true)
      setCurrentTime(expectedPos)
    } else if (event.status === 'paused') {
      player.pause()
      setIsPlaying(false)
      setCurrentTime(event.position)
    }
  }, [isHost])

  const handleSongChangeFromServer = useCallback((song: Song | null) => {
    if (isHost) return
    if (song) {
      setCurrentTime(0)
      setIsPlaying(true)
    } else {
      setIsPlaying(false)
      setCurrentTime(0)
    }
  }, [isHost])

  const { connected, members, broadcastPlay, broadcastPause, broadcastPosition, broadcastNext, broadcastSongChange } =
    useRealtime({
      roomId, userId, username, isHost,
      onSync: handleSync,
      onRoomUpdate: applyRoomUpdate,
      onPollUpdate: updatePoll,
      onSongChange: handleSongChangeFromServer,
    })

  // ── Host broadcasts position every 500ms ──────────────────────────────────
  useEffect(() => {
    if (!isHost || !isPlaying) {
      clearInterval(syncIntervalRef.current)
      return
    }
    syncIntervalRef.current = window.setInterval(() => {
      const pos = playerRef.current?.getCurrentTime() || 0
      broadcastPosition(pos, 'playing')
    }, 500)
    return () => clearInterval(syncIntervalRef.current)
  }, [isHost, isPlaying, broadcastPosition])

  // ── Sync volume to player ──────────────────────────────────────────────────
  useEffect(() => {
    playerRef.current?.setVolume(effectiveVolume)
  }, [effectiveVolume])

  // ── Show poll notification ─────────────────────────────────────────────────
  useEffect(() => {
    if (activePoll?.active) setPanel('queue') // keep queue visible, poll in sidebar
  }, [activePoll?.id])

  // ── Room state sync (non-host joins mid-play) ──────────────────────────────
  useEffect(() => {
    if (!room || isHost) return
    if (room.status === 'playing' && room.current_song) {
      const elapsed = room.current_song.startedAt
        ? (Date.now() - room.current_song.startedAt) / 1000
        : room.current_song.position || 0
      setTimeout(() => {
        playerRef.current?.seekTo(elapsed)
        playerRef.current?.play().catch(() => {})
        setIsPlaying(true)
      }, 800)
    } else if (room.status === 'paused') {
      setIsPlaying(false)
    }
  }, [room?.id, isHost]) // Only on initial load

  // ── Controls ───────────────────────────────────────────────────────────────
  const handlePlay = async () => {
    if (!currentSong) return
    try {
      await playerRef.current?.play()
      setIsPlaying(true)
      if (isHost) {
        const pos = playerRef.current?.getCurrentTime() || currentTime
        await updateStatus('playing')
        broadcastPlay(pos)
      }
    } catch (e) {
      console.error('Play failed:', e)
    }
  }

  const handlePause = async () => {
    playerRef.current?.pause()
    setIsPlaying(false)
    if (isHost) {
      const pos = playerRef.current?.getCurrentTime() || currentTime
      await updateStatus('paused')
      broadcastPause(pos)
    }
  }

  const handleSkip = async () => {
    if (!isHost) return
    clearInterval(syncIntervalRef.current)
    setIsPlaying(false)
    setCurrentTime(0)
    await skipToNext()
    broadcastNext()
    broadcastSongChange(room?.queue[0] || null)
    setTimeout(() => {
      playerRef.current?.play().catch(() => {})
      setIsPlaying(true)
    }, 500)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isHost) return
    const val = parseFloat(e.target.value)
    playerRef.current?.seekTo(val)
    setCurrentTime(val)
    broadcastPosition(val, isPlaying ? 'playing' : 'paused')
  }

  const handleEnded = useCallback(() => {
    if (!isHost) return
    if (isRepeat && currentSong) {
      playerRef.current?.seekTo(0)
      playerRef.current?.play().catch(() => {})
      broadcastPosition(0, 'playing')
    } else {
      handleSkip()
    }
  }, [isHost, isRepeat, currentSong])

  const handleAddSong = (result: SearchResult) => {
    const song: Song = {
      id: result.id,
      title: result.title,
      artist: result.artist,
      url: result.url,
      coverUrl: result.coverUrl,
      duration: result.duration,
      source: result.source,
      addedBy: userId,
    }
    addSong(song)
    if (!room?.current_song && isHost) {
      setCurrentSong(song, 0)
      broadcastSongChange(song)
      setTimeout(() => {
        playerRef.current?.play().catch(() => {})
        setIsPlaying(true)
      }, 600)
    }
  }

  const handleVolumeToggle = () => {
    if (isMuted) {
      setIsMuted(false)
      setVolume(prevVolume)
    } else {
      setPrevVolume(volume)
      setIsMuted(true)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
    setIsMuted(val === 0)
  }

  const copyLink = () => {
    const joinUrl = `${window.location.origin}/join/${roomId}`
    navigator.clipboard.writeText(joinUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0

  // Drag-to-reorder
  const handleDragStart = (idx: number) => setDragIdx(idx)
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx || !room) return
    const newQ = [...room.queue]
    const [moved] = newQ.splice(dragIdx, 1)
    newQ.splice(idx, 0, moved)
    reorderQueue(newQ)
    setDragIdx(idx)
  }
  const handleDragEnd = () => setDragIdx(null)

  const handlePollWinner = (songId: string) => {
    if (!activePoll || !isHost) return
    const winner = activePoll.options.find(s => s.id === songId)
    if (!winner) return
    closePoll(activePoll.id)
    // Add winner to front of queue
    const newQueue = [winner, ...(room?.queue || [])]
    reorderQueue(newQueue)
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="h-screen bg-s-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full border-2 border-s-violet/30 border-t-s-violet animate-spin" />
        <p className="text-s-sub text-sm font-body">Loading room…</p>
      </div>
    </div>
  )

  if (!room) return (
    <div className="h-screen bg-s-bg flex flex-col items-center justify-center gap-4">
      <Music size={40} className="text-s-muted" />
      <p className="text-s-sub">Room not found</p>
      <button onClick={() => navigate('/dashboard')} className="text-s-violet hover:underline text-sm">
        ← Back to dashboard
      </button>
    </div>
  )

  return (
    <div className="h-screen bg-s-bg flex flex-col overflow-hidden font-body">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-s-violet/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-s-indigo/5 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-s-cyan/3 rounded-full blur-[80px]" />
      </div>
      <div className="fixed inset-0 bg-grid-fine bg-grid pointer-events-none opacity-100" />

      {/* ── Header ── */}
      <header className="relative z-20 flex items-center justify-between px-5 py-3 border-b border-s-border/40 bg-s-bg/60 backdrop-blur-xl flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-s-hover text-s-sub hover:text-s-text transition-all"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="font-display font-semibold text-s-text text-sm leading-none tracking-tight">{room.name}</h1>
            <p className="text-s-muted text-xs mt-0.5 font-mono">— listening</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Live indicator */}
          <div className={cn('flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border',
            connected
              ? 'border-s-green/30 bg-s-green/10 text-s-green'
              : 'border-red-500/30 bg-red-500/10 text-red-400'
          )}>
            {connected ? <Radio size={10} className="animate-pulse" /> : <WifiOff size={10} />}
            {connected ? 'Live' : 'Offline'}
          </div>

          {isHost && (
            <div className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-s-violet/15 border border-s-violet/30 text-s-violet">
              <Crown size={10} />
              Host
            </div>
          )}

          <button onClick={copyLink}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-s-card border border-s-border hover:border-s-violet/40 text-s-sub hover:text-s-text transition-all"
          >
            {copied ? <Check size={12} className="text-s-green" /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Share'}
          </button>
        </div>
      </header>

      {/* ── Main layout ── */}
      <div className="relative z-10 flex flex-1 min-h-0">

        {/* ── LEFT: Player ── */}
        <div className="w-[340px] flex-shrink-0 flex flex-col p-5 gap-4 border-r border-s-border/40">

          {/* Disc player */}
          <div className="flex flex-col items-center gap-5">
            {/* Vinyl disc */}
            <div className="relative flex items-center justify-center">
              {/* Outer glow ring */}
              <div className={cn(
                'absolute w-[220px] h-[220px] rounded-full transition-all duration-700',
                isPlaying
                  ? 'shadow-disc opacity-100'
                  : 'opacity-0'
              )} />

              {/* Spinning disc */}
              <div
                ref={discRef}
                className={cn(
                  'disc-outer disc-grooves w-[200px] h-[200px]',
                  !isPlaying && 'transition-none'
                )}
                style={{ willChange: 'transform' }}
              >
                {/* Album art in center */}
                <div className="absolute w-[90px] h-[90px] rounded-full overflow-hidden border-2 border-s-border/50 shadow-inner-disc z-10">
                  {currentSong?.coverUrl ? (
                    <img src={currentSong.coverUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-s-deep flex items-center justify-center">
                      <Music size={24} className="text-s-muted" />
                    </div>
                  )}
                </div>
                {/* Center hole */}
                <div className="absolute w-[16px] h-[16px] rounded-full bg-s-bg border border-s-border z-20" />
              </div>

              {/* Tonearm */}
              <div className={cn(
                'absolute top-0 right-0 w-[60px] h-[80px] origin-top-right transition-transform duration-700',
                isPlaying ? 'rotate-[-20deg]' : 'rotate-[-35deg]'
              )}>
                <div className="absolute top-0 right-0 w-1 h-[70px] bg-gradient-to-b from-s-border to-s-muted rounded-full" />
                <div className="absolute bottom-0 right-[-2px] w-[12px] h-[12px] rounded-full bg-s-violet" />
              </div>

              {/* EQ bars - show when playing */}
              {isPlaying && (
                <div className="absolute bottom-[-16px] flex gap-0.5 items-end h-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="eq-bar h-full" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              )}
            </div>

            {/* Song info */}
            <div className="text-center w-full px-2 mt-2">
              {currentSong ? (
                <>
                  <h2 className="font-display font-semibold text-s-text text-lg leading-tight truncate">
                    {currentSong.title}
                  </h2>
                  <p className="text-s-sub text-sm truncate mt-0.5">{currentSong.artist}</p>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <span className={cn('text-xs px-1.5 py-0.5 rounded font-mono',
                      currentSong.source === 'jiosaavn' ? 'bg-s-pink/15 text-s-pink' :
                      currentSong.source === 'youtube' ? 'bg-red-500/15 text-red-400' :
                      'bg-s-green/15 text-s-green'
                    )}>
                      {currentSong.source === 'jiosaavn' ? 'JioSaavn' : currentSong.source === 'youtube' ? 'YouTube' : 'Jamendo'}
                    </span>
                  </div>
                </>
              ) : (
                <div className="py-2">
                  <p className="text-s-sub text-sm">No song playing</p>
                  <p className="text-s-muted text-xs mt-1">Add songs to the queue</p>
                </div>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="relative">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                step={0.1}
                onChange={handleSeek}
                disabled={!isHost || !currentSong}
                className={cn('w-full', !isHost && 'cursor-not-allowed')}
                style={{ '--progress': `${progressPct}%` } as React.CSSProperties}
                aria-label="Seek"
              />
            </div>
            <div className="flex justify-between text-xs font-mono text-s-muted">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Player controls */}
          <div className="flex flex-col gap-3">
            {/* Main controls */}
            <div className="flex items-center justify-center gap-5">
              <button
                onClick={() => setIsRepeat(!isRepeat)}
                className={cn('transition-all', isRepeat ? 'text-s-violet' : 'text-s-muted hover:text-s-sub')}
                aria-label="Repeat"
              >
                <Repeat size={16} />
              </button>

              {/* Play/Pause */}
              <button
                onClick={isPlaying ? handlePause : handlePlay}
                disabled={!currentSong || !isHost}
                className={cn(
                  'w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200',
                  currentSong && isHost
                    ? 'bg-s-violet hover:bg-s-violet/90 text-white shadow-glow-sm active:scale-95'
                    : 'bg-s-card text-s-muted cursor-not-allowed border border-s-border'
                )}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying
                  ? <Pause size={22} fill="currentColor" />
                  : <Play size={22} fill="currentColor" className="translate-x-0.5" />
                }
              </button>

              <button
                onClick={handleSkip}
                disabled={!isHost}
                className="text-s-muted hover:text-s-sub transition-colors disabled:opacity-30"
                aria-label="Skip"
              >
                <SkipForward size={20} />
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2.5 px-1">
              <button onClick={handleVolumeToggle} className="text-s-sub hover:text-s-text transition-colors flex-shrink-0">
                {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                style={{ '--progress': `${(isMuted ? 0 : volume) * 100}%` } as React.CSSProperties}
                aria-label="Volume"
                className="flex-1"
              />
              <span className="text-xs font-mono text-s-muted w-7 text-right">
                {Math.round((isMuted ? 0 : volume) * 100)}
              </span>
            </div>
          </div>

          {/* Non-host notice */}
          {!isHost && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-s-violet/8 border border-s-violet/20 text-xs text-s-sub">
              <Radio size={12} className="text-s-violet flex-shrink-0" />
              Synced to host · Controls locked
            </div>
          )}

          {/* Hidden player */}
          {currentSong && (
            <PlayerEmbed
              key={currentSong.id}
              ref={playerRef}
              song={currentSong}
              volume={effectiveVolume}
              onTimeUpdate={setCurrentTime}
              onEnded={handleEnded}
              onReady={() => {
                if (isHost && room?.status === 'playing') {
                  setTimeout(() => playerRef.current?.play().catch(() => {}), 200)
                }
              }}
              autoPlay={isHost && room?.status === 'playing'}
            />
          )}
        </div>

        {/* ── CENTER: Panel ── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Tabs */}
          <div className="flex border-b border-s-border/40 px-1 flex-shrink-0">
            {[
              { id: 'queue' as Panel, label: 'Queue', icon: <ListMusic size={14} />, count: room.queue.length },
              { id: 'search' as Panel, label: 'Search', icon: <Search size={14} /> },
              { id: 'members' as Panel, label: 'Members', icon: <Users size={14} />, count: members.length },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setPanel(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px',
                  panel === tab.id
                    ? 'border-s-violet text-s-violet'
                    : 'border-transparent text-s-sub hover:text-s-text hover:border-s-border'
                )}
              >
                {tab.icon}
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={cn(
                    'text-xs rounded-full px-1.5 py-0.5 font-mono leading-none',
                    panel === tab.id ? 'bg-s-violet/20 text-s-violet' : 'bg-s-border text-s-muted'
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden min-h-0">
            <AnimatePresence mode="wait">
              {/* ── QUEUE ── */}
              {panel === 'queue' && (
                <motion.div
                  key="queue"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="h-full flex flex-col"
                >
                  <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
                    <div>
                      <h3 className="font-display font-semibold text-s-text text-sm">Up Next</h3>
                      <p className="text-xs text-s-muted">{room.queue.length} songs</p>
                    </div>
                    {isHost && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowCreatePoll(true)}
                          disabled={room.queue.length < 2}
                          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-s-violet/15 border border-s-violet/30 text-s-violet hover:bg-s-violet/20 transition-all disabled:opacity-40"
                        >
                          <BarChart2 size={12} />
                          Poll
                        </button>
                        <button
                          onClick={() => { setPanel('search'); setShowSearch(true) }}
                          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-s-card border border-s-border text-s-sub hover:text-s-text hover:border-s-violet/30 transition-all"
                        >
                          <Plus size={12} />
                          Add
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
                    {room.queue.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center gap-3 py-12 text-s-muted">
                        <div className="w-16 h-16 rounded-full bg-s-card border border-s-border flex items-center justify-center">
                          <ListMusic size={24} strokeWidth={1.5} />
                        </div>
                        <p className="text-sm">Queue is empty</p>
                        <button
                          onClick={() => setPanel('search')}
                          className="text-xs text-s-violet hover:underline"
                        >
                          Search for songs →
                        </button>
                      </div>
                    ) : room.queue.map((song, idx) => (
                      <div
                        key={song.id}
                        draggable={isHost}
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={e => handleDragOver(e, idx)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          'flex items-center gap-3 p-2.5 rounded-xl border transition-all group',
                          dragIdx === idx
                            ? 'bg-s-violet/10 border-s-violet/30'
                            : 'bg-s-surface/50 border-transparent hover:bg-s-card hover:border-s-border',
                          isHost && 'cursor-grab active:cursor-grabbing'
                        )}
                      >
                        {isHost && <GripVertical size={14} className="text-s-muted flex-shrink-0 opacity-0 group-hover:opacity-100" />}
                        <span className="text-xs text-s-muted font-mono w-5 text-center flex-shrink-0">{idx + 1}</span>

                        <div className="w-9 h-9 rounded-lg bg-s-card flex-shrink-0 overflow-hidden border border-s-border/50">
                          {song.coverUrl
                            ? <img src={song.coverUrl} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center"><Music size={14} className="text-s-muted" /></div>
                          }
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-s-text truncate font-medium">{song.title}</p>
                          <p className="text-xs text-s-sub truncate">{song.artist}</p>
                        </div>

                        <div className={cn('text-xs px-1.5 py-0.5 rounded font-mono flex-shrink-0',
                          song.source === 'jiosaavn' ? 'text-s-pink/60' :
                          song.source === 'youtube' ? 'text-red-400/60' : 'text-s-green/60'
                        )}>
                          {song.duration ? formatTime(song.duration) : '—'}
                        </div>

                        {isHost && (
                          <button
                            onClick={() => removeSong(song.id)}
                            className="text-s-muted hover:text-red-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                            aria-label="Remove"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── SEARCH ── */}
              {panel === 'search' && (
                <motion.div
                  key="search"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="h-full flex flex-col p-4 overflow-hidden"
                >
                  <SongSearch onAdd={handleAddSong} />
                </motion.div>
              )}

              {/* ── MEMBERS ── */}
              {panel === 'members' && (
                <motion.div
                  key="members"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="h-full overflow-y-auto p-4 space-y-2"
                >
                  <div className="mb-4">
                    <h3 className="font-display font-semibold text-s-text text-sm">
                      Listeners
                    </h3>
                    <p className="text-xs text-s-muted mt-0.5">
                      {members.length} {members.length === 1 ? 'person' : 'people'} in this room
                    </p>
                  </div>

                  {members.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-12 text-s-muted">
                      <Users size={32} strokeWidth={1.5} />
                      <p className="text-sm">Waiting for members</p>
                      <p className="text-xs text-s-muted">Share the room link to invite others</p>
                    </div>
                  ) : members.map((member) => (
                    <div key={member.user_id} className="flex items-center gap-3 p-3 rounded-xl bg-s-card/60 border border-s-border/40 hover:border-s-border transition-all">
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-s-violet to-s-indigo flex items-center justify-center text-white font-bold text-sm uppercase">
                          {(member.username || '?')[0]}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-s-green border-2 border-s-bg" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-s-text truncate">
                          {member.username || 'Anonymous'}
                        </p>
                        <p className="text-xs text-s-muted">
                          {member.user_id === room.host_id ? '👑 Host' : 'Listener'}
                        </p>
                      </div>
                      {member.user_id === userId && (
                        <span className="text-xs text-s-sub bg-s-surface px-2 py-0.5 rounded-full">You</span>
                      )}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── RIGHT: Poll sidebar ── */}
        <PollSidebar
          poll={activePoll ?? null}
          isHost={isHost}
          currentUserId={userId}
          queue={room.queue}
          onVote={vote}
          onClose={() => activePoll && closePoll(activePoll.id)}
          onCreatePoll={() => setShowCreatePoll(true)}
          onPickWinner={handlePollWinner}
        />
      </div>

      {/* Create poll modal */}
      <AnimatePresence>
        {showCreatePoll && (
          <CreatePollModal
            queue={room.queue}
            onClose={() => setShowCreatePoll(false)}
            onCreate={(options) => {
              startPoll(options)
              setShowCreatePoll(false)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
