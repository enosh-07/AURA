/**
 * AURA AuthService — Platform Abstraction
 * =========================================
 * Provides a unified authentication interface across:
 *   - Web:         Google Identity Services (GIS) SDK popup
 *   - Android:     Capacitor Google Auth plugin
 *   - iOS:         Capacitor Google Auth plugin
 *   - Desktop:     Tauri shell-based OAuth browser flow with deep-link callback
 *
 * The backend remains the authority that verifies tokens.
 * Never place backend secrets in the client.
 */

import { PLATFORM, isCapacitor, isTauri } from './platform';
import { tokenStorage } from './storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuraUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  googleId?: string;
  createdAt?: string;
}

export interface AuthResult {
  user: AuraUser;
  accessToken: string;
}

// ---------------------------------------------------------------------------
// Google OAuth helper per platform
// ---------------------------------------------------------------------------

async function googleOAuthWeb(clientId: string): Promise<{ accessToken?: string; credential?: string }> {
  // Import lazily to avoid bundling issues on native platforms
  const { GoogleAuthService } = await import('../services/googleAuth');
  const result = await GoogleAuthService.signInWithGoogleOAuth(clientId);
  return { accessToken: result.accessToken };
}

async function googleOAuthCapacitor(): Promise<{ idToken?: string; accessToken?: string; googleId?: string; email?: string; name?: string; avatarUrl?: string }> {
  // On Capacitor 8, Google Sign-In is performed via the system browser.
  // The InAppBrowser opens accounts.google.com and the result is returned
  // via a redirect to aura://oauth/callback.
  // For a production app, integrate a Capacitor 8-compatible Google Auth plugin
  // or implement the PKCE OAuth flow via @capacitor/browser.
  throw new Error(
    'Mobile Google Sign-In requires a Capacitor 8-compatible OAuth plugin. ' +
    'Please use the email/password login or configure @capacitor/browser for PKCE flow.'
  );
}

async function googleOAuthTauri(clientId: string): Promise<{ accessToken?: string; credential?: string }> {
  try {
    // Tauri uses the system browser for OAuth; deep link callback delivers the token
    const { open } = await import('@tauri-apps/plugin-shell');
    const redirectUri = 'aura://oauth/callback';
    const scope = encodeURIComponent('email profile openid');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${scope}`;

    await open(authUrl);

    // Wait for deep-link callback to deliver token via event
    const { listen } = await import('@tauri-apps/api/event');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Google OAuth timed out — no callback received within 120s'));
      }, 120_000);

      listen<string>('aura://oauth/callback', (event) => {
        clearTimeout(timeout);
        try {
          const url = new URL(event.payload);
          const params = new URLSearchParams(url.hash.slice(1) || url.search);
          const token = params.get('access_token');
          if (token) {
            resolve({ accessToken: token });
          } else {
            reject(new Error('No access_token in OAuth callback'));
          }
        } catch {
          reject(new Error('Failed to parse OAuth callback URL'));
        }
      }).catch(reject);
    });
  } catch (err: any) {
    throw new Error(`Tauri OAuth failed: ${err?.message ?? err}`);
  }
}

// ---------------------------------------------------------------------------
// AuthService
// ---------------------------------------------------------------------------

export class AuthService {
  private static apiBaseUrl: string = '';

  public static configure(apiBaseUrl: string) {
    AuthService.apiBaseUrl = apiBaseUrl;
  }

  // ---- Token management ----

  public static async getToken(): Promise<string | null> {
    return tokenStorage.getToken();
  }

  public static async setToken(token: string | null): Promise<void> {
    if (token) {
      await tokenStorage.setToken(token);
    } else {
      await tokenStorage.removeToken();
    }
  }

  // ---- Email / password login ----

  public static async login(email: string, password: string): Promise<AuthResult> {
    const res = await fetch(`${AuthService.apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Login failed');
    }
    await AuthService.setToken(json.data.accessToken);
    return json.data;
  }

  // ---- Register ----

  public static async register(name: string, email: string, password: string): Promise<AuthResult> {
    const res = await fetch(`${AuthService.apiBaseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Registration failed');
    }
    await AuthService.setToken(json.data.accessToken);
    return json.data;
  }

  // ---- Google Sign-In (platform-aware) ----

  public static async loginWithGoogle(clientId?: string): Promise<AuthResult> {
    const resolvedClientId =
      clientId ||
      (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
      null;

    let payload: Record<string, string | undefined> = {};

    if (isCapacitor) {
      payload = await googleOAuthCapacitor();
    } else if (isTauri) {
      if (!resolvedClientId) throw new Error('VITE_GOOGLE_CLIENT_ID is required for desktop Google Sign-In');
      payload = await googleOAuthTauri(resolvedClientId);
    } else {
      if (!resolvedClientId) throw new Error('VITE_GOOGLE_CLIENT_ID is required for web Google Sign-In');
      payload = await googleOAuthWeb(resolvedClientId);
    }

    const res = await fetch(`${AuthService.apiBaseUrl}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Google authentication failed');
    }
    await AuthService.setToken(json.data.accessToken);
    return json.data;
  }

  // ---- Get current user ----

  public static async getCurrentUser(): Promise<AuraUser | null> {
    const token = await AuthService.getToken();
    if (!token) return null;

    try {
      const res = await fetch(`${AuthService.apiBaseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) {
        if (res.status === 401) await AuthService.setToken(null);
        return null;
      }
      const json = await res.json();
      return json.data ?? null;
    } catch {
      return null;
    }
  }

  // ---- Refresh session ----

  public static async refreshSession(): Promise<boolean> {
    const token = await AuthService.getToken();
    if (!token) return false;
    const user = await AuthService.getCurrentUser();
    return user !== null;
  }

  // ---- Logout ----

  public static async logout(): Promise<void> {
    await AuthService.setToken(null);

    // On Capacitor, Google sign-out is handled by clearing the auth token.
    // If a Capacitor-compatible Google Auth plugin is added in the future,
    // call its signOut() method here.
  }
}
