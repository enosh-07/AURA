/**
 * AURA Share — Platform Abstraction
 * ===================================
 * Unified sharing across:
 *   - Mobile:  Capacitor Share plugin (native system share sheet on iOS/Android)
 *   - Web:     navigator.share (Web Share API) or clipboard fallback
 *   - Desktop: Clipboard copy fallback
 */

import { isCapacitor, isWeb } from './platform';

export interface ShareOptions {
  title: string;
  text?: string;
  url?: string;
  dialogTitle?: string;
}

export async function shareContent(options: ShareOptions): Promise<boolean> {
  // Mobile (Capacitor)
  if (isCapacitor) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({
        title: options.title,
        text: options.text,
        url: options.url,
        dialogTitle: options.dialogTitle ?? 'Share Track',
      });
      return true;
    } catch (e) {
      console.warn('Capacitor Share failed:', e);
    }
  }

  // Web Share API (Mobile web & modern desktop browsers supporting it)
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: options.title,
        text: options.text,
        url: options.url,
      });
      return true;
    } catch (e) {
      // User cancelled or not supported
    }
  }

  // Fallback: Copy URL or text to clipboard
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    const textToCopy = options.url ? `${options.title} - ${options.url}` : (options.text || options.title);
    await navigator.clipboard.writeText(textToCopy);
    return true;
  }

  return false;
}
