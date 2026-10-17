-- ============================================================
-- AURA PRODUCTION POSTGRESQL & SUPABASE MIGRATION
-- Point 3: Persistent Database, User Isolation, and Row Level Security (RLS)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS & PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. USER PREFERENCES TABLE
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  accent_color TEXT NOT NULL DEFAULT '#00f2fe',
  theme TEXT NOT NULL DEFAULT 'dark',
  visualizer_mode TEXT NOT NULL DEFAULT 'bars',
  visualizer_intensity FLOAT NOT NULL DEFAULT 1.0,
  reduced_motion BOOLEAN NOT NULL DEFAULT FALSE,
  default_volume FLOAT NOT NULL DEFAULT 0.8,
  eq_bands TEXT NOT NULL DEFAULT '[0,0,0,0,0,0,0,0,0,0]',
  bass_boost FLOAT NOT NULL DEFAULT 0,
  treble FLOAT NOT NULL DEFAULT 0,
  stereo_pan FLOAT NOT NULL DEFAULT 0,
  reverb_level FLOAT NOT NULL DEFAULT 0,
  eq_preset TEXT NOT NULL DEFAULT 'Flat Studio',
  eq_bypassed BOOLEAN NOT NULL DEFAULT FALSE,
  streaming_quality TEXT NOT NULL DEFAULT 'auto',
  lossless_tier TEXT NOT NULL DEFAULT 'HI_RES_LOSSLESS',
  bit_perfect_mode BOOLEAN NOT NULL DEFAULT FALSE,
  spatial_audio_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  crossfade_duration FLOAT NOT NULL DEFAULT 0,
  smart_transitions BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TRACKS TABLE (Stable Provider Tracks & Metadata Preservation)
CREATE TABLE IF NOT EXISTS public.tracks (
  id TEXT PRIMARY KEY, -- Supports stable provider IDs (e.g. saavn_..., itunes_..., audius_...)
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT NOT NULL DEFAULT 'Single',
  duration INTEGER NOT NULL DEFAULT 180,
  genre TEXT NOT NULL DEFAULT 'Soundtrack',
  year INTEGER,
  bpm INTEGER,
  accent_color TEXT NOT NULL DEFAULT '#00f2fe',
  artwork_url TEXT NOT NULL,
  audio_file_url TEXT NOT NULL,
  lyrics_lrc TEXT,
  plain_lyrics TEXT,
  play_count INTEGER NOT NULL DEFAULT 0,
  channel_count INTEGER DEFAULT 2,
  sample_rate INTEGER DEFAULT 44100,
  bit_depth INTEGER DEFAULT 16,
  spatial_capable BOOLEAN NOT NULL DEFAULT FALSE,
  codec TEXT DEFAULT 'AAC',
  container TEXT DEFAULT 'M4A',
  bitrate INTEGER DEFAULT 320,
  file_size INTEGER,
  source_type TEXT DEFAULT 'ONLINE_CATALOG',
  quality_tier TEXT DEFAULT 'HIGH',
  is_lossless BOOLEAN NOT NULL DEFAULT FALSE,
  is_genuine_lossless BOOLEAN NOT NULL DEFAULT FALSE,
  validation_report TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. USER LIKED TRACKS TABLE (Prevents duplicates via unique constraint)
CREATE TABLE IF NOT EXISTS public.user_liked_tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_track_like UNIQUE (user_id, track_id)
);

-- 5. PLAYLISTS TABLE
CREATE TABLE IF NOT EXISTS public.playlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  is_ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. PLAYLIST TRACKS TABLE (Maintains exact order via position and prevents duplicates)
CREATE TABLE IF NOT EXISTS public.playlist_tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  added_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_playlist_track UNIQUE (playlist_id, track_id)
);

-- 7. LISTENING HISTORY / RECENTLY PLAYED TABLE
CREATE TABLE IF NOT EXISTS public.listening_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  duration_listened INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  skipped BOOLEAN NOT NULL DEFAULT FALSE,
  skip_position_sec FLOAT,
  quality_tier TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. PLAYBACK SESSIONS & SAVED QUEUE TABLE
CREATE TABLE IF NOT EXISTS public.playback_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id TEXT,
  current_track_id TEXT REFERENCES public.tracks(id) ON DELETE SET NULL,
  position_sec FLOAT NOT NULL DEFAULT 0,
  is_playing BOOLEAN NOT NULL DEFAULT FALSE,
  volume FLOAT NOT NULL DEFAULT 0.8,
  queue_json TEXT, -- JSON array of track IDs
  playback_mode TEXT NOT NULL DEFAULT 'normal',
  lossless_tier TEXT DEFAULT 'HI_RES_LOSSLESS',
  bit_perfect_mode BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES FOR PRODUCTION QUERY PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_liked_tracks_user ON public.user_liked_tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_liked_tracks_created ON public.user_liked_tracks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_playlists_owner ON public.playlists(owner_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_pos ON public.playlist_tracks(playlist_id, position ASC);
CREATE INDEX IF NOT EXISTS idx_listening_history_user ON public.listening_history(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_playback_sessions_user ON public.playback_sessions(user_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_liked_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listening_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playback_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can view and update their own profile; others can view public profile info
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Preferences: Private to the authenticated user
CREATE POLICY "Users can view own preferences" ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preferences" ON public.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON public.user_preferences FOR UPDATE USING (auth.uid() = user_id);

-- Liked Tracks: Isolated to user
CREATE POLICY "Users can select own likes" ON public.user_liked_tracks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own likes" ON public.user_liked_tracks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own likes" ON public.user_liked_tracks FOR DELETE USING (auth.uid() = user_id);

-- Playlists: Owner has full access; others can only view if is_public = true
CREATE POLICY "Users can view own or public playlists" ON public.playlists FOR SELECT USING (auth.uid() = owner_id OR is_public = TRUE);
CREATE POLICY "Users can insert own playlists" ON public.playlists FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own playlists" ON public.playlists FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own playlists" ON public.playlists FOR DELETE USING (auth.uid() = owner_id);

-- Playlist Tracks: Access inherits from playlist ownership or public status
CREATE POLICY "View tracks of accessible playlists" ON public.playlist_tracks FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.playlists WHERE id = playlist_id AND (owner_id = auth.uid() OR is_public = TRUE))
);
CREATE POLICY "Manage tracks in own playlists" ON public.playlist_tracks FOR ALL USING (
  EXISTS (SELECT 1 FROM public.playlists WHERE id = playlist_id AND owner_id = auth.uid())
);

-- Listening History: Strictly private to user
CREATE POLICY "Users can view own listening history" ON public.listening_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own listening history" ON public.listening_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Playback Sessions: Strictly private to user
CREATE POLICY "Users can manage own playback session" ON public.playback_sessions FOR ALL USING (auth.uid() = user_id);

-- Tracks: Readable by all authenticated and anonymous clients
CREATE POLICY "Tracks are publicly readable" ON public.tracks FOR SELECT USING (TRUE);
