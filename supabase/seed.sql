-- ==============================================================================
-- AURA Music Platform — Supabase Seed Data
-- File: supabase/seed.sql
-- ==============================================================================

-- 1. Insert Initial Sample Tracks
INSERT INTO public.tracks (
  id, title, artist, album, duration, genre, year, bpm, mood, accent_color,
  artwork_url, audio_file_url, lyrics_lrc, play_count, codec, quality_tier, is_lossless
) VALUES
(
  'track-1',
  'Neon Horizon',
  'CYBERPULSE',
  'Odyssey 2099',
  194,
  'Synthwave',
  2024,
  124,
  'Energy',
  '#00f2fe',
  'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&auto=format&fit=crop&q=80',
  'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=synthwave-80s-110045.mp3',
  '[00:00.00][Instrumental Intro - Analog Arpeggio]
[00:14.00]Midnight lights along the coastal grid
[00:22.00]Chasing shadows where the skyline hid
[00:30.00]Electric pulse, the engines hum tonight
[00:38.00]We break away into the violet light
[00:46.00]Zero gravity, no turning back
[00:54.00]Speed of sound along the endless track
[01:04.00]Neon horizon, guide our way
[01:12.00]Beyond the edge of yesterday
[01:22.00][Synth Solo & Percussion Drop]
[01:44.00]Signals flashing through the atmosphere
[01:52.00]In the resonance, the path is clear
[02:00.00]Take the wheel, surrender to the flow
[02:10.00]Where the neon currents glow
[02:22.00]Neon horizon, burning bright
[02:34.00]We dissolve into the night
[02:50.00][Outro Fade]',
  1420,
  'FLAC',
  'HI_RES_LOSSLESS',
  true
),
(
  'track-2',
  'Midnight Rain in Shibuya',
  'Komorebi & Sora',
  'Tokyo Tape Sessions',
  168,
  'Lo-Fi',
  2024,
  82,
  'Chill',
  '#9d4edd',
  'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800&auto=format&fit=crop&q=80',
  'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
  '[00:00.00][Vinyl Crackle & Gentle Rain on Glass]
[00:12.00]Drops descending through the lantern glow
[00:24.00]Gentle footsteps in the street below
[00:36.00]A cup of tea, a quiet room to think
[00:48.00]Time suspended on a peaceful brink
[01:00.00][Warm Electric Piano Chords]
[01:14.00]Let the rhythm wash the noise away
[01:28.00]Finding solace at the close of day
[01:42.00]Raindrops falling in Shibuya
[01:58.00]Quiet reverie...
[02:14.00][Soft Muffled Trumpet Melodies]
[02:30.00][Rain fades gently into distance]',
  980,
  'FLAC',
  'LOSSLESS',
  true
),
(
  'track-3',
  'Deep Quantum Drift',
  'Aetheria Protocol',
  'Cosmic Resonance',
  220,
  'Ambient',
  2023,
  70,
  'Focus',
  '#00b4d8',
  'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=800&auto=format&fit=crop&q=80',
  'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=ambient-piano-amp-strings-10711.mp3',
  '[00:00.00][Sub-bass swell & deep harmonic resonance]
[00:28.00]Entering the neutral density corridor
[00:56.00]Frequency alignment achieved
[01:24.00]Expanding into pure focus
[02:00.00]All boundaries dissolve in acoustic space
[02:40.00]Deep quantum equilibrium
[03:15.00][Harmonic tail decay]',
  640,
  'FLAC',
  'HI_RES_LOSSLESS',
  true
),
(
  'track-4',
  'Solar Flare',
  'HyperDrive',
  'Supernova',
  208,
  'Electronic',
  2024,
  130,
  'Workout',
  '#ff9e00',
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
  'https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3?filename=future-technology-11326.mp3',
  '[00:00.00][High Energy Buildup & Pumping Kick]
[00:15.00]Rising heat across the solar shield
[00:30.00]Power surge in the magnetic field
[00:45.00]Push the limit, feel the acceleration
[01:00.00]Maximum output, zero hesitation
[01:30.00]Solar flare ignite!
[02:00.00][Peak drop and synth arpeggio]',
  1820,
  'AAC',
  'HIGH',
  false
),
(
  'track-5',
  'Celestial Dawn',
  'Lumina Choir',
  'Aura of Light',
  195,
  'Classical',
  2024,
  65,
  'Chill',
  '#f3c5a6',
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop&q=80',
  'https://cdn.pixabay.com/download/audio/2022/11/06/audio_0a63118cf5.mp3?filename=ethereal-meditation-124978.mp3',
  '[00:00.00][Atmospheric Choral Drone]
[00:20.00]Morning breaks above the golden valley
[00:40.00]Sunlight scattering across the mountain ridges
[01:05.00]Every horizon is a new beginning
[01:30.00]We breathe in the endless air
[02:05.00]Follow the light wherever it leads
[02:40.00]Celestial dawn has come
[03:10.00][Ethereal vocalise fade]',
  510,
  'FLAC',
  'HI_RES_LOSSLESS',
  true
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  artist = EXCLUDED.artist,
  audio_file_url = EXCLUDED.audio_file_url,
  artwork_url = EXCLUDED.artwork_url;

-- 2. Insert System EQ Presets
INSERT INTO public.eq_presets (name, is_system, bands, bass_boost, treble, stereo_pan, reverb_level)
VALUES
  ('Flat Studio', true, '[0, 0, 0, 0, 0, 0, 0, 0, 0, 0]'::jsonb, 0.0, 0.0, 0.0, 0.0),
  ('AURA Signature', true, '[4.5, 3.5, 1.5, -1.0, -0.5, 1.0, 2.5, 3.0, 4.0, 4.5]'::jsonb, 3.5, 2.0, 0.0, 0.1),
  ('Bass Cannon', true, '[6.0, 5.0, 3.0, 0.5, -1.0, -1.0, 0.0, 1.0, 2.0, 1.5]'::jsonb, 6.0, 0.0, 0.0, 0.0),
  ('Vocal Clarity', true, '[-2.0, -1.0, 0.0, 2.0, 3.5, 4.0, 3.0, 2.0, 1.0, 0.0]'::jsonb, 0.0, 2.5, 0.0, 0.15),
  ('Audiophile Pure', true, '[0.5, 0.0, -0.5, 0.0, 0.5, 0.5, 0.0, -0.5, 0.0, 0.5]'::jsonb, 0.0, 0.0, 0.0, 0.0)
ON CONFLICT DO NOTHING;

-- 3. Insert System Visualizer Presets
INSERT INTO public.visualizer_presets (name, mode, is_system, config)
VALUES
  ('Classic Spectrum Bars', 'bars', true, '{"barCount": 64, "smoothing": 0.85}'::jsonb),
  ('Oscilloscope Waveform', 'waveform', true, '{"lineWidth": 2, "glow": true}'::jsonb),
  ('Orbital Circular Spectrum', 'circular', true, '{"radius": 120, "spin": true}'::jsonb),
  ('Quantum Particle Field', 'particles', true, '{"particleCount": 150, "velocity": 1.2}'::jsonb),
  ('Ambient Luminescence', 'ambient', true, '{"blur": 40, "pulseSpeed": 0.8}'::jsonb)
ON CONFLICT DO NOTHING;
