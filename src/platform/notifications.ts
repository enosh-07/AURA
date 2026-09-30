/**
 * AURA Notifications — Platform Abstraction
 * ===========================================
 * Unified notification API across:
 *   - Web:         Browser Notifications API (with permission prompt)
 *   - Android:     Capacitor Local Notifications
 *   - iOS:         Capacitor Local Notifications
 *   - Desktop:     Tauri notification plugin
 *
 * Only use for playback events (new track, download complete, etc.)
 * NOT for media controls — those live in platform/mediaControls.ts
 */

import { isCapacitor, isTauri, capabilities } from './platform';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuraNotification {
  id?: number;
  title: string;
  body: string;
  icon?: string;          // URL or local path
  /** Auto-dismiss after ms (web only) */
  autoClose?: number;
}

// ---------------------------------------------------------------------------
// Permission check/request
// ---------------------------------------------------------------------------

export async function requestNotificationPermission(): Promise<boolean> {
  if (!capabilities.nativeNotifications) return false;

  if (isCapacitor) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const perm = await LocalNotifications.requestPermissions();
    return perm.display === 'granted';
  }

  if (isTauri) {
    // Tauri notifications don't require permission prompt on most OS
    return true;
  }

  // Web
  if ('Notification' in window) {
    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  return false;
}

// ---------------------------------------------------------------------------
// Send a notification
// ---------------------------------------------------------------------------

let _webNotification: Notification | null = null;

export async function sendNotification(n: AuraNotification): Promise<void> {
  if (!capabilities.nativeNotifications) return;

  if (isCapacitor) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.schedule({
      notifications: [
        {
          id: n.id ?? Math.floor(Math.random() * 100000),
          title: n.title,
          body: n.body,
          smallIcon: 'notification',
          iconColor: '#00f2fe',
        },
      ],
    });
    return;
  }

  if (isTauri) {
    const { sendNotification: tauriNotify } = await import('@tauri-apps/plugin-notification');
    await tauriNotify({ title: n.title, body: n.body });
    return;
  }

  // Web Notification API
  if ('Notification' in window && Notification.permission === 'granted') {
    _webNotification?.close();
    _webNotification = new Notification(n.title, {
      body: n.body,
      icon: n.icon ?? '/favicon.ico',
      silent: true,
    });
    if (n.autoClose) {
      setTimeout(() => _webNotification?.close(), n.autoClose);
    }
  }
}

// ---------------------------------------------------------------------------
// Cancel a notification by ID
// ---------------------------------------------------------------------------

export async function cancelNotification(id: number): Promise<void> {
  if (!isCapacitor) {
    _webNotification?.close();
    return;
  }
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.cancel({ notifications: [{ id }] });
}
