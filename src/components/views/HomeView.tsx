import React, { useState } from 'react';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useAudioStore } from '../../stores/useAudioStore';
import { useUIStore } from '../../stores/useUIStore';
import { Track } from '../../types/audio';
import {
  Play,
  Pause,
  Heart,
  MoreHorizontal,
  Flame,
  ArrowRight,
  BadgeCheck,
  Disc,
  Users,
  Radio,
} from 'lucide-react';

// "Made for you" Curated Scenic Playlists (from reference UI)
const MADE_FOR_YOU_CARDS = [
  {
    id: 'mfy-late-night',
    title: 'Late Night Drive',
    subtitle: 'Chill songs for city nights',
    artwork: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?w=600&auto=format&fit=crop&q=80',
    query: 'The Weeknd Starboy Blinding Lights',
  },
  {
    id: 'mfy-falling-in-love',
    title: 'Falling in Love',
    subtitle: 'Songs that hit different',
    artwork: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600&auto=format&fit=crop&q=80',
    query: 'Arijit Singh Kesariya Tum Hi Ho',
  },
  {
    id: 'mfy-acoustic-mornings',
    title: 'Acoustic Mornings',
    subtitle: 'Soft, calm & beautiful',
    artwork: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=600&auto=format&fit=crop&q=80',
    query: 'Sid Sriram acoustic melodies',
  },
  {
    id: 'mfy-midnight-memories',
    title: 'Midnight Memories',
    subtitle: 'Nostalgic tunes for the soul',
    artwork: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=600&auto=format&fit=crop&q=80',
    query: 'A.R. Rahman vintage nostalgia',
  },
  {
    id: 'mfy-good-vibes',
    title: 'Good Vibes',
    subtitle: 'Feel good playlist',
    artwork: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80',
    query: 'Anirudh upbeat hit vibes',
  },
];

// "Recently played" cards (from reference UI)
const RECENTLY_PLAYED_CARDS = [
  {
    id: 'recent-1',
    title: 'Dusk Till Dawn',
    artist: 'Aiden Vale',
    artwork: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'recent-2',
    title: 'Golden Hour',
    artist: 'Hollow Coves',
    artwork: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'recent-3',
    title: 'Someone Like You',
    artist: 'Adele',
    artwork: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'recent-4',
    title: 'It Will Be Okay',
    artist: 'Tom Odell',
    artwork: 'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'recent-5',
    title: 'Everything I Wanted',
    artist: 'Billie Eilish',
    artwork: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80',
  },
];

// "Popular tracks" ranked list (from reference UI)
const POPULAR_TRACKS = [
  {
    rank: '01',
    id: 'pop-1',
    title: 'Dusk Till Dawn',
    artist: 'Aiden Vale',
    duration: '3:45',
    durationSec: 225,
    artwork: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=200&auto=format&fit=crop&q=80',
  },
  {
    rank: '02',
    id: 'pop-2',
    title: 'Perfect',
    artist: 'Aiden Vale',
    duration: '4:12',
    durationSec: 252,
    artwork: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=200&auto=format&fit=crop&q=80',
  },
  {
    rank: '03',
    id: 'pop-3',
    title: 'Better With You',
    artist: 'Aiden Vale',
    duration: '3:28',
    durationSec: 208,
    artwork: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=200&auto=format&fit=crop&q=80',
  },
  {
    rank: '04',
    id: 'pop-4',
    title: 'Golden Hour',
    artist: 'Hollow Coves',
    duration: '3:36',
    durationSec: 216,
    artwork: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=200&auto=format&fit=crop&q=80',
  },
];

// Curated Top Global & Indian Icons
const FEATURED_ARTISTS = [
  {
    id: 'itunes_artist_480976476__Anirudh Ravichander',
    name: 'Anirudh Ravichander',
    role: 'Music Director & Rockstar',
    avatar: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/f7/20/67/f720671c-c971-4c3d-a20e-a0ee1fedfa9e/196871508544.jpg/400x400bb.jpg',
    genre: 'Tamil Cinema / EDM',
  },
  {
    id: 'itunes_artist_3249567__A. R. Rahman',
    name: 'A.R. Rahman',
    role: 'Oscar Winner & Maestro',
    avatar: 'https://c.saavncdn.com/artists/AR_Rahman_002_20210120084455_500x500.jpg',
    genre: 'Soundtrack / World',
  },
  {
    id: 'itunes_artist_20625492__Thalapathy Vijay',
    name: 'Thalapathy Vijay',
    role: 'Icon & Playback Vocalist',
    avatar: 'https://c.saavncdn.com/artists/Vijay_003_20240103075444_500x500.jpg',
    genre: 'Tamil Cinema / Anthems',
  },
  {
    id: 'itunes_artist_484568188__Arijit Singh',
    name: 'Arijit Singh',
    role: 'Bollywood Melody King',
    avatar: 'https://c.saavncdn.com/artists/Arijit_Singh_004_20241118063717_500x500.jpg',
    genre: 'Hindi Romance / Pop',
  },
  {
    id: 'itunes_artist_898492061__Sid Sriram',
    name: 'Sid Sriram',
    role: 'Carnatic & Playback Sensation',
    avatar: 'https://c.saavncdn.com/artists/Sid_Sriram_007_20240205054528_500x500.jpg',
    genre: 'Telugu / Tamil Melodies',
  },
  {
    id: 'itunes_artist_479756766__The Weeknd',
    name: 'The Weeknd',
    role: 'Global Pop Visionary',
    avatar: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&auto=format&fit=crop&q=80',
    genre: 'R&B / Synthwave',
  },
];

// Curated Top Soundtracks
const FEATURED_ALBUMS = [
  {
    id: 'saavn_album_49113982',
    title: 'Leo',
    subtitle: 'Thalapathy Vijay • Anirudh',
    artwork: 'https://c.saavncdn.com/415/Leo-Original-Motion-Picture-Soundtrack-English-2023-20231019170311-500x500.jpg',
    year: 2023,
    genre: 'Tamil Cinema',
  },
  {
    id: 'itunes_album_1705952061',
    title: 'Jawan',
    subtitle: 'Shah Rukh Khan • Anirudh',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/bb/f4/f5/bbf4f511-3c12-c25e-a475-b6d06faa8c13/8902894362047_cover.jpg/600x600bb.jpg',
    year: 2023,
    genre: 'Bollywood',
  },
  {
    id: 'itunes_album_1624359269',
    title: 'Vikram',
    subtitle: 'Kamal Haasan • Anirudh',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/41/41/01/41410135-baa0-1aab-7417-f6746b0f3c25/196589186973.jpg/600x600bb.jpg',
    year: 2022,
    genre: 'Tamil Cinema',
  },
  {
    id: 'itunes_album_1446253614',
    title: 'Petta',
    subtitle: 'Rajinikanth • Anirudh',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/1f/6d/35/1f6d359b-2bc2-a2e9-bfe9-80e828d46a6a/886447484166.jpg/600x600bb.jpg',
    year: 2018,
    genre: 'Tamil Cinema',
  },
];

export const HomeView: React.FC = () => {
  const allTracks = useLibraryStore((state) => state.allTracks);
  const onlineTracks = useLibraryStore((state) => state.onlineTracks);
  const playTrack = useAudioStore((state) => state.playTrack);
  const currentTrack = useAudioStore((state) => state.currentTrack);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const togglePlay = useAudioStore((state) => state.togglePlay);
  const actualDeliveredQuality = useAudioStore((state) => state.actualDeliveredQuality);
  const isLiked = useLibraryStore((state) => (currentTrack ? state.isLiked(currentTrack.id) : false));
  const toggleLike = useLibraryStore((state) => state.toggleLike);

  const openArtistView = useUIStore((state) => state.openArtistView);
  const openAlbumView = useUIStore((state) => state.openAlbumView);
  const setActiveView = useUIStore((state) => state.setActiveView);
  const setSearchQuery = useUIStore((state) => state.setSearchQuery);
  const setQualityPanelOpen = useUIStore((state) => state.setQualityPanelOpen);

  // Hero track: either currently playing or default "Perfect" by Aiden Vale
  const heroTitle = currentTrack?.title || 'Perfect';
  const heroArtist = currentTrack?.artist || 'Aiden Vale';
  const heroArtwork =
    currentTrack?.artwork ||
    'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=800&auto=format&fit=crop&q=80';
  const heroGenre = currentTrack?.genre || 'Indie Pop';

  const handleHeroPlay = () => {
    if (currentTrack) {
      togglePlay();
    } else {
      const topSong = onlineTracks[0] || allTracks[0];
      if (topSong) {
        playTrack(topSong, onlineTracks);
      }
    }
  };

  const handleCardPlay = (query: string) => {
    setSearchQuery(query);
    setActiveView('search');
  };

  const handlePopularTrackPlay = (t: typeof POPULAR_TRACKS[0]) => {
    const matched = onlineTracks.find((ot) => ot.title.toLowerCase().includes(t.title.toLowerCase())) || {
      id: t.id,
      title: t.title,
      artist: t.artist,
      duration: t.durationSec,
      artwork: t.artwork,
      genre: 'Indie Pop',
      bpm: 120,
      accentColor: '#f3c5a6',
      audioUrl: '/api/v1/tracks/online/1/stream',
      playCount: 1200000,
      isOnline: true,
      album: 'Midnight Sessions',
    };
    playTrack(matched as Track, onlineTracks);
  };

  // Waveform heights matching the reference image's visualizer bars
  const WAVEFORM_HEIGHTS = [
    6, 10, 14, 20, 26, 18, 12, 8, 14, 22, 28, 24, 16, 10, 15, 20, 27, 21, 14, 8,
    12, 19, 25, 20, 13, 9, 15, 22, 26, 17, 11, 7
  ];

  return (
    <div className="flex flex-col gap-9 pb-36 animate-in fade-in duration-300 select-none">
      {/* ─────────────────────────────────────────────────────────────
          1. HERO FEATURE SHOWCASE (Matches reference screenshot)
         ───────────────────────────────────────────────────────────── */}
      <div className="relative rounded-3xl bg-[#121110] border border-white/[0.07] p-6 sm:p-8 flex flex-col lg:flex-row items-center justify-between gap-8 shadow-2xl overflow-hidden group">
        {/* Subtle Warm Ambiance Glow */}
        <div className="absolute -left-16 -top-16 w-80 h-80 rounded-full bg-[#f3c5a6]/[0.05] blur-[120px] pointer-events-none" />
        <div className="absolute right-0 bottom-0 w-80 h-80 rounded-full bg-[#d4a373]/[0.04] blur-[120px] pointer-events-none" />

        {/* Left: Romantic / Dusk Album Cover Artwork */}
        <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 bg-[#1c1a18] ring-1 ring-white/10 group-hover:scale-[1.01] transition-transform duration-500">
          <img
            src={heroArtwork}
            alt={heroTitle}
            className="w-full h-full object-cover"
          />
          {/* Subtle vignette gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        </div>

        {/* Center: Track Metadata, Quote & Controls */}
        <div className="flex flex-col gap-3 max-w-md w-full z-10 text-center lg:text-left">
          <span className="text-[11px] font-mono tracking-[0.25em] text-[#a89e95] uppercase font-bold">
            NOW PLAYING
          </span>

          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-[#fbf6f1] font-normal tracking-tight">
            {heroTitle}
          </h1>

          <p
            onClick={() => openArtistView(`artist_${encodeURIComponent(heroArtist)}__${encodeURIComponent(heroArtist)}`)}
            className="font-serif italic text-lg sm:text-xl text-[#d4c3b7] hover:text-[#f3c5a6] transition-colors cursor-pointer self-center lg:self-start"
          >
            {heroArtist}
          </p>

          <div className="flex items-center justify-center lg:justify-start gap-2.5 text-xs text-[#8f867e] font-sans flex-wrap">
            <div className="flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-[#f3c5a6] fill-[#f3c5a6]" />
              <span>4.8M</span>
            </div>
            <span>•</span>
            <span>{heroGenre}</span>

            {/* Lossless Audio Quality Badge */}
            {actualDeliveredQuality ? (
              <>
                <span>•</span>
                <button
                  onClick={() => setQualityPanelOpen(true)}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono tracking-wider font-semibold border transition-all hover:scale-105 active:scale-95 ${
                    actualDeliveredQuality.qualityTier === 'HI_RES_LOSSLESS'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                      : actualDeliveredQuality.isLossless
                      ? 'bg-aura-cyan/15 text-aura-cyan border-aura-cyan/40 hover:bg-aura-cyan/25'
                      : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                  }`}
                  title="View Authentic Stream Quality & Bit-Perfect Pipeline"
                >
                  <Radio className="w-2.5 h-2.5 text-current animate-pulse" />
                  <span>
                    {actualDeliveredQuality.qualityTier === 'HI_RES_LOSSLESS'
                      ? 'HI-RES'
                      : actualDeliveredQuality.qualityTier === 'LOSSLESS'
                      ? 'LOSSLESS'
                      : 'HIGH'}
                  </span>
                  <span className="opacity-50">•</span>
                  <span>{actualDeliveredQuality.codec}</span>
                  {actualDeliveredQuality.bitDepth && <span>{actualDeliveredQuality.bitDepth}b</span>}
                  {actualDeliveredQuality.sampleRate && (
                    <span>{Math.round(actualDeliveredQuality.sampleRate / 1000)}k</span>
                  )}
                </button>
              </>
            ) : currentTrack?.qualityTier ? (
              <>
                <span>•</span>
                <button
                  onClick={() => setQualityPanelOpen(true)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono tracking-wider font-semibold border border-[#f3c5a6]/30 bg-[#f3c5a6]/10 text-[#f3c5a6] hover:bg-[#f3c5a6]/20 transition-all"
                >
                  <Radio className="w-2.5 h-2.5" />
                  <span>{currentTrack.qualityTier === 'HI_RES_LOSSLESS' ? 'HI-RES' : currentTrack.qualityTier}</span>
                </button>
              </>
            ) : null}
          </div>

          <p className="text-xs text-[#8f867e] italic leading-relaxed pt-1">
            Every moment with you feels like the perfect song.
          </p>

          {/* Action Buttons: Play + Like + More */}
          <div className="flex items-center justify-center lg:justify-start gap-3 pt-3">
            <button
              onClick={handleHeroPlay}
              className="flex items-center gap-2.5 px-8 py-2.5 rounded-full bg-[#f3c5a6] hover:bg-[#ffcca8] text-[#141210] font-bold text-xs tracking-wide shadow-lg hover:shadow-[#f3c5a6]/20 hover:scale-105 active:scale-95 transition-all"
            >
              {isPlaying && currentTrack ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                  <span>Play</span>
                </>
              )}
            </button>

            <button
              onClick={() => (currentTrack ? toggleLike(currentTrack.id) : null)}
              className={`w-10 h-10 rounded-full border border-white/[0.12] hover:border-[#f3c5a6] flex items-center justify-center transition-all ${
                isLiked ? 'text-[#f3c5a6] border-[#f3c5a6]' : 'text-[#c4b9af] hover:text-[#f3c5a6]'
              }`}
              title="Like track"
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
            </button>

            <button
              className="w-10 h-10 rounded-full border border-white/[0.12] hover:border-white/30 flex items-center justify-center text-[#c4b9af] hover:text-white transition-all"
              title="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Realistic 3D Vinyl Record & Pulsing Equalizer */}
        <div className="relative flex flex-col items-center justify-center flex-shrink-0 z-10">
          {/* Vinyl Record Disc */}
          <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-full midnight-vinyl midnight-grooves p-1 shadow-2xl flex items-center justify-center group-hover:translate-x-1 transition-transform">
            {/* Concentric Sheen Ring */}
            <div
              className={`w-full h-full rounded-full border border-white/[0.08] flex items-center justify-center ${
                isPlaying ? 'animate-spin-slow' : ''
              }`}
            >
              {/* Center Vinyl Label */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#1b1715] border-2 border-[#f3c5a6]/30 flex flex-col items-center justify-center text-center p-1 shadow-inner">
                <span className="text-[7px] font-mono tracking-widest text-[#f3c5a6] uppercase font-bold">
                  MIDNIGHT
                </span>
                <div className="w-2.5 h-2.5 rounded-full bg-[#0a0908] border border-white/20 mt-1" />
              </div>
            </div>
          </div>

          {/* Equalizer Waveform Sound Bars Under Vinyl */}
          <div className="flex items-end justify-center gap-1 h-8 mt-5 w-48">
            {WAVEFORM_HEIGHTS.map((h, i) => (
              <span
                key={i}
                className="w-0.5 rounded-full bg-[#f3c5a6]/70 transition-all duration-300"
                style={{
                  height: isPlaying ? `${Math.max(4, (h * (0.6 + Math.sin((i + Date.now() / 200) * 0.4) * 0.4)))}px` : `${Math.max(3, h * 0.35)}px`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. "MADE FOR YOU" SECTION (Horizontal Scenic Cards)
         ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#fbf6f1] tracking-tight">Made for you</h2>
          <button
            onClick={() => setActiveView('search')}
            className="text-xs font-semibold text-[#8f867e] hover:text-[#f3c5a6] transition-colors"
          >
            See all
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {MADE_FOR_YOU_CARDS.map((card) => (
            <div
              key={card.id}
              onClick={() => handleCardPlay(card.query)}
              className="group relative aspect-[16/11] rounded-2xl overflow-hidden cursor-pointer bg-[#161514] border border-white/[0.06] hover:border-[#f3c5a6]/40 transition-all shadow-lg"
            >
              <img
                src={card.artwork}
                alt={card.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              {/* Dark Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3.5 flex flex-col justify-end" />

              {/* Title & Subtitle */}
              <div className="absolute bottom-3 left-3 right-12 z-10">
                <h3 className="text-xs font-bold text-white leading-tight truncate">
                  {card.title}
                </h3>
                <p className="text-[10px] text-[#c4b9af] truncate mt-0.5">
                  {card.subtitle}
                </p>
              </div>

              {/* Floating Circular Play Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCardPlay(card.query);
                }}
                className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-white/20 backdrop-blur-md border border-white/20 text-white hover:bg-[#f3c5a6] hover:text-[#141210] hover:scale-105 flex items-center justify-center transition-all z-10 shadow"
                title={`Play ${card.title}`}
              >
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. SPLIT ROW: "Recently played" (Left) & "Popular tracks" (Right)
         ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Recently played (5 Cards) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#fbf6f1] tracking-tight">Recently played</h2>
            <button
              onClick={() => setActiveView('library')}
              className="text-xs font-semibold text-[#8f867e] hover:text-[#f3c5a6] transition-colors"
            >
              See all
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {RECENTLY_PLAYED_CARDS.map((card) => (
              <div
                key={card.id}
                onClick={() => handleCardPlay(`${card.title} ${card.artist}`)}
                className="group p-2.5 rounded-2xl bg-[#141312] border border-white/[0.06] hover:border-[#f3c5a6]/30 cursor-pointer flex flex-col gap-2 transition-all shadow-md"
              >
                <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-[#1f1d1b]">
                  <img
                    src={card.artwork}
                    alt={card.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <div className="w-8 h-8 rounded-full bg-[#f3c5a6] text-[#141210] flex items-center justify-center shadow">
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-white truncate group-hover:text-[#f3c5a6] transition-colors">
                    {card.title}
                  </span>
                  <span className="text-[10px] text-[#8f867e] truncate mt-0.5">
                    {card.artist}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Popular tracks (Ranked 01-04) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#fbf6f1] tracking-tight">Popular tracks</h2>
            <button
              onClick={() => setActiveView('search')}
              className="text-xs font-semibold text-[#8f867e] hover:text-[#f3c5a6] transition-colors"
            >
              See all
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {POPULAR_TRACKS.map((t) => (
              <div
                key={t.id}
                onClick={() => handlePopularTrackPlay(t)}
                className="group flex items-center justify-between p-2.5 rounded-2xl hover:bg-[#181716] border border-transparent hover:border-white/[0.06] cursor-pointer transition-all"
              >
                {/* Rank Number + Artwork + Title/Artist */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <span className="w-5 text-xs font-mono font-medium text-[#6e665f] group-hover:text-[#f3c5a6] text-center">
                    {t.rank}
                  </span>

                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#1c1a18] flex-shrink-0 shadow">
                    <img src={t.artwork} alt={t.title} className="w-full h-full object-cover" />
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-[#fbf6f1] truncate group-hover:text-[#f3c5a6] transition-colors">
                      {t.title}
                    </span>
                    <span className="text-[11px] text-[#8f867e] truncate mt-0.5">
                      {t.artist}
                    </span>
                  </div>
                </div>

                {/* Duration & Heart */}
                <div className="flex items-center gap-4 text-xs font-mono text-[#8f867e]">
                  <span>{t.duration}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className="p-1 text-[#6e665f] hover:text-[#f3c5a6] transition-colors"
                  >
                    <Heart className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. FEATURED ARTISTS & COMPOSERS (Preserving full artist navigation)
         ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 pt-4 border-t border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#f3c5a6]" />
            <h3 className="text-lg font-bold text-white tracking-tight">Featured Artists & Composers</h3>
          </div>
          <button
            onClick={() => setActiveView('search')}
            className="text-xs font-semibold text-[#f3c5a6] hover:underline flex items-center gap-1"
          >
            <span>Explore All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {FEATURED_ARTISTS.map((artist) => (
            <div
              key={artist.name}
              onClick={() => openArtistView(artist.id)}
              className="group p-4 rounded-3xl bg-[#141312] border border-white/[0.06] hover:border-[#f3c5a6]/30 cursor-pointer flex flex-col items-center text-center gap-3 relative shadow-lg transition-all"
            >
              <div className="relative w-24 h-24 rounded-full overflow-hidden shadow-2xl ring-2 ring-[#f3c5a6]/20 bg-[#1b1917] group-hover:scale-105 transition-transform duration-300">
                <img src={artist.avatar} alt={artist.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col min-w-0 w-full items-center">
                <div className="flex items-center gap-1 justify-center max-w-full">
                  <span className="text-xs font-bold text-white truncate group-hover:text-[#f3c5a6] transition-colors">
                    {artist.name}
                  </span>
                  <BadgeCheck className="w-3.5 h-3.5 text-[#f3c5a6] flex-shrink-0" />
                </div>
                <span className="text-[10px] text-[#8f867e] font-mono truncate mt-0.5">
                  {artist.role}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. BLOCKBUSTER SOUNDTRACKS (Leo, Jawan, Vikram, Petta)
         ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Disc className="w-4 h-4 text-[#f3c5a6]" />
            <h3 className="text-lg font-bold text-white tracking-tight">Blockbuster Soundtracks & Albums</h3>
          </div>
          <button
            onClick={() => setActiveView('search')}
            className="text-xs font-semibold text-[#8f867e] hover:text-[#f3c5a6] flex items-center gap-1"
          >
            <span>See More</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {FEATURED_ALBUMS.map((alb) => (
            <div
              key={alb.id}
              onClick={() => openAlbumView(alb.id)}
              className="group p-3.5 rounded-3xl bg-[#141312] border border-white/[0.06] hover:border-[#f3c5a6]/30 cursor-pointer flex flex-col gap-3 relative shadow-lg transition-all"
            >
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-[#1b1917]">
                <img
                  src={alb.artwork}
                  alt={alb.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <div className="w-12 h-12 rounded-full bg-[#f3c5a6] text-[#141210] flex items-center justify-center shadow">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </div>
                </div>
              </div>

              <div className="flex flex-col min-w-0">
                <h4 className="text-sm font-extrabold text-white truncate group-hover:text-[#f3c5a6] transition-colors">
                  {alb.title}
                </h4>
                <p className="text-xs text-[#8f867e] truncate">{alb.subtitle}</p>
                <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-[#f3c5a6]">
                  <span>{alb.genre}</span>
                  <span className="text-[#8f867e]">{alb.year}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
