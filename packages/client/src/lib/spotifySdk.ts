// Idempotent loader for Spotify's Web Playback SDK. Spotify's own script calls the
// global `window.onSpotifyWebPlaybackSDKReady()` once `window.Spotify` is ready to use —
// this wraps that callback contract in a promise, cached at module scope so
// concurrent/repeated calls (e.g. a remount) never inject the <script> twice.
let sdkPromise: Promise<typeof Spotify> | null = null

export function loadSpotifySdk(): Promise<typeof Spotify> {
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise((resolve) => {
    if (window.Spotify) {
      resolve(window.Spotify)
      return
    }

    const previousReady = window.onSpotifyWebPlaybackSDKReady
    window.onSpotifyWebPlaybackSDKReady = () => {
      previousReady?.()
      // Guaranteed non-null here per Spotify's documented contract for this callback.
      resolve(window.Spotify!)
    }

    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.async = true
    document.body.appendChild(script)
  })

  return sdkPromise
}
