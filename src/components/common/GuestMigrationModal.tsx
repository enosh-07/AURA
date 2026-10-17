import React, { useState, useEffect } from 'react';
import { Sparkles, X, CheckCircle2, ArrowRight, Music, ListMusic, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { idbService } from '../../services/idbStorage';

export const GuestMigrationModal: React.FC = () => {
  const { user, isAuthenticated } = useAuthStore();
  const { migrateGuestDataToServer } = useLibraryStore();

  const [isOpen, setIsOpen] = useState(false);
  const [guestLikesCount, setGuestLikesCount] = useState(0);
  const [guestPlaylistsCount, setGuestPlaylistsCount] = useState(0);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{
    migratedLikes: number;
    migratedPlaylists: number;
    success: boolean;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkGuestData() {
      if (!isAuthenticated || !user) {
        setIsOpen(false);
        return;
      }

      // Check if user already dismissed migration in this browser session
      const dismissed = sessionStorage.getItem(`aura_migration_dismissed_${user.id}`);
      if (dismissed) return;

      try {
        const hasData = await idbService.hasGuestData();
        if (hasData && isMounted) {
          const [likes, playlists] = await Promise.all([
            idbService.getGuestLikedSongIds(),
            idbService.getGuestPlaylists(),
          ]);
          if ((likes.length > 0 || playlists.length > 0) && isMounted) {
            setGuestLikesCount(likes.length);
            setGuestPlaylistsCount(playlists.length);
            setIsOpen(true);
          }
        }
      } catch (err) {
        console.warn('Error checking guest data for migration:', err);
      }
    }

    checkGuestData();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, user?.id]);

  const handleDismiss = () => {
    if (user?.id) {
      sessionStorage.setItem(`aura_migration_dismissed_${user.id}`, 'true');
    }
    setIsOpen(false);
  };

  const handleMigrate = async () => {
    setIsMigrating(true);
    try {
      const result = await migrateGuestDataToServer();
      setMigrationResult(result);
      if (result.success && user?.id) {
        sessionStorage.setItem(`aura_migration_dismissed_${user.id}`, 'true');
      }
    } catch (err) {
      setMigrationResult({
        migratedLikes: 0,
        migratedPlaylists: 0,
        success: false,
      });
    } finally {
      setIsMigrating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-gradient-to-b from-neutral-900 via-neutral-900/95 to-black p-6 border border-white/10 shadow-2xl">
        {/* Glow Accent */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-aura-cyan/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-aura-accent/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-aura-accent/10 text-aura-accent border border-aura-accent/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Import Guest Library</h3>
                <p className="text-xs text-neutral-400">Merge local music into your account</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              disabled={isMigrating}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {migrationResult ? (
            <div className="py-6 text-center">
              {migrationResult.success ? (
                <>
                  <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="text-lg font-semibold text-white mb-1">Library Synchronized!</h4>
                  <p className="text-sm text-neutral-300 max-w-xs mx-auto mb-4">
                    Successfully imported {migrationResult.migratedLikes} liked tracks and{' '}
                    {migrationResult.migratedPlaylists} playlists into <b>{user?.name}</b>.
                  </p>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-aura-accent to-aura-cyan text-black font-semibold hover:opacity-90 transition-opacity"
                  >
                    Done
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-rose-400 mb-4">
                    Migration encountered an issue. Local items have been safely retained.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleMigrate}
                      className="flex-1 py-2 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
                    >
                      Retry
                    </button>
                    <button
                      onClick={handleDismiss}
                      className="flex-1 py-2 rounded-xl bg-neutral-800 text-neutral-400 font-medium hover:text-white transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="py-4">
              <p className="text-sm text-neutral-300 mb-4 leading-relaxed">
                We detected music saved on this device during your guest session. Would you like to merge them into your permanent account (<b>{user?.name}</b>)?
              </p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                  <Music className="w-5 h-5 text-aura-accent" />
                  <div>
                    <div className="text-lg font-bold text-white">{guestLikesCount}</div>
                    <div className="text-xs text-neutral-400">Liked Songs</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                  <ListMusic className="w-5 h-5 text-aura-cyan" />
                  <div>
                    <div className="text-lg font-bold text-white">{guestPlaylistsCount}</div>
                    <div className="text-xs text-neutral-400">Playlists</div>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-aura-cyan/5 border border-aura-cyan/15 text-xs text-aura-cyan/90 mb-5 leading-normal">
                ✓ Non-destructive: Duplicates will be safely skipped. Local guest cache is only cleared after server confirmation.
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleDismiss}
                  disabled={isMigrating}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-neutral-300 hover:text-white hover:bg-white/5 font-medium text-sm transition-colors"
                >
                  Keep Separate
                </button>
                <button
                  type="button"
                  onClick={handleMigrate}
                  disabled={isMigrating}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-aura-accent to-aura-cyan text-black font-semibold text-sm hover:opacity-95 transition-opacity flex items-center justify-center gap-2"
                >
                  {isMigrating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      Import Now
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
