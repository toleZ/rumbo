import { isNativePlatform } from './host'

// The single place a per-platform gating decision is made. Components ask this map,
// never `isNativePlatform()` directly — so re-enabling a surface later is one edit here
// rather than an archaeology dig through scattered `if (isNative)` checks.
//
// Evaluated once at module load: the host cannot change mid-session.
const native = isNativePlatform()

export const capabilities = {
  // The ActionRing is the parent of AmbientPlayer and SpotifyPlaybackHost, so disabling
  // it also removes ambient audio, pomodoro, the AI assistant and Spotify from native.
  // That is the intended beta scope; the ring returns as a designed-for-touch feature.
  // Re-enabling it REQUIRES hoisting those two hosts out of ActionRing first.
  actionRing: !native,

  // Spotify's Web Playback SDK needs EME/Widevine and is unsupported in a mobile
  // WebView — the connect flow would succeed and then play nothing.
  spotifyConnect: !native,

  // Web keeps the httpOnly refresh cookie. Native has no cookie jar the system browser
  // shares, so its refresh token travels out-of-band and lives in secure storage.
  cookieSession: !native,

  // Web can only notify while a tab is open. Native hands the schedule to the OS, so
  // reminders fire with the app closed or the device locked.
  scheduledNotifications: native,
} as const
