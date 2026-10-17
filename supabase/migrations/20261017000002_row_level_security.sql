-- ==============================================================================
-- AURA Music Platform — Row Level Security (RLS) Migration
-- Migration: 20261017000002_row_level_security.sql
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_liked_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listening_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listening_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playback_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eq_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visualizer_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_mixes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 1. PROFILES & USER PREFERENCES
-- ==============================================================================

-- Profiles: Anyone can view basic profiles (name, avatar) for social listening and playlist credits
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

-- Profiles: Users can update only their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Preferences: Strictly private to the user
CREATE POLICY "Users can view own preferences"
  ON public.user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- ==============================================================================
-- 2. TRACKS & AUDIO CONTENT
-- ==============================================================================

-- Tracks are publicly discoverable and streamable
CREATE POLICY "Tracks are viewable by everyone"
  ON public.tracks FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can upload tracks"
  ON public.tracks FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Track uploaders can update their own tracks"
  ON public.tracks FOR UPDATE
  USING (auth.uid() = uploaded_by);

-- Audio variants and DSP profiles
CREATE POLICY "Audio variants viewable by everyone"
  ON public.audio_variants FOR SELECT
  USING (true);

CREATE POLICY "Audio profiles viewable by everyone"
  ON public.audio_profiles FOR SELECT
  USING (true);

-- ==============================================================================
-- 3. PLAYLISTS & COLLABORATION
-- ==============================================================================

-- Playlists: Public OR owned by user OR shared with user as collaborator
CREATE POLICY "Playlists viewable if public or owned or member"
  ON public.playlists FOR SELECT
  USING (
    is_public = true
    OR auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.playlist_collaborators
      WHERE playlist_id = public.playlists.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create playlists"
  ON public.playlists FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners and editors can update playlists"
  ON public.playlists FOR UPDATE
  USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.playlist_collaborators
      WHERE playlist_id = public.playlists.id
        AND user_id = auth.uid()
        AND role IN ('OWNER', 'EDITOR')
    )
  );

CREATE POLICY "Only owners can delete playlists"
  ON public.playlists FOR DELETE
  USING (auth.uid() = owner_id);

-- Playlist Tracks
CREATE POLICY "Playlist tracks viewable if parent playlist viewable"
  ON public.playlist_tracks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.playlists p
      WHERE p.id = public.playlist_tracks.playlist_id
        AND (
          p.is_public = true
          OR p.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.playlist_collaborators c
            WHERE c.playlist_id = p.id AND c.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "Owners and editors can insert tracks to playlist"
  ON public.playlist_tracks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.playlists p
      WHERE p.id = public.playlist_tracks.playlist_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.playlist_collaborators c
            WHERE c.playlist_id = p.id
              AND c.user_id = auth.uid()
              AND c.role IN ('OWNER', 'EDITOR')
          )
        )
    )
  );

CREATE POLICY "Owners and editors can remove tracks from playlist"
  ON public.playlist_tracks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.playlists p
      WHERE p.id = public.playlist_tracks.playlist_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.playlist_collaborators c
            WHERE c.playlist_id = p.id
              AND c.user_id = auth.uid()
              AND c.role IN ('OWNER', 'EDITOR')
          )
        )
    )
  );

-- Playlist Collaborators
CREATE POLICY "Collaborators viewable if playlist viewable"
  ON public.playlist_collaborators FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.playlists p
      WHERE p.id = public.playlist_collaborators.playlist_id
        AND (p.is_public = true OR p.owner_id = auth.uid() OR user_id = auth.uid())
    )
  );

-- ==============================================================================
-- 4. USER LIKED TRACKS & LISTENING HISTORY
-- ==============================================================================

CREATE POLICY "Users can view own liked tracks"
  ON public.user_liked_tracks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add own liked tracks"
  ON public.user_liked_tracks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own liked tracks"
  ON public.user_liked_tracks FOR DELETE
  USING (auth.uid() = user_id);

-- Listening History & Sessions
CREATE POLICY "Users can view own listening history"
  ON public.listening_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own listening history"
  ON public.listening_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own listening sessions"
  ON public.listening_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own listening sessions"
  ON public.listening_sessions FOR ALL
  USING (auth.uid() = user_id);

-- ==============================================================================
-- 5. DEVICES & PLAYBACK STATE
-- ==============================================================================

CREATE POLICY "Users can manage own devices"
  ON public.devices FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own playback sessions"
  ON public.playback_sessions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own downloads"
  ON public.downloads FOR ALL
  USING (auth.uid() = user_id);

-- ==============================================================================
-- 6. PRESETS & AI CURATION
-- ==============================================================================

-- Presets: System presets are readable by everyone; user presets are private
CREATE POLICY "EQ presets viewable if system or owned"
  ON public.eq_presets FOR SELECT
  USING (is_system = true OR auth.uid() = user_id);

CREATE POLICY "Users can manage own EQ presets"
  ON public.eq_presets FOR ALL
  USING (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Visualizer presets viewable if system or owned"
  ON public.visualizer_presets FOR SELECT
  USING (is_system = true OR auth.uid() = user_id);

CREATE POLICY "Users can manage own visualizer presets"
  ON public.visualizer_presets FOR ALL
  USING (auth.uid() = user_id AND is_system = false);

-- AI Sessions & Requests
CREATE POLICY "Users can manage own AI sessions"
  ON public.ai_sessions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own AI requests"
  ON public.ai_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_sessions s
      WHERE s.id = public.ai_requests.session_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own recommendations"
  ON public.recommendations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own daily mixes"
  ON public.daily_mixes FOR SELECT
  USING (auth.uid() = user_id);

-- ==============================================================================
-- 7. SOCIAL LISTENING ROOMS
-- ==============================================================================

CREATE POLICY "Public rooms viewable by all, private only by host"
  ON public.rooms FOR SELECT
  USING (is_private = false OR auth.uid() = host_id);

CREATE POLICY "Authenticated users can create rooms"
  ON public.rooms FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Hosts can update their own room"
  ON public.rooms FOR UPDATE
  USING (auth.uid() = host_id);

CREATE POLICY "Hosts can delete their own room"
  ON public.rooms FOR DELETE
  USING (auth.uid() = host_id);

-- Room Messages
CREATE POLICY "Room messages viewable if room is viewable"
  ON public.room_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rooms r
      WHERE r.id = public.room_messages.room_id
        AND (r.is_private = false OR r.host_id = auth.uid())
    )
  );

CREATE POLICY "Authenticated users can post messages in accessible rooms"
  ON public.room_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.rooms r
      WHERE r.id = public.room_messages.room_id
        AND (r.is_private = false OR r.host_id = auth.uid())
    )
  );
