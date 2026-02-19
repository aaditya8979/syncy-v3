import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react'
import type { Song } from '@/types'

export interface PlayerHandle {
  play: () => Promise<void>
  pause: () => void
  seekTo: (seconds: number) => void
  getCurrentTime: () => number
  setVolume: (vol: number) => void
}

interface PlayerEmbedProps {
  song: Song | null // Changed to allow null to prevent crash
  volume: number
  onTimeUpdate?: (time: number) => void
  onEnded?: () => void
  onReady?: () => void
  autoPlay?: boolean
}

const YT_PLAYING = 1
const YT_ENDED = 0

export const PlayerEmbed = forwardRef<PlayerHandle, PlayerEmbedProps>(
  ({ song, volume, onTimeUpdate, onEnded, onReady, autoPlay = false }, ref) => {
    const audioRef = useRef<HTMLAudioElement>(null)
    const ytPlayerRef = useRef<YTPlayer | null>(null)
    const [ytReady, setYtReady] = useState(false)
    const volumeRef = useRef(volume)
    const timeIntervalRef = useRef<number>(0)

    // Safety check to prevent crash if song is null
    const isYouTube = song?.source === 'youtube'

    useEffect(() => { volumeRef.current = volume }, [volume])

    // ── Audio Element ────────────────────────────────────────────────────────
    useEffect(() => {
      const audio = audioRef.current
      if (!audio || isYouTube || !song) return

      audio.volume = volume
      const handleTimeUpdate = () => onTimeUpdate?.(audio.currentTime)
      const handleEnded = () => onEnded?.()
      const handleCanPlay = () => onReady?.()

      audio.addEventListener('timeupdate', handleTimeUpdate)
      audio.addEventListener('ended', handleEnded)
      audio.addEventListener('canplay', handleCanPlay)

      if (autoPlay) audio.play().catch(() => {})

      return () => {
        audio.removeEventListener('timeupdate', handleTimeUpdate)
        audio.removeEventListener('ended', handleEnded)
        audio.removeEventListener('canplay', handleCanPlay)
        audio.pause()
      }
    }, [song?.url, isYouTube]) // Safe access

    useEffect(() => {
      if (audioRef.current && !isYouTube) {
        audioRef.current.volume = volume
      }
    }, [volume, isYouTube])

    // ── YouTube IFrame API ───────────────────────────────────────────────────
    useEffect(() => {
      if (!isYouTube || !song) return

      const initYT = () => {
        const YT = (window as WindowWithYT).YT
        if (!YT) return

        const containerId = `yt-container-${song.id.replace(/[^a-zA-Z0-9]/g, '')}`
        const el = document.getElementById(containerId)
        if (!el) return

        ytPlayerRef.current = new YT.Player(containerId, {
          videoId: song.url,
          playerVars: {
            autoplay: autoPlay ? 1 : 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            origin: window.location.origin, // CRITICAL FIX for playback
            enablejsapi: 1,
          },
          events: {
            onReady: (e: YTEvent) => {
              setYtReady(true)
              e.target.setVolume(Math.round(volumeRef.current * 100))
              onReady?.()
              if (autoPlay) e.target.playVideo()
              
              clearInterval(timeIntervalRef.current)
              timeIntervalRef.current = window.setInterval(() => {
                try {
                  const time = e.target.getCurrentTime()
                  if (time) onTimeUpdate?.(time)
                } catch(e) {}
              }, 500)
            },
            onStateChange: (e: YTStateChangeEvent) => {
              if (e.data === YT_ENDED) onEnded?.()
            },
          },
        })
      }

      if (!(window as WindowWithYT).YT) {
        const tag = document.createElement('script')
        tag.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(tag)
        ;(window as WindowWithYT).onYouTubeIframeAPIReady = initYT
      } else {
        initYT()
      }

      return () => {
        clearInterval(timeIntervalRef.current)
        ytPlayerRef.current?.destroy?.()
        ytPlayerRef.current = null
        setYtReady(false)
      }
    }, [song?.url, isYouTube])

    useEffect(() => {
      if (isYouTube && ytReady && ytPlayerRef.current) {
        try { ytPlayerRef.current.setVolume(Math.round(volume * 100)) } catch {}
      }
    }, [volume, isYouTube, ytReady])

    // ── Controls ─────────────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      play: async () => {
        if (isYouTube && ytReady) ytPlayerRef.current?.playVideo()
        else if (audioRef.current) await audioRef.current.play().catch(() => {})
      },
      pause: () => {
        if (isYouTube && ytReady) ytPlayerRef.current?.pauseVideo()
        else audioRef.current?.pause()
      },
      seekTo: (seconds: number) => {
        if (isYouTube && ytReady) ytPlayerRef.current?.seekTo(seconds, true)
        else if (audioRef.current) audioRef.current.currentTime = seconds
      },
      getCurrentTime: () => {
        if (isYouTube && ytReady) return ytPlayerRef.current?.getCurrentTime() || 0
        return audioRef.current?.currentTime || 0
      },
      setVolume: (vol: number) => {
        if (isYouTube && ytReady) ytPlayerRef.current?.setVolume(Math.round(vol * 100))
        else if (audioRef.current) audioRef.current.volume = vol
      },
    }), [isYouTube, ytReady])

    if (!song) return null

    if (isYouTube) {
      const containerId = `yt-container-${song.id.replace(/[^a-zA-Z0-9]/g, '')}`
      return (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-s-deep">
          <div id={containerId} className="w-full h-full" />
          {!ytReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-s-deep">
              <div className="w-8 h-8 border-2 border-s-violet border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      )
    }

    return (
      <audio
        ref={audioRef}
        src={song.url}
        crossOrigin="anonymous"
        preload="auto"
        className="hidden"
      />
    )
  }
)

PlayerEmbed.displayName = 'PlayerEmbed'

interface YTPlayer {
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  getCurrentTime: () => number
  setVolume: (vol: number) => void
  destroy: () => void
}
interface YTEvent { target: YTPlayer }
interface YTStateChangeEvent { data: number }
interface WindowWithYT extends Window {
  YT?: { Player: new (id: string, config: object) => YTPlayer }
  onYouTubeIframeAPIReady?: () => void
}