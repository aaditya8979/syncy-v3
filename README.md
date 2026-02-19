# 🎵 Syncy — Real-time Synchronized Music Rooms

Listen to music together, perfectly in sync across all devices.

![Syncy Screenshot](https://via.placeholder.com/800x400/0a0a0f/7c6aff?text=Syncy+%E2%80%94+Listen+Together)

## Features

- 🔄 **Real-time sync** — <50ms drift correction via Socket.io
- 🎵 **Free music sources** — Jamendo (CC licensed), YouTube embeds, JioSaavn
- 🗳️ **Live polls** — Vote on the next song, winner auto-plays
- 📋 **Drag-drop queue** — Reorder songs on the fly (host only)
- 👥 **Live member list** — See who's listening in real-time
- 🔗 **Shareable links** — One-click room sharing
- 📱 **Mobile-responsive** — Works on any device
- 🌙 **Dark mode** — Easy on the eyes

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vite + React 18 + TypeScript + Tailwind CSS |
| State | TanStack Query (optimistic updates) |
| Realtime DB | Supabase (Postgres + Realtime) |
| Auth | Supabase Auth (anon + email) |
| Sync | Socket.io (hosted on Vercel/Railway) |
| Music | Jamendo API, YouTube IFrame API, JioSaavn |

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase/migrations/001_initial_schema.sql`
3. Go to **Project Settings > API** and copy your URL and anon key
4. Enable **Realtime** for `rooms`, `polls`, `room_members` tables

### 2. Jamendo API Key (Free)

1. Register at [developer.jamendo.com](https://developer.jamendo.com/v3.0)
2. Create an app and copy the `client_id`

### 3. Frontend Setup

```bash
# Clone and install
git clone https://github.com/your-username/syncy.git
cd syncy
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase URL, anon key, Jamendo client_id, and socket URL

# Start dev server
npm run dev
```

### 4. Socket Server Setup

```bash
cd server
npm install

# Set environment variables
export PORT=3001
export FRONTEND_URL=http://localhost:5173

# Development
npm run dev

# Production (Railway/Render/Fly.io recommended)
npm start
```

### 5. Deploy

**Frontend (Vercel):**
```bash
npm install -g vercel
vercel --prod
# Set env vars in Vercel dashboard
```

**Socket Server:**
Deploy `server/` to Railway, Render, or Fly.io. Copy the URL to `VITE_SOCKET_URL`.

**Supabase Edge Functions:**
```bash
npm install -g supabase
supabase login
supabase functions deploy api-proxy
```

## Environment Variables

```env
# Frontend (.env)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_JAMENDO_CLIENT_ID=your-jamendo-client-id
VITE_SOCKET_URL=https://your-socket-server.railway.app

# Socket Server
PORT=3001
FRONTEND_URL=https://your-syncy.vercel.app
```

## Testing the Sync

1. Create a room and add a Jamendo song
2. Open the room link in an incognito window
3. Press play on the host window — both should sync within 500ms
4. Seek to a different position — clients correct within 1 second

## Architecture

```
Browser A (Host)           Browser B (Listener)
    │                           │
    │─── play(position) ────→  Socket.io Server
    │                           │←── sync_position(pos, ts)
    │                           │
    │── UPDATE rooms ──→  Supabase Postgres
    │                     │
    │                     └──→ Realtime broadcast → Browser B
```

## Music Sources

| Source | Type | Requires Key? | Quality |
|--------|------|---------------|---------|
| Jamendo | CC-licensed MP3 | Yes (free) | High |
| YouTube | Embeds | No | High |
| JioSaavn | MP3 streams | No | Medium |

## License

MIT — see [LICENSE](LICENSE)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)
