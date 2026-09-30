import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Lock, Mail, User, ShieldCheck, ArrowRight, Loader2, KeyRound, ExternalLink, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { GoogleAuthService } from '../../services/googleAuth';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, authMode, setAuthModalOpen, login, register, googleLogin, isLoading, error, setError } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Real Google OAuth Configuration & State
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [googleClientIdInput, setGoogleClientIdInput] = useState(GoogleAuthService.getClientId() || '');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Initialize official Google button if Client ID exists
  useEffect(() => {
    const clientId = GoogleAuthService.getClientId();
    if (clientId && googleBtnRef.current && isAuthModalOpen) {
      GoogleAuthService.initGoogleButton(
        googleBtnRef.current,
        async (credential) => {
          setIsGoogleLoading(true);
          try {
            await googleLogin({ credential });
          } catch (err: any) {
            setGoogleError(err.message || 'Google authentication failed.');
          } finally {
            setIsGoogleLoading(false);
          }
        },
        clientId
      );
    }
  }, [isAuthModalOpen, showConfigModal]);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'login') {
      await login(email, password);
    } else {
      await register(name, email, password);
    }
  };

  /**
   * Triggers the real Google OAuth 2.0 Popup
   */
  const handleRealGoogleSignIn = async () => {
    const clientId = GoogleAuthService.getClientId();
    setGoogleError(null);

    // If no Google Client ID is configured yet, guide the user to configure it
    if (!clientId) {
      setShowConfigModal(true);
      return;
    }

    setIsGoogleLoading(true);
    try {
      // 1. Launch genuine Google OAuth 2.0 popup
      const { accessToken } = await GoogleAuthService.signInWithGoogleOAuth(clientId);

      // 2. Send real Google Access Token to backend for server-side verification with Google
      const success = await googleLogin({ accessToken });
      if (success) {
        setAuthModalOpen(false);
      }
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      const msg = err.message || 'Google sign-in was cancelled or failed.';
      if (msg.includes('Client ID') || msg.includes('origin') || msg.includes('registered')) {
        setGoogleError(`${msg} Please ensure http://localhost:3000 is added to Authorized JavaScript Origins in Google Cloud Console.`);
      } else {
        setGoogleError(msg);
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSaveGoogleClientId = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = googleClientIdInput.trim();
    if (!trimmed) {
      setGoogleError('Please provide a valid Google OAuth Client ID.');
      return;
    }
    GoogleAuthService.setClientId(trimmed);
    setShowConfigModal(false);
    setGoogleError(null);

    // Automatically trigger the real Google Sign-In with the newly configured Client ID
    setTimeout(() => {
      handleRealGoogleSignIn();
    }, 200);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            setAuthModalOpen(false);
            setShowConfigModal(false);
          }}
          className="absolute inset-0 bg-black/80 backdrop-blur-xl"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0c0d14]/95 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl text-white"
        >
          {/* Ambient Background Glow */}
          <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-aura-cyan/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-64 h-64 rounded-full bg-aura-violet/20 blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={() => {
              setAuthModalOpen(false);
              setShowConfigModal(false);
            }}
            className="absolute top-5 right-5 p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {showConfigModal ? (
            /* Configure Real Google OAuth Client ID */
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-xl bg-aura-cyan/10 border border-aura-cyan/30 text-aura-cyan">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Google OAuth Setup</h3>
                  <p className="text-[11px] text-white/60">Real Google Authentication via Google Cloud</p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 mb-4 text-xs text-white/80 space-y-2">
                <p className="font-semibold text-aura-cyan flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> How to connect your real Google account:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-white/70">
                  <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-aura-cyan hover:underline inline-flex items-center gap-0.5">Google Cloud Console <ExternalLink className="w-2.5 h-2.5" /></a></li>
                  <li>Create an <strong>OAuth 2.0 Client ID</strong> (Web Application)</li>
                  <li>Add Authorized JavaScript Origin: <code className="bg-black/50 px-1.5 py-0.5 rounded text-white font-mono">http://localhost:3000</code></li>
                  <li>Paste your <strong>Client ID</strong> below:</li>
                </ol>
              </div>

              <form onSubmit={handleSaveGoogleClientId} className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-mono uppercase text-white/60 mb-1">Google OAuth Client ID</label>
                  <input
                    type="text"
                    required
                    value={googleClientIdInput}
                    onChange={(e) => setGoogleClientIdInput(e.target.value)}
                    placeholder="xxxxxxxxxxxx-xxxxxxxx.apps.googleusercontent.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-aura-cyan font-mono"
                  />
                </div>

                {googleError && (
                  <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{googleError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-aura-cyan to-aura-violet text-black font-bold text-xs hover:opacity-95 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-aura-cyan/20"
                >
                  <CheckCircle2 className="w-4 h-4" /> Save Client ID & Sign In with Google
                </button>

                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="text-center text-xs text-white/50 hover:text-white mt-1"
                >
                  Back to standard login
                </button>
              </form>
            </div>
          ) : (
            /* Main Authentication View */
            <>
              {/* Header */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-aura-cyan/10 border border-aura-cyan/30 text-aura-cyan text-xs font-mono font-medium mb-3">
                  <Sparkles className="w-3.5 h-3.5" /> AURA Cloud Sync
                </div>
                <h2 className="text-2xl font-black tracking-tight text-white">
                  {authMode === 'login' ? 'Welcome Back' : 'Create AURA Account'}
                </h2>
                <p className="text-xs text-white/60 mt-1">
                  Sync your lossless playback, 10-band EQ presets & playlists across devices in real time.
                </p>
              </div>

              {/* Real Google Sign-In Button */}
              <div className="mb-4">
                <button
                  type="button"
                  onClick={handleRealGoogleSignIn}
                  disabled={isLoading || isGoogleLoading}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-2xl bg-white hover:bg-neutral-100 text-neutral-800 font-semibold text-xs sm:text-sm transition-all shadow-md active:scale-[0.99] border border-neutral-300 group disabled:opacity-60"
                >
                  {isGoogleLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-neutral-700" />
                  ) : (
                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                  )}
                  <span>Continue with Google</span>
                </button>

                {/* Container for official Google GSI Button if rendered */}
                <div ref={googleBtnRef} className="mt-2 flex justify-center empty:hidden" />
              </div>

              {googleError && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center justify-between gap-2">
                  <span>{googleError}</span>
                  <button
                    type="button"
                    onClick={() => setShowConfigModal(true)}
                    className="underline text-aura-cyan text-[11px] whitespace-nowrap"
                  >
                    Setup Client ID
                  </button>
                </div>
              )}

              <div className="relative flex items-center justify-center mb-5">
                <div className="border-t border-white/10 w-full" />
                <span className="bg-[#0c0d14] px-3 text-[11px] font-mono uppercase tracking-wider text-white/40">
                  or email login
                </span>
                <div className="border-t border-white/10 w-full" />
              </div>

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2"
                >
                  <span>{error}</span>
                </motion.div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {authMode === 'register' && (
                  <div>
                    <label className="block text-xs font-mono uppercase text-white/60 mb-1.5">Your Name</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your Name"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-aura-cyan focus:ring-1 focus:ring-aura-cyan transition-all"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-mono uppercase text-white/60 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-aura-cyan focus:ring-1 focus:ring-aura-cyan transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-white/60 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-aura-cyan focus:ring-1 focus:ring-aura-cyan transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-aura-cyan to-aura-violet text-black font-bold text-sm shadow-lg shadow-aura-cyan/25 hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                  ) : authMode === 'login' ? (
                    'Sign In to AURA'
                  ) : (
                    'Create Account'
                  )}
                </button>
              </form>

              {/* Toggle Login / Register */}
              <div className="mt-5 text-center flex items-center justify-center gap-1.5 text-xs text-white/60">
                {authMode === 'login' ? (
                  <>
                    <span>Don't have an account yet?</span>
                    <button
                      type="button"
                      onClick={() => setAuthModalOpen(true, 'register')}
                      className="text-aura-cyan font-semibold hover:underline"
                    >
                      Create one
                    </button>
                  </>
                ) : (
                  <>
                    <span>Already have an account?</span>
                    <button
                      type="button"
                      onClick={() => setAuthModalOpen(true, 'login')}
                      className="text-aura-cyan font-semibold hover:underline"
                    >
                      Sign In
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
