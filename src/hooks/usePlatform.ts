/**
 * usePlatform — React hook for platform capabilities
 * =====================================================
 * Provides reactive access to the platform detection and
 * capability system throughout the React component tree.
 *
 * Usage:
 *   const { isDesktop, isMobile, capabilities } = usePlatform();
 *   if (capabilities.filePicker) { ... }
 */

import {
  PLATFORM,
  PlatformId,
  PlatformCapabilities,
  capabilities,
  isWeb,
  isMobile,
  isDesktop,
  isAndroid,
  isIOS,
  isWindows,
  isMacOS,
  isLinux,
  isCapacitor,
  isTauri,
  APP_VERSION,
} from '../platform/platform';

// The platform doesn't change at runtime, so we don't need useState/useEffect.
// These are stable references that are safe to read in any component.

export interface PlatformContext {
  platform: PlatformId;
  capabilities: PlatformCapabilities;
  isWeb: boolean;
  isMobile: boolean;
  isDesktop: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  isWindows: boolean;
  isMacOS: boolean;
  isLinux: boolean;
  isCapacitor: boolean;
  isTauri: boolean;
  appVersion: string;
  /**
   * True if the screen is in "mobile-width" regardless of platform.
   * Use for responsive layout decisions.
   */
  isMobileWidth: boolean;
}

import React, { useState, useEffect } from 'react';

export function usePlatform(): PlatformContext {
  const [mobileWidth, setMobileWidth] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setMobileWidth(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    platform: PLATFORM,
    capabilities,
    isWeb,
    isMobile,
    isDesktop,
    isAndroid,
    isIOS,
    isWindows,
    isMacOS,
    isLinux,
    isCapacitor,
    isTauri,
    appVersion: APP_VERSION,
    isMobileWidth: mobileWidth,
  };
}

/**
 * Returns true if a specific platform capability is available.
 * Use this to conditionally render platform-specific features.
 *
 * Example:
 *   const canDownload = useCapability('downloadManager');
 *   if (canDownload) <DownloadButton />
 */
export function useCapability(cap: keyof PlatformCapabilities): boolean {
  return capabilities[cap];
}
