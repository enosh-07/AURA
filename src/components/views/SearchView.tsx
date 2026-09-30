import React, { useState, useEffect } from 'react';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useUIStore } from '../../stores/useUIStore';
import { useAudioStore } from '../../stores/useAudioStore';
import { apiClient } from '../../services/apiClient';
import { Track, Artist, Album } from '../../types/audio';
import { TrackRow } from '../common/TrackRow';
import {
  Search,
  Disc,
  Users,
  ListMusic,
  Globe2,
  Sparkles,
  Play,
  BadgeCheck,
  Languages,
  Flame,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

const LANGUAGES = ['All', 'Tamil', 'Hindi', 'Telugu', 'English', 'Punjabi', 'Malayalam'] as const;

const POPULAR_SEARCH_CHIPS = [
  { label: 'Anirudh Ravichander', type: 'artist' },
  { label: 'Leo Soundtrack', type: 'album' },
  { label: 'Thalapathy Vijay', type: 'artist' },
  { label: 'A.R. Rahman', type: 'artist' },
  { label: 'Jailer', type: 'album' },
  { label: 'Vikram', type: 'album' },
  { label: 'Arijit Singh', type: 'artist' },
  { label: 'The Weeknd', type: 'artist' },
];

export const SearchView: React.FC = () => {
  const allTracks = useLibraryStore((state) => state.allTracks);
  const searchQuery = useUIStore((state) => state.searchQuery);
  const setSearchQuery = useUIStore((state) => state.setSearchQuery);
  const selectedLanguage = useUIStore((state) => state.selectedLanguage);
  const setSelectedLanguage = useUIStore((state) => state.setSelectedLanguage);
  const openArtistView = useUIStore((state) => state.openArtistView);
  const openAlbumView = useUIStore((state) => state.openAlbumView);
  const playTrack = useAudioStore((state) => state.playTrack);
  const currentTrack = useAudioStore((state) => state.currentTrack);

  const [filterType, setFilterType] = useState<'all' | 'songs' | 'artists' | 'albums'>('all');
  const [onlineTracks, setOnlineTracks] = useState<Track[]>([]);
  const [onlineArtists, setOnlineArtists] = useState<Artist[]>([]);
  const [onlineAlbums, setOnlineAlbums] = useState<Album[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);

  const query = searchQuery.trim();

  useEffect(() => {
    if (!query) {
      setOnlineTracks([]);
      setOnlineArtists([]);
      setOnlineAlbums([]);
      return;
    }

    const timer = setTimeout(() => {
      setIsSearchingOnline(true);
      apiClient
        .searchOnlineCatalog(query, selectedLanguage, 25)
        .then((res) => {
          setOnlineTracks(res.tracks || []);
          setOnlineArtists(res.artists || []);
          setOnlineAlbums(res.albums || []);
        })
        .catch((err) => console.error('Online catalog search error:', err))
        .finally(() => setIsSearchingOnline(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [query, selectedLanguage]);

  // Top result candidate: best matching artist, album, or song
  const topArtist = onlineArtists[0];
  const topAlbum = onlineAlbums[0];
  const topTrack = onlineTracks[0];

  return (
    <div className="flex flex-col gap-7 pb-32 animate-in fade-in duration-300">
      {/* Header & Language Bar */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-aura-cyan font-bold flex items-center gap-1.5 mb-1">
            <Globe2 className="w-3.5 h-3.5 animate-pulse" /> Universal Sonic Search
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Explore Artists, Albums & Music
          </h1>
          <p className="text-xs sm:text-sm text-aura-muted mt-1">
            Search songs across Tamil, Hindi, Telugu, Punjabi, Malayalam, and Global streaming charts.
          </p>
        </div>

        {/* Language Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-2xl border border-white/5 overflow-x-auto max-w-full scrollbar-none">
          <Languages className="w-3.5 h-3.5 text-aura-cyan ml-2 flex-shrink-0" />
          {LANGUAGES.map((lang) => {
            const isSelected = selectedLanguage === lang;
            return (
              <button
                key={lang}
                onClick={() => setSelectedLanguage(lang)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-aura-cyan text-aura-void font-bold shadow-glow-cyan/20'
                    : 'text-aura-muted hover:text-white hover:bg-white/5'
                }`}
              >
                {lang}
              </button>
            );
          })}
        </div>
      </div>

      {/* Popular Quick Search Chips */}
      {!query && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-mono text-aura-muted uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-aura-cyan" /> Popular Indian & Global Searches
          </span>
          <div className="flex flex-wrap gap-2">
            {POPULAR_SEARCH_CHIPS.map((chip) => (
              <button
                key={chip.label}
                onClick={() => setSearchQuery(chip.label)}
                className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-aura-cyan/40 text-xs font-medium text-slate-300 hover:text-white transition-all flex items-center gap-1.5 group"
              >
                <span>{chip.label}</span>
                <ArrowRight className="w-3 h-3 text-aura-muted group-hover:text-aura-cyan group-hover:translate-x-0.5 transition-all" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter Tabs (when query is active) */}
      {query && (
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-2xl border border-white/5">
            {(['all', 'songs', 'artists', 'albums'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                  filterType === type
                    ? 'bg-gradient-to-r from-aura-cyan to-aura-violet text-aura-void font-bold shadow-glow-cyan/20'
                    : 'text-aura-muted hover:text-white'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {isSearchingOnline && (
              <span className="text-[11px] font-mono text-aura-cyan animate-pulse flex items-center gap-1">
                <Globe2 className="w-3.5 h-3.5 animate-spin" /> Searching iTunes & Catalog...
              </span>
            )}
            <span className="text-xs font-mono text-aura-muted">
              {onlineTracks.length} songs • {onlineArtists.length} artists • {onlineAlbums.length} albums
            </span>
          </div>
        </div>
      )}

      {/* SPOTLIGHT: Top Result Hero (When search query active and in 'all' view) */}
      {query && filterType === 'all' && (topArtist || topAlbum) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Top Artist Spotlight Card */}
          {topArtist && (
            <div
              onClick={() => openArtistView(topArtist.id)}
              className="p-5 rounded-3xl aura-glass aura-card-interactive border border-white/10 cursor-pointer flex items-center gap-5 relative overflow-hidden group shadow-xl"
            >
              <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-aura-cyan/20 blur-[80px] pointer-events-none" />
              <div className="relative w-24 h-24 rounded-full overflow-hidden shadow-2xl ring-2 ring-aura-cyan/40 bg-aura-void flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
                <img src={topArtist.avatar} alt={topArtist.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="px-2.5 py-0.5 rounded-full bg-aura-cyan/15 text-aura-cyan text-[10px] font-bold uppercase tracking-wider border border-aura-cyan/30 self-start flex items-center gap-1 mb-1">
                  <BadgeCheck className="w-3 h-3 text-aura-cyan" /> Artist
                </span>
                <h3 className="text-xl font-black text-white truncate group-hover:text-aura-cyan transition-colors">
                  {topArtist.name}
                </h3>
                <p className="text-xs text-aura-muted font-mono mt-0.5">{topArtist.genre}</p>
                <div className="flex items-center gap-2 mt-2 text-xs font-bold text-aura-cyan group-hover:translate-x-1 transition-transform">
                  <span>View Artist Discography</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          )}

          {/* Top Album Spotlight Card */}
          {topAlbum && (
            <div
              onClick={() => openAlbumView(topAlbum.id)}
              className="p-5 rounded-3xl aura-glass aura-card-interactive border border-white/10 cursor-pointer flex items-center gap-5 relative overflow-hidden group shadow-xl"
            >
              <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-aura-violet/20 blur-[80px] pointer-events-none" />
              <div className="relative w-24 h-24 rounded-2xl overflow-hidden shadow-2xl ring-2 ring-aura-violet/40 bg-aura-void flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
                <img src={topAlbum.artwork} alt={topAlbum.title} className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="px-2.5 py-0.5 rounded-full bg-aura-violet/20 text-aura-violet text-[10px] font-bold uppercase tracking-wider border border-aura-violet/30 self-start flex items-center gap-1 mb-1">
                  <Disc className="w-3 h-3 text-aura-violet" /> Album
                </span>
                <h3 className="text-xl font-black text-white truncate group-hover:text-aura-violet transition-colors">
                  {topAlbum.title}
                </h3>
                <p className="text-xs text-aura-muted font-mono mt-0.5">
                  {topAlbum.artist} • {topAlbum.year}
                </p>
                <div className="flex items-center gap-2 mt-2 text-xs font-bold text-aura-violet group-hover:translate-x-1 transition-transform">
                  <span>View Album Tracklist</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ARTISTS SECTION */}
      {query && (filterType === 'all' || filterType === 'artists') && onlineArtists.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Users className="w-4 h-4 text-aura-cyan" /> Artists & Producers
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {onlineArtists.map((art) => (
              <div
                key={art.id}
                onClick={() => openArtistView(art.id)}
                className="group p-4 rounded-2xl aura-glass aura-card-interactive cursor-pointer flex flex-col items-center text-center gap-3 relative shadow-lg"
              >
                <div className="relative w-20 h-20 rounded-full overflow-hidden shadow-xl ring-2 ring-aura-cyan/30 bg-aura-void group-hover:scale-105 transition-transform duration-300">
                  <img src={art.avatar} alt={art.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col min-w-0 w-full items-center">
                  <div className="flex items-center gap-1 justify-center max-w-full">
                    <span className="text-xs font-bold text-white truncate group-hover:text-aura-cyan transition-colors">
                      {art.name}
                    </span>
                    <BadgeCheck className="w-3.5 h-3.5 text-aura-cyan flex-shrink-0" />
                  </div>
                  <span className="text-[10px] font-mono text-aura-muted truncate mt-0.5">
                    {art.genre}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ALBUMS SECTION */}
      {query && (filterType === 'all' || filterType === 'albums') && onlineAlbums.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Disc className="w-4 h-4 text-aura-violet" /> Albums & Soundtracks
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {onlineAlbums.map((alb) => (
              <div
                key={alb.id}
                onClick={() => openAlbumView(alb.id)}
                className="group p-3 rounded-2xl aura-glass aura-card-interactive cursor-pointer flex flex-col gap-2 relative shadow-lg"
              >
                <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-aura-void">
                  <img
                    src={alb.artwork}
                    alt={alb.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <div className="w-9 h-9 rounded-full bg-aura-violet text-white flex items-center justify-center shadow-lg">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col min-w-0">
                  <h4 className="text-xs font-bold text-white truncate group-hover:text-aura-violet transition-colors">
                    {alb.title}
                  </h4>
                  <p className="text-[11px] text-aura-muted truncate">{alb.artist}</p>
                  <span className="text-[10px] font-mono text-aura-muted">{alb.year}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SONGS / TRACKS SECTION */}
      {query && (filterType === 'all' || filterType === 'songs') && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-aura-cyan animate-pulse" /> Songs & Singles
          </h3>

          <div className="flex flex-col gap-1 bg-aura-card/40 rounded-3xl p-3 border border-aura-border">
            {onlineTracks.length > 0 ? (
              onlineTracks.map((track, idx) => (
                <TrackRow key={track.id} track={track} index={idx} playlistContext={onlineTracks} />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-aura-muted gap-3">
                <Search className="w-10 h-10 opacity-30 text-aura-cyan" />
                <p className="text-sm font-semibold text-slate-300">No matching online tracks</p>
                <p className="text-xs">Try searching for an artist name like Anirudh or album like Leo.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EMPTY / INITIAL EXPLORE STATE */}
      {!query && (
        <div className="flex flex-col gap-6">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Browse Regional & Global Music Portals
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                title: 'Tamil Cinema & Pop',
                query: 'anirudh vijay tamil hits',
                gradient: 'from-amber-600 via-orange-600 to-rose-700',
                desc: 'Leo, Jailer, Vikram, Master & evergreen hits',
              },
              {
                title: 'Bollywood & Hindi Hits',
                query: 'arijit singh hindi bollywood',
                gradient: 'from-pink-600 via-rose-600 to-purple-800',
                desc: 'Arijit Singh, Pritam, modern romance & dance anthems',
              },
              {
                title: 'Telugu Tollywood Wave',
                query: 'pushpa thaman telugu hits',
                gradient: 'from-purple-700 via-indigo-700 to-cyan-700',
                desc: 'Thaman S, Devi Sri Prasad, Sid Sriram chartbusters',
              },
              {
                title: 'Punjabi Beats & Trap',
                query: 'punjabi hits sidhu diljit',
                gradient: 'from-emerald-600 via-teal-700 to-slate-800',
                desc: 'Sidhu Moosewala, Diljit Dosanjh, Karan Aujla energetic trap',
              },
              {
                title: 'Malayalam Mollywood Hits',
                query: 'malayalam sushin shyam',
                gradient: 'from-cyan-700 via-blue-800 to-indigo-900',
                desc: 'Sushin Shyam, electronic Malayalam melodies',
              },
              {
                title: 'Global Billboard Hot 100',
                query: 'billboard hot hits the weeknd',
                gradient: 'from-fuchsia-700 via-purple-900 to-slate-950',
                desc: 'The Weeknd, Dua Lipa, Drake, synthwave & pop',
              },
            ].map((card) => (
              <div
                key={card.title}
                onClick={() => setSearchQuery(card.query)}
                className={`h-32 rounded-3xl p-5 flex flex-col justify-between cursor-pointer transition-all bg-gradient-to-br ${card.gradient} hover:scale-102 hover:shadow-2xl shadow-lg border border-white/10`}
              >
                <div>
                  <h3 className="text-base font-extrabold text-white tracking-tight">
                    {card.title}
                  </h3>
                  <p className="text-xs text-white/80 mt-1 line-clamp-1">{card.desc}</p>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-bold text-white uppercase tracking-wider">
                  <span>Explore Catalog</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
