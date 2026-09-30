import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SAMPLE_TRACKS_SEED = [
  {
    id: 'track-1',
    title: 'Neon Horizon',
    artist: 'CYBERPULSE',
    album: 'Odyssey 2099',
    duration: 194,
    genre: 'Synthwave',
    year: 2024,
    bpm: 124,
    mood: 'Energy',
    accentColor: '#00f2fe',
    artworkUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&auto=format&fit=crop&q=80',
    audioFileUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=synthwave-80s-110045.mp3',
    lyricsLrc: `[00:00.00][Instrumental Intro - Analog Arpeggio]
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
[02:50.00][Outro Fade]`,
    playCount: 14,
  },
  {
    id: 'track-2',
    title: 'Midnight Rain in Shibuya',
    artist: 'Komorebi & Sora',
    album: 'Tokyo Tape Sessions',
    duration: 168,
    genre: 'Lo-Fi',
    year: 2024,
    bpm: 82,
    mood: 'Chill',
    accentColor: '#9d4edd',
    artworkUrl: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800&auto=format&fit=crop&q=80',
    audioFileUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
    lyricsLrc: `[00:00.00][Vinyl Crackle & Gentle Rain on Glass]
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
[02:30.00][Rain fades gently into distance]`,
    playCount: 19,
  },
  {
    id: 'track-3',
    title: 'Deep Quantum Drift',
    artist: 'Aetheria Protocol',
    album: 'Cosmic Resonance',
    duration: 220,
    genre: 'Ambient',
    year: 2023,
    bpm: 70,
    mood: 'Focus',
    accentColor: '#00b4d8',
    artworkUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=800&auto=format&fit=crop&q=80',
    audioFileUrl: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=ambient-piano-amp-strings-10711.mp3',
    lyricsLrc: `[00:00.00][Sub-bass swell & deep harmonic resonance]
[00:28.00]Entering the neutral density corridor
[00:56.00]Frequency alignment achieved
[01:24.00]Expanding into pure focus
[02:00.00]All boundaries dissolve in acoustic space
[02:40.00]Deep quantum equilibrium
[03:15.00][Harmonic tail decay]`,
    playCount: 8,
  },
  {
    id: 'track-4',
    title: 'Solar Flare',
    artist: 'HyperDrive',
    album: 'Supernova',
    duration: 208,
    genre: 'Electronic',
    year: 2024,
    bpm: 130,
    mood: 'Workout',
    accentColor: '#ff9e00',
    artworkUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
    audioFileUrl: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3?filename=future-technology-11326.mp3',
    lyricsLrc: `[00:00.00][High Energy Pulse Build]
[00:15.00]Pressure rising, fuel ignited
[00:23.00]Core reactor fully sighted
[00:30.00]3, 2, 1 - IGNITION
[00:32.00][Bass Drop & Driving Four-on-the-Floor]
[01:02.00]Push the limit past the red line
[01:18.00]Faster than the speed of light
[01:34.00]Feel the solar flare!
[02:00.00][Sub Drop & Arp Climax]
[02:30.00]No stopping now
[03:00.00][Maximum Velocity Outro]`,
    playCount: 11,
  },
  {
    id: 'track-5',
    title: 'Elysium Nocturne',
    artist: 'Valeria Vance',
    album: 'Silhouettes in Minor',
    duration: 186,
    genre: 'Classical',
    year: 2023,
    bpm: 66,
    mood: 'Melancholy',
    accentColor: '#f72585',
    artworkUrl: 'https://images.unsplash.com/photo-1520523839898-50712825e3a7?w=800&auto=format&fit=crop&q=80',
    audioFileUrl: 'https://cdn.pixabay.com/download/audio/2022/02/07/audio_bf491dc67b.mp3?filename=sad-piano-ambient-10776.mp3',
    lyricsLrc: `[00:00.00][Concert Grand Piano - Solo Cadence]
[00:22.00]Notes written on parchment in the dusk
[00:44.00]Memories lingering in quiet rooms
[01:08.00]A haunting melody from another lifetime
[01:35.00]Strings enter softly like a whispered remembrance
[02:10.00]The resolution we could never find
[02:45.00][Final gentle keystroke]`,
    playCount: 6,
  },
  {
    id: 'track-6',
    title: 'Celestial Dawn',
    artist: 'Aurora Collective',
    album: 'Prism Horizons',
    duration: 215,
    genre: 'Dreamwave',
    year: 2024,
    bpm: 108,
    mood: 'Travel',
    accentColor: '#10b981',
    artworkUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
    audioFileUrl: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_c230e17d04.mp3?filename=relaxed-vlog-131746.mp3',
    lyricsLrc: `[00:00.00][Breeze, Windchimes & Shimmering Pads]
[00:20.00]Morning breaks above the golden valley
[00:40.00]Sunlight scattering across the mountain ridges
[01:05.00]Every horizon is a new beginning
[01:30.00]We breathe in the endless air
[02:05.00]Follow the light wherever it leads
[02:40.00]Celestial dawn has come
[03:10.00][Ethereal vocalise fade]`,
    playCount: 5,
  },
];

async function main() {
  console.log('Seeding AURA database...');

  // 1. Create or upsert Demo User
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const user = await prisma.user.upsert({
    where: { email: 'alex@aura.audio' },
    update: {},
    create: {
      id: 'usr_demo_1',
      email: 'alex@aura.audio',
      passwordHash,
      name: 'Alex Mercer',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
      preferences: {
        create: {
          accentColor: '#00f2fe',
          theme: 'dark',
          visualizerMode: 'bars',
          visualizerIntensity: 1.0,
          reducedMotion: false,
          defaultVolume: 0.8,
          eqBands: JSON.stringify([4.5, 3.5, 1.5, -1.0, -0.5, 1.0, 2.5, 3.0, 4.0, 4.5]),
          bassBoost: 3.5,
          treble: 2.0,
          stereoPan: 0.0,
          reverbLevel: 0.1,
          eqPreset: 'AURA Signature',
          eqBypassed: false,
        },
      },
    },
  });

  // 2. Upsert Sample Tracks
  for (const t of SAMPLE_TRACKS_SEED) {
    await prisma.track.upsert({
      where: { id: t.id },
      update: t,
      create: t,
    });
  }

  // 3. Create Curated Playlists
  const synthwavePl = await prisma.playlist.upsert({
    where: { id: 'pl-synthwave' },
    update: {},
    create: {
      id: 'pl-synthwave',
      title: 'Neon Nights & Cyber City',
      description: 'Analog synthesizers, retro-futuristic basslines, and high-speed nocturnal highways.',
      coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&auto=format&fit=crop&q=80',
      isPublic: true,
      ownerId: user.id,
      tracks: {
        create: [
          { trackId: 'track-1', position: 0 },
          { trackId: 'track-4', position: 1 },
        ],
      },
    },
  });

  const focusPl = await prisma.playlist.upsert({
    where: { id: 'pl-focus' },
    update: {},
    create: {
      id: 'pl-focus',
      title: 'Deep Quantum Equilibrium',
      description: 'Sub-bass ambient drones, organic lo-fi rhythms, and non-intrusive soundscapes for extreme focus.',
      coverUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=800&auto=format&fit=crop&q=80',
      isPublic: true,
      ownerId: user.id,
      tracks: {
        create: [
          { trackId: 'track-2', position: 0 },
          { trackId: 'track-3', position: 1 },
          { trackId: 'track-5', position: 2 },
        ],
      },
    },
  });

  // 4. Seed User Liked Tracks
  for (const trackId of ['track-1', 'track-2', 'track-3']) {
    await prisma.userLikedTrack.upsert({
      where: { userId_trackId: { userId: user.id, trackId } },
      update: {},
      create: { userId: user.id, trackId },
    });
  }

  // 5. Seed Listening History
  const historyDates = [
    { date: '2026-09-14', mins: 24, trackId: 'track-1' },
    { date: '2026-09-15', mins: 35, trackId: 'track-2' },
    { date: '2026-09-16', mins: 18, trackId: 'track-3' },
    { date: '2026-09-17', mins: 42, trackId: 'track-4' },
    { date: '2026-09-18', mins: 50, trackId: 'track-1' },
    { date: '2026-09-19', mins: 38, trackId: 'track-2' },
    { date: '2026-09-20', mins: 15, trackId: 'track-1' },
  ];

  for (const h of historyDates) {
    await prisma.listeningHistory.create({
      data: {
        userId: user.id,
        trackId: h.trackId,
        durationListened: h.mins * 60,
        completed: true,
        timestamp: new Date(h.date),
      },
    });
  }

  // 6. Create Initial Sync Room
  await prisma.room.upsert({
    where: { id: 'node-404' },
    update: {},
    create: {
      id: 'node-404',
      name: 'CYBERPULSE Sonic Node #404',
      hostId: user.id,
      currentTrackId: 'track-1',
      currentTime: 14.5,
      isPlaying: true,
      messages: {
        create: [
          {
            userId: 'system',
            userName: 'AURA System',
            text: 'Quantum synchronized audio session online.',
          },
          {
            userId: user.id,
            userName: 'Alex Mercer (Host)',
            text: 'Welcome everyone! Testing the new 10-band spatial mix.',
          },
        ],
      },
    },
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
