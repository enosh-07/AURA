/**
 * Real Google Authentication Service
 * Integrates with Google Identity Services (GIS) SDK
 * https://accounts.google.com/gsi/client
 */

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with';
              shape?: 'rectangular' | 'pill' | 'circle';
              logo_alignment?: 'left' | 'center';
              width?: number;
            }
          ) => void;
          prompt: (momentListener?: (notification: any) => void) => void;
        };
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: any }) => void;
          }) => {
            requestAccessToken: () => void;
          };
        };
      };
    };
  }
}

export class GoogleAuthService {
  private static STORAGE_KEY = 'aura_google_client_id';

  public static getClientId(): string | null {
    const envClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
    if (envClientId && envClientId.trim().length > 0) {
      return envClientId.trim();
    }
    return localStorage.getItem(this.STORAGE_KEY) || null;
  }

  public static setClientId(clientId: string): void {
    if (clientId && clientId.trim()) {
      localStorage.setItem(this.STORAGE_KEY, clientId.trim());
    } else {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }

  /**
   * Waits for Google Identity Services script to be loaded
   */
  public static async waitForGoogleSDK(timeoutMs = 5000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (typeof window !== 'undefined' && window.google?.accounts?.oauth2) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return !!window.google?.accounts?.oauth2;
  }

  /**
   * Opens Google's official OAuth 2.0 popup dialog
   */
  public static async signInWithGoogleOAuth(clientIdOverride?: string): Promise<{ accessToken: string }> {
    const clientId = clientIdOverride || this.getClientId();
    if (!clientId) {
      throw new Error('Google OAuth Client ID is required to launch real Google authentication.');
    }

    const loaded = await this.waitForGoogleSDK();
    if (!loaded || !window.google?.accounts?.oauth2) {
      throw new Error('Google Identity Services SDK could not be loaded from https://accounts.google.com/gsi/client.');
    }

    return new Promise((resolve, reject) => {
      try {
        const client = window.google!.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'email profile openid',
          callback: (response) => {
            if (response.error) {
              reject(new Error(response.error.message || response.error || 'Google Sign-In was cancelled or failed.'));
              return;
            }
            if (!response.access_token) {
              reject(new Error('No access token received from Google.'));
              return;
            }
            resolve({ accessToken: response.access_token });
          },
        });

        // Triggers the official Google accounts.google.com authentication popup
        client.requestAccessToken();
      } catch (err: any) {
        reject(err);
      }
    });
  }

  /**
   * Initializes Google One-Tap or Google Button in a container element
   */
  public static initGoogleButton(
    container: HTMLElement,
    onSuccess: (credential: string) => void,
    clientIdOverride?: string
  ): boolean {
    const clientId = clientIdOverride || this.getClientId();
    if (!clientId || !window.google?.accounts?.id) return false;

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (res) => {
          if (res?.credential) {
            onSuccess(res.credential);
          }
        },
      });

      window.google.accounts.id.renderButton(container, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width: 320,
      });

      return true;
    } catch (e) {
      console.warn('Failed to render official Google button:', e);
      return false;
    }
  }
}
