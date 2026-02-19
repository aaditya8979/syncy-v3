-- ═══════════════════════════════════════════════════════════════════════════
-- Syncy v3 — Complete Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Rooms ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rooms (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  host_id      UUID NOT NULL,
  current_song JSONB,
  queue        JSONB NOT NULL DEFAULT '[]'::jsonb,
  status       TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('playing','paused','idle')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Polls ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.polls (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id    UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  options    JSONB NOT NULL DEFAULT '[]'::jsonb,
  votes      JSONB NOT NULL DEFAULT '{}'::jsonb,
  active     BOOLEAN NOT NULL DEFAULT true,
  ends_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON public.rooms(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_polls_room_id    ON public.polls(room_id);
CREATE INDEX IF NOT EXISTS idx_polls_active     ON public.polls(active) WHERE active = true;

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

-- Rooms: authenticated users can read all rooms
CREATE POLICY "rooms_select" ON public.rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "rooms_select_anon" ON public.rooms FOR SELECT TO anon USING (true);

-- Rooms: anyone authenticated can insert
CREATE POLICY "rooms_insert" ON public.rooms FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = host_id);
CREATE POLICY "rooms_insert_anon" ON public.rooms FOR INSERT TO anon
  WITH CHECK (true);

-- Rooms: update allowed for authenticated (host controls)
CREATE POLICY "rooms_update" ON public.rooms FOR UPDATE TO authenticated USING (true);
CREATE POLICY "rooms_update_anon" ON public.rooms FOR UPDATE TO anon USING (true);

-- Polls: all can read
CREATE POLICY "polls_select" ON public.polls FOR SELECT TO authenticated USING (true);
CREATE POLICY "polls_select_anon" ON public.polls FOR SELECT TO anon USING (true);

-- Polls: authenticated can insert/update
CREATE POLICY "polls_insert" ON public.polls FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "polls_insert_anon" ON public.polls FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "polls_update" ON public.polls FOR UPDATE TO authenticated USING (true);
CREATE POLICY "polls_update_anon" ON public.polls FOR UPDATE TO anon USING (true);

-- ── Enable Supabase Realtime ──────────────────────────────────────────────────
-- This is CRITICAL. Without this, DB changes won't broadcast to clients.
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;

-- ── Optional: cleanup old data (rooms older than 7 days) ────────────────────
-- You can run this manually or set up a pg_cron job
-- DELETE FROM public.rooms WHERE created_at < now() - interval '7 days';
