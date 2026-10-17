-- ==============================================================================
-- AURA Music Platform — Production Supabase / PostgreSQL Schema Migration
-- Migration: 20261017000001_initial_schema.sql
-- ==============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. USERS & PROFILES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  accent_color TEXT DEFAULT '#00f2fe' NOT NULL,
  theme TEXT DEFAULT 'dark' NOT NULL,
  visualizer_mode TEXT DEFAULT 'bars' NOT NULL,
  visualizer_intensity REAL DEFAULT 1.0 NOT NULL,
  reduced_motion BOOLEAN DEFAULT false NOT NULL,
  default_volume REAL DEFAULT 0.8 NOT NULL,
  eq_bands JSONB DEFAULT '[0,0,0,0,0,0,0,0,0,0]'::jsonb NOT NULL,
  bass_boost REAL DEFAULT 0.0 NOT NULL,
  treble REAL DEFAULT 0.0 NOT NULL,
  stereo_pan REAL DEFAULT 0.0 NOT NULL,
  reverb_level REAL DEFAULT 0.0 NOT NULL,
  eq_preset TEXT DEFAULT 'Flat Studio' NOT NULL,
  eq_bypassed BOOLEAN DEFAULT false NOT NULL,
  streaming_quality TEXT DEFAULT 'auto' NOT NULL,
  lossless_tier TEXT DEFAULT 'HI_RES_LOSSLESS' NOT NULL,
  bit_perfect_mode BOOLEAN DEFAULT false NOT NULL,
  spatial_audio_enabled BOOLEAN DEFAULT false NOT NULL,
  crossfade_duration REAL DEFAULT 0.0 NOT NULL,
  smart_transitions BOOLEAN DEFAULT false NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 2. TRACKS & AUDIO ENGINE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.tracks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT NOT NULL,
  duration INTEGER NOT NULL, -- seconds
  genre TEXT NOT NULL,
  year INTEGER,
  bpm INTEGER,
  mood TEXT,
  energy REAL,
  musical_key TEXT,
  intro_duration REAL,
  outro_duration REAL,
  accent_color TEXT DEFAULT '#00f2fe' NOT NULL,
  artwork_url TEXT NOT NULL,
  audio_file_url TEXT NOT NULL,
  lyrics_lrc TEXT,
  plain_lyrics TEXT,
  play_count INTEGER DEFAULT 0 NOT NULL,
  -- Spatial / Immersive Audio Metadata
  channel_count INTEGER DEFAULT 2,
  sample_rate INTEGER DEFAULT 44100,
  bit_depth INTEGER DEFAULT 16,
  spatial_capable BOOLEAN DEFAULT false NOT NULL,
  -- Lossless Audio System Metadata
  codec TEXT DEFAULT 'MP3',
  container TEXT DEFAULT 'MPEG',
  bitrate INTEGER,
  file_size BIGINT,
  source_type TEXT DEFAULT 'USER_UPLOAD',
  quality_tier TEXT DEFAULT 'STANDARD',
  is_lossless BOOLEAN DEFAULT false NOT NULL,
  is_genuine_lossless BOOLEAN DEFAULT false NOT NULL,
  validation_report JSONB,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.audio_variants (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  track_id TEXT NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  quality_tier TEXT NOT NULL, -- STANDARD | HIGH | LOSSLESS | HI_RES_LOSSLESS
  codec TEXT NOT NULL,        -- FLAC | ALAC | WAV | AIFF | AAC | MP3 | OPUS
  container TEXT,
  bitrate INTEGER,
  sample_rate INTEGER,
  bit_depth INTEGER,
  channels INTEGER DEFAULT 2,
  file_size BIGINT,
  file_url TEXT NOT NULL,
  storage_object_id TEXT,
  is_lossless BOOLEAN DEFAULT false NOT NULL,
  is_genuine_lossless BOOLEAN DEFAULT false NOT NULL,
  validation_notes TEXT,
  mime_type TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.audio_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id TEXT UNIQUE NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  bpm REAL,
  bpm_confidence REAL,
  danceability REAL,
  musical_key TEXT,
  key_confidence REAL,
  camelot_key TEXT,
  scale TEXT,
  integrated_loudness REAL, -- LUFS
  loudness_range REAL,      -- LU
  true_peak REAL,           -- dBFS
  dynamic_range REAL,       -- dB
  energy REAL,
  valence REAL,
  acousticness REAL,
  instrumentalness REAL,
  speech_ratio REAL,
  spectral_centroid REAL,
  spectral_rolloff REAL,
  spectral_flatness REAL,
  spectral_spread REAL,
  spectral_features JSONB,
  primary_mood TEXT,
  secondary_mood TEXT,
  detected_genre TEXT,
  genre_confidence REAL,
  fingerprint TEXT,
  duration_ms INTEGER,
  analyzed_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  is_complete BOOLEAN DEFAULT false NOT NULL
);

-- ==============================================================================
-- 3. PLAYLISTS & SOCIAL CURATION
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.playlists (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  is_public BOOLEAN DEFAULT false NOT NULL,
  is_ai_generated BOOLEAN DEFAULT false NOT NULL,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.playlist_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id TEXT NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  added_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT uq_playlist_track UNIQUE (playlist_id, track_id)
);

CREATE TABLE IF NOT EXISTS public.playlist_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id TEXT NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'VIEWER' NOT NULL, -- OWNER | EDITOR | VIEWER
  invited_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  accepted_at TIMESTAMPTZ,
  CONSTRAINT uq_playlist_collaborator UNIQUE (playlist_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.playlist_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id TEXT NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_liked_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT uq_user_liked_track UNIQUE (user_id, track_id)
);

-- ==============================================================================
-- 4. LISTENING HISTORY & TELEMETRY
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.listening_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id TEXT,
  started_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  ended_at TIMESTAMPTZ,
  total_tracks INTEGER DEFAULT 0 NOT NULL,
  total_seconds INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS public.listening_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.listening_sessions(id) ON DELETE SET NULL,
  device_id TEXT,
  duration_listened INTEGER NOT NULL, -- seconds
  completed BOOLEAN DEFAULT false NOT NULL,
  skipped BOOLEAN DEFAULT false NOT NULL,
  skip_position_sec REAL,
  quality_tier TEXT DEFAULT 'STANDARD',
  timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 5. DEVICES & CROSS-DEVICE PLAYBACK
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.devices (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL, -- web | ios | android | desktop
  browser TEXT,
  user_agent TEXT,
  last_seen_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.playback_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id TEXT REFERENCES public.devices(id) ON DELETE SET NULL,
  current_track_id TEXT REFERENCES public.tracks(id) ON DELETE SET NULL,
  position_sec REAL DEFAULT 0.0 NOT NULL,
  is_playing BOOLEAN DEFAULT false NOT NULL,
  volume REAL DEFAULT 0.8 NOT NULL,
  queue_json JSONB DEFAULT '[]'::jsonb NOT NULL,
  playback_mode TEXT DEFAULT 'normal' NOT NULL,
  lossless_tier TEXT DEFAULT 'HI_RES_LOSSLESS',
  bit_perfect_mode BOOLEAN DEFAULT false NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
  progress REAL DEFAULT 0.0 NOT NULL,
  quality_tier TEXT DEFAULT 'standard' NOT NULL,
  local_path TEXT,
  file_size BIGINT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT uq_user_download UNIQUE (user_id, track_id)
);

-- ==============================================================================
-- 6. PRESETS & AI CURATION
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.eq_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false NOT NULL,
  bands JSONB NOT NULL,
  bass_boost REAL DEFAULT 0.0 NOT NULL,
  treble REAL DEFAULT 0.0 NOT NULL,
  stereo_pan REAL DEFAULT 0.0 NOT NULL,
  reverb_level REAL DEFAULT 0.0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.visualizer_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mode TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false NOT NULL,
  config JSONB,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ai_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL, -- dj | playlist_gen | curate
  context_json JSONB,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.ai_sessions(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  response_json JSONB,
  provider TEXT DEFAULT 'gemini' NOT NULL,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  score REAL DEFAULT 0.0 NOT NULL,
  reason TEXT,
  mix_type TEXT DEFAULT 'discover' NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS public.daily_mixes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mix_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  track_ids_json JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

-- ==============================================================================
-- 7. SOCIAL LISTENING ROOMS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.rooms (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_track_id TEXT REFERENCES public.tracks(id) ON DELETE SET NULL,
  current_time REAL DEFAULT 0.0 NOT NULL,
  is_playing BOOLEAN DEFAULT false NOT NULL,
  is_private BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.room_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 8. INDEXES FOR HIGH-THROUGHPUT RETRIEVAL
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_tracks_genre ON public.tracks(genre);
CREATE INDEX IF NOT EXISTS idx_tracks_mood ON public.tracks(mood);
CREATE INDEX IF NOT EXISTS idx_tracks_bpm ON public.tracks(bpm);
CREATE INDEX IF NOT EXISTS idx_playlists_owner ON public.playlists(owner_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON public.playlist_tracks(playlist_id);
CREATE INDEX IF NOT EXISTS idx_user_likes_user ON public.user_liked_tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_listening_history_user ON public.listening_history(user_id);
CREATE INDEX IF NOT EXISTS idx_listening_history_track ON public.listening_history(track_id);
CREATE INDEX IF NOT EXISTS idx_audio_variants_track ON public.audio_variants(track_id);
CREATE INDEX IF NOT EXISTS idx_room_messages_room ON public.room_messages(room_id);

-- ==============================================================================
-- 9. AUTH USER SYNC TRIGGER (Public Profile & Preferences Auto-Creation)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = timezone('utc'::text, now());

  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger firing on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
