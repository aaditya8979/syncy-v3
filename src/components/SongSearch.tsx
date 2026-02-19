import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Plus, Music, Youtube, Disc3, Loader2, Check, Globe } from 'lucide-react'
import { searchMusic } from '@/services/musicApi'
import type { MusicSource, SearchResult } from '@/types'
import { cn } from '@/lib/utils'

interface SongSearchProps {
  onAdd: (song: SearchResult) => void
}

const SOURCES: { id: MusicSource; label: string; icon: React.ReactNode; accent: string; desc: string }[] = [
  {
    id: 'jiosaavn',
    label: 'JioSaavn',
    icon: <Disc3 size={14} />,
    accent: 'text-pink-400 border-pink-500/40 bg-pink-500/10',
    desc: 'Best for Hindi & Bollywood',
  },
  {
    id: 'jamendo',
    label: 'Jamendo',
    icon: <Globe size={14} />,
    accent: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
    desc: 'Free CC-licensed music',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    icon: <Youtube size={14} />,
    accent: 'text-red-400 border-red-500/40 bg-red-500/10',
    desc: 'Video & music',
  },
]

const formatDur = (s?: number) => {
  if (!s) return ''
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

export const SongSearch = ({ onAdd }: SongSearchProps) => {
  const [source, setSource] = useState<MusicSource>('jiosaavn')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleInput = (val: string) => {
    setQuery(val)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDebouncedQuery(val), 450)
  }

  const { data: results = [], isFetching, isError } = useQuery({
    queryKey: ['search', source, debouncedQuery],
    queryFn: () => searchMusic(debouncedQuery, source),
    enabled: debouncedQuery.length >= 2,
    staleTime: 120_000,
    retry: 1,
  })

  const handleAdd = (song: SearchResult) => {
    onAdd(song)
    setAddedIds(s => new Set([...s, song.id]))
    setTimeout(() => {
      setAddedIds(s => { const n = new Set(s); n.delete(song.id); return n })
    }, 3000)
  }

  const active = SOURCES.find(s => s.id === source)!

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Source selector */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-s-muted font-medium uppercase tracking-wider px-1">Source</p>
        <div className="grid grid-cols-3 gap-1.5">
          {SOURCES.map(src => (
            <button
              key={src.id}
              onClick={() => { setSource(src.id); setDebouncedQuery('') }}
              className={cn(
                'flex flex-col items-center gap-1 py-2 px-2 rounded-xl border text-xs font-medium transition-all',
                source === src.id
                  ? src.accent
                  : 'border-s-border bg-s-surface text-s-sub hover:text-s-text hover:border-s-border/70'
              )}
            >
              <span>{src.icon}</span>
              <span>{src.label}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-s-muted px-1">{active.desc}</p>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-s-muted" />
        <input
          type="text"
          value={query}
          onChange={e => handleInput(e.target.value)}
          placeholder={`Search ${active.label}…`}
          className="w-full pl-9 pr-10 py-2.5 bg-s-deep border border-s-border rounded-xl text-sm text-s-text placeholder-s-muted focus:outline-none focus:border-s-violet/60 transition-colors"
          aria-label="Search songs"
        />
        {isFetching && (
          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-s-violet animate-spin" />
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
        {debouncedQuery.length < 2 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-s-muted">
            <Music size={28} strokeWidth={1.5} />
            <p className="text-sm">Type to search</p>
          </div>
        )}

        {!isFetching && isError && (
          <p className="text-center text-xs text-red-400 py-8">
            Search failed. Try another source.
          </p>
        )}

        {!isFetching && !isError && debouncedQuery.length >= 2 && results.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-s-muted">
            <p className="text-sm">No results found</p>
            <p className="text-xs">Try a different search or source</p>
          </div>
        )}

        {results.map((song) => (
          <div
            key={song.id}
            className="flex items-center gap-3 p-2.5 rounded-xl border border-transparent hover:bg-s-card hover:border-s-border transition-all group"
          >
            {/* Cover */}
            <div className="w-10 h-10 rounded-lg bg-s-card flex-shrink-0 overflow-hidden border border-s-border/40">
              {song.coverUrl
                ? <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><Music size={14} className="text-s-muted" /></div>
              }
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-s-text truncate">{song.title}</p>
              <p className="text-xs text-s-sub truncate">{song.artist}</p>
            </div>

            {/* Duration */}
            {song.duration ? (
              <span className="text-xs text-s-muted font-mono flex-shrink-0">{formatDur(song.duration)}</span>
            ) : null}

            {/* Add */}
            <button
              onClick={() => handleAdd(song)}
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center transition-all flex-shrink-0',
                addedIds.has(song.id)
                  ? 'bg-s-green/20 text-s-green'
                  : 'bg-s-violet/15 text-s-violet hover:bg-s-violet hover:text-white opacity-0 group-hover:opacity-100'
              )}
              aria-label={`Add ${song.title}`}
            >
              {addedIds.has(song.id) ? <Check size={12} /> : <Plus size={12} />}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
