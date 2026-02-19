-- ============================================================
-- Syncy Database Schema
-- Run in Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Tables ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rooms (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  host_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_song JSONB DEFAULT NULL,
  queue       JSONB DEFAULT '[]'::JSONB,
  status      TEXT DEFAULT 'idle' CHECK (status IN ('playing', 'paused', 'idle')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.polls (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id     UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  options     JSONB DEFAULT '[]'::JSONB,   -- array of Song objects
  votes       JSONB DEFAULT '{}'::JSONB,   -- {user_id: song_id}
  active      BOOLEAN DEFAULT TRUE,
  ends_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.room_members (
  room_id     UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT,
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

-- ─── Indexes ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS rooms_host_id_idx ON public.rooms(host_id);
CREATE INDEX IF NOT EXISTS polls_room_id_idx ON public.polls(room_id);
CREATE INDEX IF NOT EXISTS room_members_room_id_idx ON public.room_members(room_id);
CREATE INDEX IF NOT EXISTS room_members_user_id_idx ON public.room_members(user_id);

-- ─── RLS Policies ────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;

-- Rooms: anyone can read (public rooms), only host can update/delete
CREATE POLICY "rooms_select" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "rooms_insert" ON public.rooms FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "rooms_update" ON public.rooms FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "rooms_delete" ON public.rooms FOR DELETE USING (auth.uid() = host_id);

-- Polls: anyone in room can read/insert votes, host creates polls
CREATE POLICY "polls_select" ON public.polls FOR SELECT USING (true);
CREATE POLICY "polls_insert" ON public.polls FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.rooms WHERE id = room_id AND host_id = auth.uid())
);
CREATE POLICY "polls_update" ON public.polls FOR UPDATE USING (true);

-- Room members: anyone can read/write own membership
CREATE POLICY "members_select" ON public.room_members FOR SELECT USING (true);
CREATE POLICY "members_insert" ON public.room_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "members_delete" ON public.room_members FOR DELETE USING (auth.uid() = user_id);

-- ─── Realtime ────────────────────────────────────────────────
-- Enable Realtime on rooms and polls tables (run in Supabase dashboard):
-- Realtime > Tables > rooms ✓
-- Realtime > Tables > polls ✓
-- Realtime > Tables > room_members ✓

-- Or via SQL:
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_members;
