// Absolute base for every server URL the client builds.
//
// On the web this stays empty, so `${API_BASE}/trpc` is the literal string `/trpc` and
// Vite's dev proxy (vite.config.ts) keeps requests same-origin — which is what makes the
// httpOnly refresh cookie work at all.
//
// A native WebView has no dev proxy and its own origin (capacitor://localhost on iOS,
// http://localhost on Android), so every relative URL would resolve against that origin
// and 404. Setting VITE_API_BASE_URL to the absolute API URL is therefore a hard
// prerequisite for the native shell, not a nicety.
//
// Unset → every URL below is character-identical to what it was before this indirection.
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''
