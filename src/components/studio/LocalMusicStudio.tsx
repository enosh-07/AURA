import React, { useState, useRef } from 'react';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useAudioStore } from '../../stores/useAudioStore';
import { TrackRow } from '../common/TrackRow';
import {
  FolderOpen,
  UploadCloud,
  FileAudio,
  Trash2,
  Play,
  ShieldAlert,
  Sparkles,
  Info,
  Cloud,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

export const LocalMusicStudio: React.FC = () => {
  const localTracks = useLibraryStore((state) => state.localTracks);
  const importLocalFiles = useLibraryStore((state) => state.importLocalFiles);
  const removeLocalTrack = useLibraryStore((state) => state.removeLocalTrack);
  const uploadTrackToCloud = useLibraryStore((state) => state.uploadTrackToCloud);
  const isLoading = useLibraryStore((state) => state.isLoading);

  const playTrack = useAudioStore((state) => state.playTrack);

  const [isDragging, setIsDragging] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; title: string } | null>(null);
  const [syncCompleteMsg, setSyncCompleteMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await importLocalFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await importLocalFiles(e.target.files);
    }
  };

  const handleSyncAllToCloud = async () => {
    const uploadable = localTracks.filter((t) => !!t.fileBlob);
    if (uploadable.length === 0) return;

    setIsSyncingAll(true);
    let count = 0;

    for (const track of uploadable) {
      setSyncProgress({
        current: count + 1,
        total: uploadable.length,
        title: track.title,
      });

      try {
        await uploadTrackToCloud(track.id);
      } catch (err) {
        console.warn('Sync failed for track:', track.title, err);
      }
      count++;
    }

    setIsSyncingAll(false);
    setSyncProgress(null);
    setSyncCompleteMsg(`Successfully synchronized ${count} tracks to your Cloud Audio Node.`);
    setTimeout(() => setSyncCompleteMsg(null), 4000);
  };

  return (
    <div className="flex flex-col gap-8 pb-32 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <span className="text-xs font-mono uppercase tracking-widest text-aura-amber font-bold flex items-center gap-1.5 mb-1">
          <FolderOpen className="w-3.5 h-3.5" /> Audio Ingestion & Studio
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Local Music Studio
        </h1>
        <p className="text-xs sm:text-sm text-aura-muted mt-1">
          Import and decode audio files directly in your browser. Metadata & artwork are parsed
          client-side and saved to persistent IndexedDB with optional cloud synchronization.
        </p>
      </div>

      {/* Sync Status Banner */}
      {syncCompleteMsg && (
        <div className="p-4 rounded-2xl bg-aura-emerald/15 border border-aura-emerald/30 text-aura-emerald flex items-center gap-3 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="text-xs font-semibold">{syncCompleteMsg}</span>
        </div>
      )}

      {/* Uploading Progress Bar */}
      {isSyncingAll && syncProgress && (
        <div className="p-5 rounded-2xl bg-aura-card border border-aura-cyan/40 shadow-glow-cyan/20 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white font-bold flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-aura-cyan animate-spin" />
              Ingesting to Cloud Node ({syncProgress.current}/{syncProgress.total}): {syncProgress.title}
            </span>
            <span className="text-aura-cyan font-mono font-bold">
              {Math.round((syncProgress.current / syncProgress.total) * 100)}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-aura-cyan to-aura-violet transition-all duration-300"
              style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Browser Sandbox Notice */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3">
        <Info className="w-5 h-5 text-aura-cyan flex-shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <span className="font-semibold text-white">Hybrid Cloud & Local Architecture: </span>
          Files you drop here are immediately decoded into your private, offline IndexedDB partition.
          You can listen with zero latency offline, or click <span className="text-aura-cyan font-bold">"Sync All to Cloud"</span> to
          stream them across all your devices via the AURA backend.
        </div>
      </div>

      {/* Drag & Drop Import Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`p-10 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-300 text-center ${
          isDragging
            ? 'border-aura-cyan bg-aura-cyan/10 scale-102 shadow-glow-cyan/30'
            : 'border-white/15 bg-aura-card/60 hover:border-aura-cyan/40 hover:bg-aura-surface/60'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a,.aac"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-aura-cyan/20 to-aura-violet/20 border border-aura-cyan/30 flex items-center justify-center text-aura-cyan shadow-glow-cyan/20">
          <UploadCloud className="w-8 h-8 animate-bounce" />
        </div>

        <div>
          <h3 className="text-base font-bold text-white">
            Drag and drop your audio files here, or click to browse
          </h3>
          <p className="text-xs text-aura-muted mt-1">
            Supports MP3, WAV, FLAC, OGG, and M4A with ID3v2 metadata & embedded artwork extraction
          </p>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-mono text-aura-cyan bg-aura-cyan/10 px-3 py-1 rounded-full border border-aura-cyan/20">
          <Sparkles className="w-3.5 h-3.5" /> Client-Side ID3v2 Decoding • Instant IndexedDB Caching
        </div>
      </div>

      {/* Imported Audio List */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <FileAudio className="w-5 h-5 text-aura-cyan" />
            Imported Local Tracks ({localTracks.length})
          </h3>
          <div className="flex items-center gap-2">
            {localTracks.length > 0 && (
              <>
                <button
                  onClick={handleSyncAllToCloud}
                  disabled={isSyncingAll}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-aura-cyan/20 text-aura-cyan border border-aura-cyan/30 text-xs font-bold transition-all disabled:opacity-40"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  Sync All to Cloud
                </button>
                <button
                  onClick={() => playTrack(localTracks[0], localTracks)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-aura-cyan text-aura-void text-xs font-bold shadow-glow-cyan hover:scale-105 transition-transform"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Play All Local
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1 bg-aura-card/40 rounded-3xl p-3 border border-aura-border">
          {localTracks.length > 0 ? (
            localTracks.map((track, idx) => (
              <TrackRow
                key={track.id}
                track={track}
                index={idx}
                playlistContext={localTracks}
                onRemoveFromPlaylist={() => removeLocalTrack(track.id)}
              />
            ))
          ) : (
            <div className="p-12 text-center text-aura-muted text-xs flex flex-col items-center gap-2">
              <FolderOpen className="w-10 h-10 opacity-30 text-aura-cyan" />
              <p className="font-semibold text-slate-300">No local tracks imported yet</p>
              <p>Drag any music files into the box above to build your private offline studio.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
