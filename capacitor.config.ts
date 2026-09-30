import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  /**
   * AURA Capacitor Configuration
   * ==============================
   * This configures the Capacitor wrapper for Android and iOS.
   *
   * App ID must match:
   *   - Android: applicationId in android/app/build.gradle
   *   - iOS: Bundle Identifier in Xcode project
   *
   * Change 'com.aura.app' to your real reverse-domain identifier
   * before publishing to Google Play / App Store.
   */
  appId: 'com.aura.player',
  appName: 'AURA',

  /**
   * webDir: Capacitor serves the built React app from this directory.
   * Must match the Vite `build.outDir` (default: 'dist').
   */
  webDir: 'dist',

  /**
   * Server configuration.
   * In development, point to the Vite dev server so live reload works.
   * For production builds, remove the `url` field so Capacitor serves from webDir.
   *
   * Uncomment `url` below during development:
   *   url: 'http://YOUR_LOCAL_IP:3000'
   * (Use your machine's LAN IP, not localhost, when testing on a real device)
   */
  server: {
    androidScheme: 'https',
    // url: 'http://192.168.x.x:3000',  // Uncomment for live reload on device
    cleartext: false,
    hostname: 'aura.app',
  },

  plugins: {
    /**
     * SplashScreen — configure the launch splash screen
     */
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#0a0908',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      spinnerColor: '#00f2fe',
    },

    /**
     * StatusBar — configure status bar appearance
     */
    StatusBar: {
      style: 'Dark' as any,
      backgroundColor: '#0a0908',
    },

    /**
     * Keyboard — configure keyboard behaviour
     */
    Keyboard: {
      resize: 'body' as any,
      style: 'dark' as any,
      resizeOnFullScreen: true,
    },

    /**
     * LocalNotifications — for playback state notifications
     * (not to be confused with media controls which use MusicControls plugin)
     */
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#00f2fe',
      sound: undefined,
    },

    /**
     * PushNotifications — FCM (Android) / APNs (iOS)
     * Provide your FCM sender ID in google-services.json (Android)
     * and configure APNs in Xcode (iOS).
     */
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },

    /**
     * CapacitorGoogleAuth (Capacitor Google Sign-In)
     * Replace with your real Google OAuth Client IDs.
     * Web client ID: used for Google Sign-In on Android
     * iOS client ID: matches the reversed iOS client ID
     */
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: process.env.VITE_GOOGLE_CLIENT_ID ?? '',
      forceCodeForRefreshToken: true,
    },
  },

  /**
   * Android-specific overrides
   */
  android: {
    minSdkVersion: 24,           // Android 7.0+
    targetSdkVersion: 34,
    compileSdkVersion: 34,
    buildToolsVersion: '34.0.0',
    backgroundColor: '#0a0908',
    allowMixedContent: false,
    captureInput: false,
    webContentsDebuggingEnabled: false, // set true during development
    loggingBehavior: 'none' as any,
    useLegacyBridge: false,
  },

  /**
   * iOS-specific overrides
   */
  ios: {
    contentInset: 'automatic' as any,
    backgroundColor: '#0a0908',
    limitsNavigationsToAppBoundDomains: true,
    preferredContentMode: 'mobile' as any,
    scrollEnabled: true,
    allowsLinkPreview: false,
    handleApplicationNotifications: true,
  },
};

export default config;
