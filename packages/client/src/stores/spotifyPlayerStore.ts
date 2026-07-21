import { create } from 'zustand'

// Status of Rumbo's own Spotify Connect device (the Web Playback SDK player), driven by
// SpotifyPlaybackHost (ActionRing.tsx) which is mounted for the whole session so the
// player survives the ring popup opening/closing. SpotifyWidget reads this to know
// whether it can target Rumbo's own tab when nothing else is currently playing.
export type SpotifyPlayerStatus = 'idle' | 'connecting' | 'ready' | 'unavailable' | 'premium_required'

// Local now-playing state, mapped straight from the SDK's `player_state_changed` event —
// this is Rumbo's own device reporting instantly, no server round trip and no poll lag.
// `null` means Rumbo's tab is not the currently active Spotify Connect device (playback,
// if any, is happening elsewhere and should be read from the existing server-side poll).
export interface SpotifyLocalPlayback {
  isPlaying: boolean
  positionMs: number
  durationMs: number
  track: { name: string; artist: string; albumArt: string | null }
}

interface SpotifyPlayerStore {
  deviceId: string | null
  status: SpotifyPlayerStatus
  playback: SpotifyLocalPlayback | null
  // The live SDK player instance, so the widget can call togglePlay()/nextTrack()/etc.
  // directly instead of round-tripping through the server for a device that's sitting
  // right here in the same tab.
  player: Spotify.Player | null
  setDeviceId: (id: string | null) => void
  setStatus: (status: SpotifyPlayerStatus) => void
  setPlayback: (playback: SpotifyLocalPlayback | null) => void
  setPlayer: (player: Spotify.Player | null) => void
}

export const useSpotifyPlayerStore = create<SpotifyPlayerStore>(() => ({
  deviceId: null,
  status: 'idle',
  playback: null,
  player: null,
  setDeviceId: (id) => useSpotifyPlayerStore.setState({ deviceId: id }),
  setStatus: (status) => useSpotifyPlayerStore.setState({ status }),
  setPlayback: (playback) => useSpotifyPlayerStore.setState({ playback }),
  setPlayer: (player) => useSpotifyPlayerStore.setState({ player }),
}))
