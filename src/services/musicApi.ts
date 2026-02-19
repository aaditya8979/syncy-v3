import type { SearchResult, MusicSource } from '@/types'

const JAMENDO_CLIENT_ID = import.meta.env.VITE_JAMENDO_CLIENT_ID || 'b6747d04'
const JAMENDO_BASE = 'https://api.jamendo.com/v3.0'

// ─── JioSaavn (PRIMARY) ──────────────────────────────────────────────────────

// Reverted to single, stable API for speed
const JIOSAAVN_API = 'https://jiosaavn-api-privatecvc2.vercel.app'

export const searchJioSaavn = async (query: string): Promise<SearchResult[]> => {
  try {
    const url = `${JIOSAAVN_API}/search/songs?query=${encodeURIComponent(query)}&page=1&limit=15`
    // Reduced timeout for snappier fallback if it fails
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) throw new Error('JioSaavn fetch failed')
    const data = await res.json()

    // Handle various response structures
    const songs: JioSaavnSong[] =
      data?.data?.results || data?.results || data?.songs?.results || []

    const mapped = songs
      .map((s) => ({
        id: `jio-${s.id}`,
        title: cleanHtml(s.name || s.title || ''),
        artist: cleanHtml(
          s.primaryArtists ||
          s.primary_artists ||
          s.artists?.primary?.map((a: { name: string }) => a.name).join(', ') ||
          'Unknown'
        ),
        url: getBestQualityUrl(s.downloadUrl || s.download_url),
        coverUrl: getBestImage(s.image),
        duration: parseInt(String(s.duration || '0'), 10),
        source: 'jiosaavn' as MusicSource,
      }))
      .filter((s) => s.url && s.title)

    return mapped
  } catch (err) {
    console.error('JioSaavn search error:', err)
    return []
  }
}

interface JioSaavnSong {
  id: string
  name?: string
  title?: string
  primaryArtists?: string
  primary_artists?: string
  artists?: { primary?: Array<{ name: string }> }
  downloadUrl?: Array<QualityUrl>
  download_url?: Array<QualityUrl>
  image?: Array<{ link?: string; url?: string; quality?: string }>
  duration?: string | number
}

interface QualityUrl {
  link?: string
  url?: string
  quality?: string
}

const getBestQualityUrl = (urls?: Array<QualityUrl>): string => {
  if (!urls?.length) return ''
  for (const quality of ['320kbps', '160kbps', '96kbps', '48kbps']) {
    const match = urls.find((u) => u.quality === quality)
    if (match?.link) return match.link
    if ((match as { url?: string })?.url) return (match as { url: string }).url
  }
  const last = urls[urls.length - 1]
  return last?.link || (last as { url?: string })?.url || ''
}

const getBestImage = (imgs?: Array<{ link?: string; url?: string; quality?: string }>): string => {
  if (!imgs?.length) return ''
  const large = imgs.find((i) => i.quality === '500x500' || i.quality === 'high')
  if (large) return large.link || large.url || ''
  return imgs[imgs.length - 1]?.link || imgs[imgs.length - 1]?.url || ''
}

const cleanHtml = (str: string): string =>
  str.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").trim()

// ─── Jamendo ─────────────────────────────────────────────────────────────────

export const searchJamendo = async (query: string): Promise<SearchResult[]> => {
  try {
    const params = new URLSearchParams({
      client_id: JAMENDO_CLIENT_ID,
      format: 'json',
      limit: '12',
      audioformat: 'mp31',
      namesearch: query,
    })
    const res = await fetch(`${JAMENDO_BASE}/tracks/?${params}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error('Jamendo failed')
    const data = await res.json()
    let results = (data.results || []).map(mapJamendoTrack)
    if (results.length > 0) return results

    // Fallback: tag search
    const tagParams = new URLSearchParams({
      client_id: JAMENDO_CLIENT_ID,
      format: 'json',
      limit: '12',
      audioformat: 'mp31',
      tags: query.toLowerCase(),
    })
    const tagRes = await fetch(`${JAMENDO_BASE}/tracks/?${tagParams}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!tagRes.ok) return []
    const tagData = await tagRes.json()
    results = (tagData.results || []).map(mapJamendoTrack)
    return results
  } catch (err) {
    console.error('Jamendo search error:', err)
    return []
  }
}

interface JamendoTrack {
  id: string
  name: string
  artist_name: string
  audio: string
  audiodownload: string
  album_image: string
  image: string
  duration: number
}

const mapJamendoTrack = (t: JamendoTrack): SearchResult => ({
  id: `jamendo-${t.id}`,
  title: t.name,
  artist: t.artist_name,
  url: t.audio || t.audiodownload,
  coverUrl: t.album_image || t.image,
  duration: t.duration,
  source: 'jamendo',
})

// ─── YouTube (multiple Invidious fallbacks) ───────────────────────────────────

const INVIDIOUS_INSTANCES = [
  'https://invidious.privacyredirect.com',
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://vid.puffyan.us',
]

export const searchYouTube = async (query: string): Promise<SearchResult[]> => {
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const url = `${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video`
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) continue
      const data: InvidiousResult[] = await res.json()
      if (!Array.isArray(data) || !data.length) continue

      return data.slice(0, 10).map((v) => ({
        id: `yt-${v.videoId}`,
        title: v.title,
        artist: v.author,
        url: v.videoId,
        coverUrl: `https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`,
        duration: v.lengthSeconds,
        source: 'youtube' as MusicSource,
      }))
    } catch {
      continue
    }
  }
  return []
}

interface InvidiousResult {
  videoId: string
  title: string
  author: string
  lengthSeconds: number
  videoThumbnails: Array<{ url: string; quality: string }>
}

// ─── Unified ─────────────────────────────────────────────────────────────────

export const searchMusic = async (query: string, source: MusicSource): Promise<SearchResult[]> => {
  switch (source) {
    case 'jiosaavn': return searchJioSaavn(query)
    case 'jamendo': return searchJamendo(query)
    case 'youtube': return searchYouTube(query)
    default: return []
  }
}