// Which shell the app is running inside — web browser or native (Capacitor) WebView.
//
// This is a THIRD axis, orthogonal to the two `hooks/useMediaQuery.ts` already draws:
// space (`useIsMobile`) and input (`useIsCoarsePointer`). A native phone is coarse-pointer
// AND mobile-width AND native, but none of those may ever proxy for another — a desktop
// browser at 400px wide is mobile-width and not native, and a tablet in the native shell
// is native and not mobile-width.
//
// Deliberately a plain function, not a hook: it's read from Zustand stores and module
// scope, outside React. Mirrors the existing precedent at `stores/uiStore.ts:7-8`.

// Driven by an env flag rather than a Capacitor import so the ENTIRE native code path
// (bearer refresh, token rotation, the native OAuth branch) is exercisable in a desktop
// browser with `VITE_PLATFORM=native` and zero Capacitor installed. When the native shell
// lands this becomes `Capacitor.isNativePlatform()`, and this file is one of only three
// places that change.
export function isNativePlatform(): boolean {
  return import.meta.env.VITE_PLATFORM === 'native'
}
