import { useEffect, useRef } from 'react'
import { trpc } from '../../lib/trpc'
import { loadSpotifySdk } from '../../lib/spotifySdk'
import { useSpotifyPlayerStore, type SpotifyLocalPlayback } from '../../stores/spotifyPlayerStore'

function toLocalPlayback(state: Spotify.WebPlaybackState | null): SpotifyLocalPlayback | null {
  if (!state) return null
  const track = state.track_window.current_track
  return {
    isPlaying: !state.paused,
    positionMs: state.position,
    durationMs: state.duration,
    track: {
      name: track.name,
      artist: (track.artists ?? []).map((a) => a.name).join(', '),
      albumArt: track.album?.images?.[0]?.url ?? null,
    },
  }
}

// Always-mounted (rendered in ActionRing.tsx next to AmbientPlayer, for the same reason:
// SpotifyWidget itself unmounts whenever the ring popup closes, and the SDK player must
// survive that so music started from Rumbo keeps playing in the background).
//
// This component makes the Rumbo tab a Spotify Connect device, and is also the sole
// source of truth for playback *while Rumbo is the active device*: it forwards the SDK's
// own `player_state_changed` events into spotifyPlayerStore so SpotifyWidget can read/
// control local playback instantly, without a server round trip or waiting on the 5s
// `spotifyPlayback` poll (which is reserved for when a *different* device is active).
export function SpotifyPlaybackHost() {
  const utils = trpc.useUtils()
  const connectionsQuery = trpc.connections.list.useQuery()
  const spotifyConn = connectionsQuery.data?.find((c) => c.provider === 'spotify')

  const setDeviceId = useSpotifyPlayerStore((s) => s.setDeviceId)
  const setStatus = useSpotifyPlayerStore((s) => s.setStatus)
  const setPlayback = useSpotifyPlayerStore((s) => s.setPlayback)
  const setPlayer = useSpotifyPlayerStore((s) => s.setPlayer)

  const playerRef = useRef<Spotify.Player | null>(null)
  // Guards against re-initializing a second player while one is already
  // connecting/connected for the current Spotify connection.
  const connectingRef = useRef(false)

  useEffect(() => {
    if (connectionsQuery.isLoading) return

    if (!spotifyConn?.connected) {
      playerRef.current?.disconnect()
      playerRef.current = null
      connectingRef.current = false
      setDeviceId(null)
      setStatus('idle')
      setPlayback(null)
      setPlayer(null)
      return
    }

    if (spotifyConn.isPremium === false) {
      setStatus('premium_required')
      return
    }

    if (connectingRef.current) return
    connectingRef.current = true
    setStatus('connecting')

    let cancelled = false

    loadSpotifySdk().then((SpotifySdk) => {
      if (cancelled) return

      const player = new SpotifySdk.Player({
        name: 'Rumbo',
        getOAuthToken: (callback) => {
          utils.client.connections.spotifyPlaybackToken.query().then((res) => callback(res.accessToken))
        },
        volume: 0.5,
      })

      player.addListener('ready', ({ device_id }) => {
        setDeviceId(device_id)
        setStatus('ready')
        setPlayer(player)
      })
      player.addListener('not_ready', () => {
        setDeviceId(null)
        setStatus('unavailable')
        setPlayback(null)
        setPlayer(null)
      })
      player.addListener('account_error', () => setStatus('premium_required'))
      player.addListener('initialization_error', () => setStatus('unavailable'))
      player.addListener('authentication_error', () => setStatus('unavailable'))
      // Fires instantly on every local play/pause/skip/seek/volume change, and also
      // whenever Spotify transfers playback away from Rumbo (state becomes null) — this
      // is the sole source of truth for "is Rumbo the active device right now."
      player.addListener('player_state_changed', (state) => {
        setPlayback(toLocalPlayback(state))
      })

      playerRef.current = player
      player.connect()
    })

    return () => {
      cancelled = true
    }
  }, [connectionsQuery.isLoading, spotifyConn?.connected, spotifyConn?.isPremium])

  // Disconnect when this unmounts — covers logout, since this sits under the
  // authenticated AppContent tree and unmounts along with it.
  useEffect(() => {
    return () => {
      playerRef.current?.disconnect()
      setPlayback(null)
      setPlayer(null)
    }
  }, [])

  return null
}
