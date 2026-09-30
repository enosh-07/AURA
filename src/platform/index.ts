/**
 * AURA Platform — Public Index
 * ==============================
 * Single import point for all platform abstractions.
 *
 * Usage in components/services:
 *   import { platform, capabilities, mediaControls, DownloadManager } from '../platform';
 *
 * Never import from individual platform/*.ts files in components.
 * Always import through this index so that refactoring stays centralised.
 */

export {
  PLATFORM,
  capabilities,
  isWeb,
  isAndroid,
  isIOS,
  isMobile,
  isWindows,
  isMacOS,
  isLinux,
  isDesktop,
  isCapacitor,
  isTauri,
  APP_VERSION,
} from './platform';

export type { PlatformId, PlatformCapabilities } from './platform';

export { platformStorage, tokenStorage } from './storage';

export { AuthService } from './auth';
export type { AuraUser, AuthResult } from './auth';

export { mediaControls } from './mediaControls';
export type { MediaControlHandlers, MediaMetadataUpdate } from './mediaControls';

export {
  activateBackgroundPlayback,
  deactivateBackgroundPlayback,
  registerAppLifecycleListeners,
  removeAppLifecycleListeners,
  setBackgroundPlaybackCallbacks,
} from './backgroundPlayback';

export type { BackgroundPlaybackState } from './backgroundPlayback';

export {
  pickAudioFiles,
  readFileAsBlobUrl,
  writeDownloadedFile,
  deleteLocalFile,
  revealInFinder,
  SUPPORTED_AUDIO_EXTENSIONS,
  SUPPORTED_AUDIO_MIMETYPES,
} from './filesystem';

export type { LocalFile } from './filesystem';

export { DownloadManager } from './downloads';
export type { DownloadRecord, DownloadStatus } from './downloads';

export {
  requestNotificationPermission,
  sendNotification,
  cancelNotification,
} from './notifications';

export type { AuraNotification } from './notifications';

export {
  registerDeepLinkListeners,
  addDeepLinkHandler,
  parseDeepLink,
  buildDeepLink,
} from './deepLinks';

export type { DeepLinkRoute, DeepLinkHandler } from './deepLinks';

export { shareContent } from './share';
export type { ShareOptions } from './share';
