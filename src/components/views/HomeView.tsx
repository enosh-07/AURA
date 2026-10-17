import React, { useState, useEffect } from 'react';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useAudioStore } from '../../stores/useAudioStore';
import { useUIStore } from '../../stores/useUIStore';
import { apiClient, PersonalizedHomeData } from '../../services/apiClient';
import { Track } from '../../types/audio';
import { TrackRow } from '../common/TrackRow';
import { TrackArtwork } from '../common/TrackArtwork';
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
  Sparkles,
  Compass,
  RefreshCw,
  Search,
  Music,
  FolderOpen,
  Volume2,
} from 'lucide-react';

// Curated Top Global & Indian Music Icons (links to real live streaming catalogs)
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

// Curated Top Soundtracks (links to real live streaming albums)
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

  // Personalized Home State
  const [homeData, setHomeData] = useState<PersonalizedHomeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadPersonalizedFeed = async () => {
    try {
      const data = await apiClient.getPersonalizedHome();
      setHomeData(data);
      if (data?.trending && data.trending.length > 0) {
        useLibraryStore.setState({ onlineTracks: data.trending });
      }
    } catch (err) {
      console.warn('[HomeView] Could not load personalized home data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadPersonalizedFeed();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadPersonalizedFeed();
  };

  // Determine the Hero Showcase Track:
  // 1. Current playing track if available
  // 2. Or top recommended track from personalized feed
  // 3. Or top catalog track from online/library tracks
  const candidateHeroTrack: Track | null =
    currentTrack ||
    homeData?.madeForYou?.[0] ||
    homeData?.trending?.[0] ||
    onlineTracks[0] ||
    allTracks[0] ||
    null;

  const handleHeroPlay = () => {
    if (currentTrack) {
      togglePlay();
    } else if (candidateHeroTrack) {
      const context = homeData?.madeForYou || homeData?.trending || onlineTracks || allTracks;
      playTrack(candidateHeroTrack, context);
    }
  };

  const handleCardSearch = (query: string) => {
    setSearchQuery(query);
    setActiveView('search');
  };

  // Waveform sound bar heights for the visualizer under the vinyl disc
  const WAVEFORM_HEIGHTS = [
    6, 10, 14, 20, 26, 18, 12, 8, 14, 22, 28, 24, 16, 10, 15, 20, 27, 21, 14, 8,
    12, 19, 25, 20, 13, 9, 15, 22, 26, 17, 11, 7,
  ];

  const hasHistory = homeData?.hasHistory || false;
  const madeForYouTracks = (homeData?.madeForYou && homeData.madeForYou.length > 0)
    ? homeData.madeForYou
    : onlineTracks.slice(0, 5);

  const recentlyPlayedTracks = homeData?.recentlyPlayed || [];
  const dailyMixes = (homeData?.dailyMixes && homeData.dailyMixes.length > 0)
    ? homeData.dailyMixes
    : homeData?.curatedMixes || [];

  const becauseYouListenedTo = homeData?.becauseYouListenedTo;
  const trendingTracks = (homeData?.trending && homeData.trending.length > 0)
    ? homeData.trending
    : onlineTracks.slice(0, 6);

  return (
    <div className="flex flex-col gap-9 pb-36 animate-in fade-in duration-300 select-none">
      {/* ─────────────────────────────────────────────────────────────
          1. HERO FEATURE SHOWCASE (Dynamic, reflects real playback)
         ───────────────────────────────────────────────────────────── */}
      {candidateHeroTrack ? (
        <div className="relative rounded-3xl bg-[#121110] border border-white/[0.07] p-6 sm:p-8 flex flex-col lg:flex-row items-center justify-between gap-8 shadow-2xl overflow-hidden group">
          {/* Subtle Warm Ambiance Glow */}
          <div className="absolute -left-16 -top-16 w-80 h-80 rounded-full bg-[#f3c5a6]/[0.05] blur-[120px] pointer-events-none" />
          <div className="absolute right-0 bottom-0 w-80 h-80 rounded-full bg-[#d4a373]/[0.04] blur-[120px] pointer-events-none" />

          {/* Left: Album Cover Artwork */}
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 bg-[#1c1a18] ring-1 ring-white/10 group-hover:scale-[1.01] transition-transform duration-500">
            <TrackArtwork
              artworkUrl={candidateHeroTrack.artwork}
              title={candidateHeroTrack.title}
              artist={candidateHeroTrack.artist}
              accentColor={candidateHeroTrack.accentColor}
            />
            {/* Subtle vignette gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
          </div>

          {/* Center: Track Metadata & Controls */}
          <div className="flex flex-col gap-3 max-w-md w-full z-10 text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-2">
              <span className="text-[11px] font-mono tracking-[0.25em] text-[#a89e95] uppercase font-bold">
                {currentTrack ? 'NOW PLAYING' : 'FEATURED DISCOVERY'}
              </span>
              {currentTrack && (
                <span className="w-2 h-2 rounded-full bg-[#f3c5a6] animate-pulse" />
              )}
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#fbf6f1] font-normal tracking-tight line-clamp-2">
              {candidateHeroTrack.title}
            </h1>

            <p
              onClick={() => {
                const token =
                  candidateHeroTrack.artistId ||
                  `artist_${encodeURIComponent(candidateHeroTrack.artist)}__${encodeURIComponent(candidateHeroTrack.artist)}`;
                openArtistView(token);
              }}
              className="font-serif italic text-lg sm:text-xl text-[#d4c3b7] hover:text-[#f3c5a6] transition-colors cursor-pointer self-center lg:self-start truncate max-w-full"
            >
              {candidateHeroTrack.artist}
            </p>

            <div className="flex items-center justify-center lg:justify-start gap-2.5 text-xs text-[#8f867e] font-sans flex-wrap">
              <span>{candidateHeroTrack.genre || 'Audiophile Stream'}</span>

              {/* Lossless Audio Quality Badge */}
              {actualDeliveredQuality && currentTrack ? (
                <>
                  <span>•</span>
                  <button
                    onClick={() => setQualityPanelOpen(true)}
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono tracking-wider font-semibold border transition-all hover:scale-105 active:scale-95 ${
                      actualDeliveredQuality.qualityTier === 'HI_RES_LOSSLESS'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                        : actualDeliveredQuality.isLossless
                        ? 'bg-[#f3c5a6]/15 text-[#f3c5a6] border-[#f3c5a6]/40 hover:bg-[#f3c5a6]/25'
                        : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                    }`}
                    title="View Authentic Stream Quality & Diagnostics"
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
              ) : candidateHeroTrack.qualityTier ? (
                <>
                  <span>•</span>
                  <button
                    onClick={() => setQualityPanelOpen(true)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono tracking-wider font-semibold border border-[#f3c5a6]/30 bg-[#f3c5a6]/10 text-[#f3c5a6] hover:bg-[#f3c5a6]/20 transition-all"
                  >
                    <Radio className="w-2.5 h-2.5" />
                    <span>
                      {candidateHeroTrack.qualityTier === 'HI_RES_LOSSLESS' ? 'HI-RES' : candidateHeroTrack.qualityTier}
                    </span>
                  </button>
                </>
              ) : null}
            </div>

            <p className="text-xs text-[#8f867e] italic leading-relaxed pt-1">
              {candidateHeroTrack.album ? `From the album "${candidateHeroTrack.album}"` : 'Experience authentic high-fidelity acoustics on AURA.'}
            </p>

            {/* Action Buttons: Play + Like + Refresh */}
            <div className="flex items-center justify-center lg:justify-start gap-3 pt-3">
              <button
                onClick={handleHeroPlay}
                className="flex items-center gap-2.5 px-8 py-2.5 rounded-full bg-[#f3c5a6] hover:bg-[#ffcca8] text-[#141210] font-bold text-xs tracking-wide shadow-lg hover:shadow-[#f3c5a6]/20 hover:scale-105 active:scale-95 transition-all"
              >
                {isPlaying && currentTrack?.id === candidateHeroTrack.id ? (
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
                onClick={() => toggleLike(candidateHeroTrack.id)}
                className={`w-10 h-10 rounded-full border border-white/[0.12] hover:border-[#f3c5a6] flex items-center justify-center transition-all ${
                  isLiked ? 'text-[#f3c5a6] border-[#f3c5a6]' : 'text-[#c4b9af] hover:text-[#f3c5a6]'
                }`}
                title="Like track"
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
              </button>

              <button
                onClick={handleRefresh}
                title="Refresh Recommendations"
                className={`w-10 h-10 rounded-full border border-white/[0.12] hover:border-white/30 flex items-center justify-center text-[#c4b9af] hover:text-white transition-all ${
                  isRefreshing ? 'animate-spin text-[#f3c5a6]' : ''
                }`}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right: Realistic 3D Vinyl Record & Pulsing Equalizer */}
          <div className="relative flex flex-col items-center justify-center flex-shrink-0 z-10">
            {/* Vinyl Record Disc */}
            <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-full midnight-vinyl midnight-grooves p-1 shadow-2xl flex items-center justify-center group-hover:translate-x-1 transition-transform">
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
                    height: isPlaying
                      ? `${Math.max(4, h * (0.6 + Math.sin((i + Date.now() / 200) * 0.4) * 0.4))}px`
                      : `${Math.max(3, h * 0.35)}px`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Welcome Hero for brand new or empty catalog state */
        <div className="relative rounded-3xl bg-[#121110] border border-white/[0.07] p-8 sm:p-12 flex flex-col items-center text-center justify-center gap-4 shadow-2xl overflow-hidden">
          <div className="w-14 h-14 rounded-2xl bg-[#241d19] border border-[#f3c5a6]/30 flex items-center justify-center text-[#f3c5a6] shadow-lg">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#fbf6f1]">Welcome to AURA</h1>
          <p className="text-xs sm:text-sm text-[#8f867e] max-w-md leading-relaxed">
            Personalized audiophile music streaming. Search across millions of regional and global tracks, or import your lossless collection.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => setActiveView('search')}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#f3c5a6] text-[#141210] font-bold text-xs hover:scale-105 transition-all shadow-lg"
            >
              <Search className="w-4 h-4" />
              <span>Search Music Catalog</span>
            </button>
            <button
              onClick={() => setActiveView('studio')}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/5 border border-white/10 text-white font-medium text-xs hover:bg-white/10 transition-all"
            >
              <FolderOpen className="w-4 h-4 text-[#f3c5a6]" />
              <span>Import Audio Files</span>
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. NEW USER FIRST-LISTEN GUIDANCE BANNER (Transparent onboarding)
         ───────────────────────────────────────────────────────────── */}
      {!hasHistory && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#1a1816] via-[#141312] to-[#121110] border border-[#f3c5a6]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#241d19] border border-[#f3c5a6]/30 flex items-center justify-center text-[#f3c5a6] shrink-0 mt-0.5">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-[#fbf6f1]">
                First Listen • Personalize Your Stream
              </h3>
              <p className="text-[11px] text-[#8f867e] leading-relaxed mt-0.5">
                Stream any song or tap an artist to calibrate your personal acoustic profile. As you listen, your Daily Mixes and custom recommendations will generate automatically.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              onClick={() => setActiveView('search')}
              className="text-xs font-semibold text-[#f3c5a6] hover:underline flex items-center gap-1"
            >
              <span>Explore Categories</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. "MADE FOR YOU" / PERSONALIZED DISCOVERIES
         ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#fbf6f1] tracking-tight">
              {hasHistory ? 'Made for you' : 'Trending & Popular Discoveries'}
            </h2>
            <p className="text-[11px] text-[#8f867e] mt-0.5">
              {hasHistory
                ? 'Algorithmic selections matching your unique acoustic profile and favorite genres'
                : 'Top-charting releases and trending frequencies across streaming catalogs'}
            </p>
          </div>
          <button
            onClick={() => setActiveView('search')}
            className="text-xs font-semibold text-[#8f867e] hover:text-[#f3c5a6] transition-colors"
          >
            See all
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="aspect-[16/11] rounded-2xl bg-[#161514] border border-white/[0.04] animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {madeForYouTracks.map((track) => (
              <div
                key={track.id}
                onClick={() => playTrack(track, madeForYouTracks)}
                className="group relative aspect-[16/11] rounded-2xl overflow-hidden cursor-pointer bg-[#161514] border border-white/[0.06] hover:border-[#f3c5a6]/40 transition-all shadow-lg"
              >
                <TrackArtwork
                  artworkUrl={track.artwork}
                  title={track.title}
                  artist={track.artist}
                  accentColor={track.accentColor}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                {/* Dark Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3.5 flex flex-col justify-end" />

                {/* Title & Artist */}
                <div className="absolute bottom-3 left-3 right-12 z-10">
                  <h3 className="text-xs font-bold text-white leading-tight truncate">
                    {track.title}
                  </h3>
                  <p className="text-[10px] text-[#c4b9af] truncate mt-0.5">
                    {track.artist}
                  </p>
                </div>

                {/* Floating Circular Play Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playTrack(track, madeForYouTracks);
                  }}
                  className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-white/20 backdrop-blur-md border border-white/20 text-white hover:bg-[#f3c5a6] hover:text-[#141210] hover:scale-105 flex items-center justify-center transition-all z-10 shadow"
                  title={`Play ${track.title}`}
                >
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. SPLIT ROW: "Recently played" (Left) & "Trending Tracks" (Right)
         ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Genuine Recently Played (Only shown if history exists) */}
        {recentlyPlayedTracks.length > 0 ? (
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#fbf6f1] tracking-tight">Recently played</h2>
                <p className="text-[11px] text-[#8f867e] mt-0.5">
                  Your genuine playback history across all sessions
                </p>
              </div>
              <button
                onClick={() => setActiveView('library')}
                className="text-xs font-semibold text-[#8f867e] hover:text-[#f3c5a6] transition-colors"
              >
                See all
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {recentlyPlayedTracks.slice(0, 5).map((track) => (
                <div
                  key={track.id}
                  onClick={() => playTrack(track, recentlyPlayedTracks)}
                  className="group p-2.5 rounded-2xl bg-[#141312] border border-white/[0.06] hover:border-[#f3c5a6]/30 cursor-pointer flex flex-col gap-2 transition-all shadow-md"
                >
                  <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-[#1f1d1b]">
                    <TrackArtwork
                      artworkUrl={track.artwork}
                      title={track.title}
                      artist={track.artist}
                      accentColor={track.accentColor}
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
                      {track.title}
                    </span>
                    <span className="text-[10px] text-[#8f867e] truncate mt-0.5">
                      {track.artist}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* When new user has no recent history: Show Discovery Mixes Preview */
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#fbf6f1] tracking-tight">Sonic Exploration</h2>
                <p className="text-[11px] text-[#8f867e] mt-0.5">
                  Curated soundscapes to discover your audiophile signature
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { title: 'Acoustic Calm', query: 'acoustic guitar chill melodious', desc: 'Warm intimate vocals & fingerpicked strings' },
                { title: 'Midnight Drive', query: 'late night synthwave electronic', desc: 'Deep atmospheric basslines & neon synthesizers' },
                { title: 'Cinematic Heights', query: 'cinematic soundtrack orchestra', desc: 'Epic orchestral master recordings & scores' },
                { title: 'Lo-Fi Chillhop', query: 'lo-fi beats relax study', desc: 'Mellow vinyl crackle & downtempo grooves' },
              ].map((c) => (
                <div
                  key={c.title}
                  onClick={() => handleCardSearch(c.query)}
                  className="p-4 rounded-2xl bg-[#141312] border border-white/[0.06] hover:border-[#f3c5a6]/40 cursor-pointer flex flex-col justify-between gap-3 group transition-all"
                >
                  <div>
                    <h3 className="text-sm font-bold text-[#fbf6f1] group-hover:text-[#f3c5a6] transition-colors">
                      {c.title}
                    </h3>
                    <p className="text-[11px] text-[#8f867e] mt-1">{c.desc}</p>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-mono font-semibold text-[#f3c5a6] uppercase tracking-wider">
                    <span>Explore Mix</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Right Column: Top Rated Real Tracks (5 tracks using TrackRow) */}
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

          <div className="flex flex-col gap-1.5 bg-[#141312] rounded-3xl p-2.5 border border-white/[0.06]">
            {trendingTracks.slice(0, 4).map((track, idx) => (
              <TrackRow
                key={track.id}
                track={track}
                index={idx}
                playlistContext={trendingTracks}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. "BECAUSE YOU LISTENED TO..." (Shown when similarity evidence exists)
         ───────────────────────────────────────────────────────────── */}
      {becauseYouListenedTo && becauseYouListenedTo.tracks.length > 0 && (
        <div className="flex flex-col gap-4 p-5 rounded-3xl bg-[#141312] border border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-[#f3c5a6]" />
              <div>
                <h3 className="text-base font-bold text-[#fbf6f1]">
                  Because you listened to {becauseYouListenedTo.seedTrack.title}
                </h3>
                <p className="text-[11px] text-[#8f867e]">
                  {becauseYouListenedTo.reason}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {becauseYouListenedTo.tracks.slice(0, 4).map((track) => (
              <div
                key={track.id}
                onClick={() => playTrack(track, becauseYouListenedTo.tracks)}
                className="group p-2.5 rounded-2xl bg-[#181716] border border-white/[0.04] hover:border-[#f3c5a6]/30 cursor-pointer flex flex-col gap-2 transition-all shadow-md"
              >
                <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-[#241d19]">
                  <img
                    src={track.artwork}
                    alt={track.title}
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
                    {track.title}
                  </span>
                  <span className="text-[10px] text-[#8f867e] truncate mt-0.5">
                    {track.artist}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          6. "YOUR DAILY MIXES" (Dynamic 6 mixes based on listening pattern)
         ───────────────────────────────────────────────────────────── */}
      {dailyMixes.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#fbf6f1] tracking-tight">Your Daily Mixes</h2>
              <p className="text-[11px] text-[#8f867e] mt-0.5">
                Continuously refreshed blends designed around your favorite artists, genres, and moods
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {dailyMixes.map((mix) => (
              <div
                key={mix.id}
                onClick={() => handleCardSearch(mix.query)}
                className="group p-3 rounded-2xl bg-[#141312] border border-white/[0.06] hover:border-[#f3c5a6]/30 cursor-pointer flex flex-col gap-2.5 transition-all shadow-md"
              >
                <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-[#1c1a18]">
                  <img
                    src={mix.artwork}
                    alt={mix.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <div className="w-8 h-8 rounded-full bg-[#f3c5a6] text-[#141210] flex items-center justify-center shadow">
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-[#fbf6f1] truncate group-hover:text-[#f3c5a6] transition-colors">
                    {mix.title}
                  </span>
                  <span className="text-[10px] text-[#8f867e] truncate mt-0.5">
                    {mix.subtitle}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          7. FEATURED ARTISTS & COMPOSERS (Preserving full artist navigation)
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
          8. BLOCKBUSTER SOUNDTRACKS (Leo, Jawan, Vikram, Petta)
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
                <TrackArtwork
                  artworkUrl={alb.artwork}
                  title={alb.title}
                  artist={alb.subtitle}
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
