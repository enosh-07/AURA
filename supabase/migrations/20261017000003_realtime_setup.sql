-- ==============================================================================
-- AURA Music Platform — Supabase Realtime Publication Setup
-- Migration: 20261017000003_realtime_setup.sql
-- ==============================================================================

-- Enable Realtime publication for social listening rooms, chat, and playback sync
BEGIN;
  -- Ensure publication exists
  CREATE PUBLICATION supabase_realtime;
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- Publication already exists
END;

-- Add relevant tables to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.playback_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.playlist_tracks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.playlist_activities;
