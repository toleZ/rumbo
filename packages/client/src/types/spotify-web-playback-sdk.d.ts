// Minimal ambient types for Spotify's Web Playback SDK
// (https://sdk.scdn.co/spotify-player.js). It's a runtime-injected global script, not an
// npm module, so there's no package to install types from — only the surface Rumbo
// actually uses (creating a player, connecting, and the few events we listen for) is
// typed here. See lib/spotifySdk.ts for the loader that injects the script.
export {}

declare global {
  namespace Spotify {
    interface PlayerInit {
      name: string
      getOAuthToken: (callback: (token: string) => void) => void
      volume?: number
    }

    interface WebPlaybackError {
      message: string
    }

    interface WebPlaybackTrack {
      uri: string
      name: string
      duration_ms: number
      artists: { name: string }[]
      album: { images: { url: string }[] }
    }

    interface WebPlaybackState {
      paused: boolean
      position: number
      duration: number
      track_window: { current_track: WebPlaybackTrack }
    }

    class Player {
      constructor(options: PlayerInit)
      connect(): Promise<boolean>
      disconnect(): void
      addListener(event: 'ready' | 'not_ready', callback: (state: { device_id: string }) => void): boolean
      addListener(
        event: 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error',
        callback: (error: WebPlaybackError) => void,
      ): boolean
      addListener(event: 'player_state_changed', callback: (state: WebPlaybackState | null) => void): boolean
      removeListener(event: string): boolean
      getCurrentState(): Promise<WebPlaybackState | null>
      togglePlay(): Promise<void>
      nextTrack(): Promise<void>
      previousTrack(): Promise<void>
      setVolume(volume: number): Promise<void>
      getVolume(): Promise<number>
      seek(positionMs: number): Promise<void>
    }
  }

  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void
    Spotify?: typeof Spotify
  }
}
