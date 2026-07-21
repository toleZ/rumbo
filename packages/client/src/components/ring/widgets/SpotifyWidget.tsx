import { useEffect, useRef, useState } from 'react'
import {
  Music2, Play, Pause, SkipBack, SkipForward, Volume2, Search, ChevronLeft, User, Disc3, ListMusic,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { trpc } from '../../../lib/trpc'
import { useSpotifyPlayerStore } from '../../../stores/spotifyPlayerStore'
import type {
  SpotifySearchResultTrack,
  SpotifySearchResultArtist,
  SpotifySearchResultAlbum,
  SpotifySearchResultPlaylist,
} from '../../../../../server/src/application/ports/ISpotifyClient'

// Separate override env var per raw (non-tRPC) endpoint, matching the
// VITE_API_STREAM_URL convention used for the AI assistant's SSE endpoint.
const SPOTIFY_AUTHORIZE_URL = import.meta.env.VITE_API_SPOTIFY_AUTHORIZE_URL ?? '/api/connections/spotify/authorize'

const VOLUME_DEBOUNCE_MS = 250
const SEARCH_DEBOUNCE_MS = 350
const BROWSE_HEIGHT = '380px'

type View = 'now-playing' | 'browse' | 'playlist-tracks' | 'album-tracks' | 'artist-tracks'

function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// Spotify URIs are `spotify:<type>:<id>` — the REST endpoints for a playlist's own
// tracks need the bare id, which we don't otherwise store (we only carry the URI, used
// directly as `context_uri` for playback).
function idFromUri(uri: string): string {
  return uri.split(':').pop() ?? uri
}

function SpotifySkeleton() {
  return (
    <div className="p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-[var(--radius-lg)] bg-[var(--surface-2)] shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3.5 w-3/4 rounded-[var(--radius-sm)] bg-[var(--surface-2)]" />
          <div className="h-3 w-1/2 rounded-[var(--radius-sm)] bg-[var(--surface-2)]" />
        </div>
      </div>
      <div className="h-1 w-full rounded-full bg-[var(--surface-2)] mt-4" />
      <div className="flex items-center justify-center gap-4 mt-3">
        <div className="w-4 h-4 rounded-full bg-[var(--surface-2)]" />
        <div className="w-8 h-8 rounded-full bg-[var(--surface-2)]" />
        <div className="w-4 h-4 rounded-full bg-[var(--surface-2)]" />
      </div>
    </div>
  )
}

function RowSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--surface-2)] shrink-0" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3 w-3/4 rounded-[var(--radius-sm)] bg-[var(--surface-2)]" />
            <div className="h-2.5 w-1/2 rounded-[var(--radius-sm)] bg-[var(--surface-2)]" />
          </div>
        </div>
      ))}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--label-3)] px-0.5 mb-1.5">
      {children}
    </p>
  )
}

function ResultRow({
  imageUrl, icon: Icon, title, subtitle, onClick,
}: {
  imageUrl: string | null
  icon: React.ElementType
  title: string
  subtitle: string | null
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-1.5 py-1.5 rounded-[var(--radius-md)] text-left hover:bg-[var(--surface-2)] transition-colors duration-[120ms]"
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="w-9 h-9 rounded-[var(--radius-md)] object-cover shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--surface-2)] flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-[var(--label-3)]" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--label)] truncate">{title}</p>
        {subtitle && <p className="text-[11px] text-[var(--label-3)] truncate">{subtitle}</p>}
      </div>
    </button>
  )
}

export function SpotifyWidget() {
  const { t } = useTranslation()
  const utils = trpc.useUtils()

  const [view, setView] = useState<View>('now-playing')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [activePlaylist, setActivePlaylist] = useState<SpotifySearchResultPlaylist | null>(null)
  const [activeAlbum, setActiveAlbum] = useState<SpotifySearchResultAlbum | null>(null)
  const [activeArtist, setActiveArtist] = useState<SpotifySearchResultArtist | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(searchInput.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [searchInput])

  const connectionsQuery = trpc.connections.list.useQuery()
  const spotifyConn = connectionsQuery.data?.find((c) => c.provider === 'spotify')
  const isConnected = spotifyConn?.connected ?? false

  const sdkStatus = useSpotifyPlayerStore((s) => s.status)
  const sdkDeviceId = useSpotifyPlayerStore((s) => s.deviceId)
  const sdkPlayer = useSpotifyPlayerStore((s) => s.player)
  const sdkPlayback = useSpotifyPlayerStore((s) => s.playback)

  // Rumbo's own tab is the active Spotify Connect device exactly when the SDK reports a
  // player_state_changed state — in that case the SDK itself is the fast, correct source
  // of truth (instant events, in-process controls) and the server-side poll below (built
  // for *remote* devices) would only add lag and, worse, a false "no device" flicker
  // whenever the 5s poll lands slightly late. See the plan doc for why these two paths
  // are mutually exclusive rather than merged.
  const localActive = sdkPlayback != null

  const playbackQuery = trpc.connections.spotifyPlayback.useQuery(undefined, {
    enabled: isConnected && !localActive,
    refetchInterval: 5000,
  })
  const remotePlayback = playbackQuery.data
  const hasDevice = Boolean(remotePlayback?.device)
  const sdkReady = sdkStatus === 'ready' && Boolean(sdkDeviceId)
  const canControl = hasDevice || sdkReady
  // Only relevant for starting a *new* selection from Browse when nothing is currently
  // active anywhere — targets Rumbo's own tab so playback starts here instead of
  // failing with "no active device." Once something is playing (local or remote), plain
  // transport controls below go through whichever path matches where it's playing.
  const targetDeviceId = !hasDevice && sdkReady ? sdkDeviceId ?? undefined : undefined

  // Unified now-playing view: local SDK state takes priority (see localActive above),
  // otherwise fall back to the remote-device poll.
  const playback = localActive
    ? {
        isPlaying: sdkPlayback.isPlaying,
        progressMs: sdkPlayback.positionMs,
        device: null,
        track: {
          name: sdkPlayback.track.name,
          artist: sdkPlayback.track.artist,
          albumArt: sdkPlayback.track.albumArt,
          durationMs: sdkPlayback.durationMs,
        },
      }
    : remotePlayback

  // Fetched once per Browse session regardless of search text — reused for both the
  // default "Your playlists" listing and, while a search query is active, filtered
  // client-side into a "Your playlists" matches section (see below). Spotify's own
  // global search often doesn't surface a user's private/low-relevance playlists, but
  // we already have the full list right here.
  const playlistsQuery = trpc.connections.spotifyPlaylists.useQuery(undefined, {
    enabled: isConnected && view === 'browse',
  })

  const searchQuery = trpc.connections.spotifySearch.useQuery(
    { query: debouncedQuery },
    { enabled: isConnected && view === 'browse' && debouncedQuery.length > 0 },
  )

  const playlistTracksQuery = trpc.connections.spotifyPlaylistTracks.useQuery(
    { playlistId: activePlaylist ? idFromUri(activePlaylist.uri) : '' },
    { enabled: view === 'playlist-tracks' && Boolean(activePlaylist) },
  )

  const albumTracksQuery = trpc.connections.spotifyAlbumTracks.useQuery(
    { albumId: activeAlbum ? idFromUri(activeAlbum.uri) : '' },
    { enabled: view === 'album-tracks' && Boolean(activeAlbum) },
  )

  const artistTracksQuery = trpc.connections.spotifyArtistTracks.useQuery(
    { artistName: activeArtist?.name ?? '' },
    { enabled: view === 'artist-tracks' && Boolean(activeArtist) },
  )

  // Both the SDK's own "no device" case and a genuinely-Premium-required account 403
  // surface as the same CONFLICT code — we already know isPremium client-side, so pick
  // the more specific message rather than always showing the generic "open a device" one.
  const handlePlaybackError = (err: { data?: { code?: string } | null; message: string }) => {
    if (err.data?.code === 'CONFLICT') {
      toast.error(spotifyConn?.isPremium === false ? t('ring.spotifyPremiumRequired') : t('ring.spotifyUnavailable'))
    } else {
      toast.error(err.message)
    }
  }

  const controlMutation = trpc.connections.spotifyControl.useMutation({
    onSuccess: () => utils.connections.spotifyPlayback.invalidate(),
    onError: handlePlaybackError,
  })
  const setVolumeMutation = trpc.connections.spotifySetVolume.useMutation()
  const seekMutation = trpc.connections.spotifySeek.useMutation({ onError: handlePlaybackError })

  const playMutation = trpc.connections.spotifyPlay.useMutation({
    onSuccess: () => {
      utils.connections.spotifyPlayback.invalidate()
      setView('now-playing')
    },
    onError: handlePlaybackError,
  })

  // Ticks the progress bar forward every second between updates, so it doesn't visibly
  // stall. Resynced whenever a fresh poll/SDK event or a track change produces a new
  // `progressKey` (isPlaying included so a pause/resume with an unchanged position still
  // resyncs) — done as a render-time state adjustment (React's documented alternative to
  // useEffect for "reset state when a value changes":
  // https://react.dev/learn/you-might-not-need-an-effect) rather than a setState-in-effect,
  // which avoids an extra render-then-effect round trip.
  const progressKey = playback?.track ? `${playback.track.name}:${playback.progressMs}:${playback.isPlaying}` : null
  const [syncedProgressKey, setSyncedProgressKey] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  if (progressKey !== syncedProgressKey) {
    setSyncedProgressKey(progressKey)
    setElapsed(playback?.progressMs ?? 0)
  }

  useEffect(() => {
    if (!playback?.isPlaying || !playback.track) return
    const duration = playback.track.durationMs
    const interval = setInterval(() => {
      setElapsed((prev) => Math.min(prev + 1000, duration))
    }, 1000)
    return () => clearInterval(interval)
  }, [playback?.isPlaying, playback?.track])

  // Seeking: `seekPreviewMs` only exists while the user is actively dragging the slider
  // (set on `onChange`, which fires continuously) so the drag never touches `elapsed`
  // itself — that keeps the auto-tick effect above and the progress resync untouched
  // mid-drag. The displayed position falls back to `elapsed` once the drag ends. The
  // actual seek command only fires on release (mouseup/touchend/keyup), not per tick.
  const [seekPreviewMs, setSeekPreviewMs] = useState<number | null>(null)
  const displayedElapsed = seekPreviewMs ?? elapsed
  const commitSeek = (ms: number) => {
    setSeekPreviewMs(null)
    setElapsed(ms)
    if (localActive && sdkPlayer) {
      sdkPlayer.seek(ms)
    } else {
      seekMutation.mutate({ positionMs: ms, deviceId: targetDeviceId })
    }
  }

  // Local volume state so the slider thumb tracks drags immediately. Resynced only when
  // the *target* changes (a different Spotify Connect device, or switching between
  // Rumbo's local device and a remote one) — same render-time-adjustment pattern as
  // above. Once synced for a given target, the slider is locally authoritative, so an
  // in-flight 5s poll never yanks the thumb mid-drag. The SDK doesn't report volume in
  // `player_state_changed`, so the local case is fetched separately via `getVolume()`.
  const deviceKey = localActive ? 'rumbo-local' : (remotePlayback?.device?.name ?? null)
  const [syncedDeviceKey, setSyncedDeviceKey] = useState<string | null>(null)
  const [volume, setVolume] = useState<number | null>(null)
  if (deviceKey !== syncedDeviceKey) {
    setSyncedDeviceKey(deviceKey)
    setVolume(localActive ? null : (remotePlayback?.device?.volumePercent ?? null))
  }

  useEffect(() => {
    if (!localActive || !sdkPlayer) return
    let cancelled = false
    sdkPlayer.getVolume().then((v) => {
      if (!cancelled) setVolume(Math.round(v * 100))
    })
    return () => {
      cancelled = true
    }
  }, [localActive, sdkPlayer])

  const volumeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleVolumeChange = (next: number) => {
    setVolume(next)
    if (volumeDebounceRef.current) clearTimeout(volumeDebounceRef.current)
    volumeDebounceRef.current = setTimeout(() => {
      if (localActive && sdkPlayer) {
        sdkPlayer.setVolume(next / 100)
      } else {
        setVolumeMutation.mutate({ volumePercent: next })
      }
    }, VOLUME_DEBOUNCE_MS)
  }

  // Transport controls: when Rumbo's tab is the active device, call the SDK directly —
  // instant, in-process, no server round trip and no risk of racing the poll into a
  // false "no device" error. Otherwise keep using the existing server-side control
  // mutation, which targets whatever remote device is currently active.
  const handleTogglePlay = () => {
    if (localActive && sdkPlayer) {
      sdkPlayer.togglePlay()
    } else {
      controlMutation.mutate({ action: playback?.isPlaying ? 'pause' : 'play', deviceId: targetDeviceId })
    }
  }
  const handlePrevious = () => {
    if (localActive && sdkPlayer) {
      sdkPlayer.previousTrack()
    } else {
      controlMutation.mutate({ action: 'previous', deviceId: targetDeviceId })
    }
  }
  const handleNext = () => {
    if (localActive && sdkPlayer) {
      sdkPlayer.nextTrack()
    } else {
      controlMutation.mutate({ action: 'next', deviceId: targetDeviceId })
    }
  }

  const handleConnect = () => {
    window.location.href = SPOTIFY_AUTHORIZE_URL
  }

  const handleHeaderNav = () => {
    if (view === 'now-playing') {
      setView('browse')
    } else if (view === 'playlist-tracks') {
      setActivePlaylist(null)
      setView('browse')
    } else if (view === 'album-tracks') {
      setActiveAlbum(null)
      setView('browse')
    } else if (view === 'artist-tracks') {
      setActiveArtist(null)
      setView('browse')
    } else {
      setSearchInput('')
      setView('now-playing')
    }
  }

  const playTrack = (track: SpotifySearchResultTrack) =>
    playMutation.mutate({ trackUri: track.uri, deviceId: targetDeviceId })
  const playContext = (uri: string) =>
    playMutation.mutate({ contextUri: uri, deviceId: targetDeviceId })
  const openPlaylist = (playlist: SpotifySearchResultPlaylist) => {
    setActivePlaylist(playlist)
    setView('playlist-tracks')
  }
  const openAlbum = (album: SpotifySearchResultAlbum) => {
    setActiveAlbum(album)
    setView('album-tracks')
  }
  const openArtist = (artist: SpotifySearchResultArtist) => {
    setActiveArtist(artist)
    setView('artist-tracks')
  }

  const search = searchQuery.data
  const ownPlaylistMatches = debouncedQuery
    ? (playlistsQuery.data ?? []).filter((p) => p.name.toLowerCase().includes(debouncedQuery.toLowerCase()))
    : []
  const hasAnyResults = Boolean(
    ownPlaylistMatches.length
    || (search && (search.tracks.length || search.artists.length || search.albums.length || search.playlists.length)),
  )

  return (
    <div className="bg-[var(--surface)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-xl)] border border-[var(--sep)] w-72 overflow-hidden">
      {/* Header */}
      <div className="relative flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--sep)]">
        <div className="flex items-center gap-2 min-w-0">
          <Music2 className="w-4 h-4 shrink-0" style={{ color: 'var(--accent)' }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
            {t('ring.spotify', 'Spotify')}
          </span>
        </div>
        {isConnected && (
          <button
            onClick={handleHeaderNav}
            className="p-1 rounded-[var(--radius-sm)] text-[var(--label-3)] hover:text-[var(--label-2)] hover:bg-[var(--surface-2)] transition-colors shrink-0"
            title={view === 'now-playing' ? t('ring.spotifyBrowse') : t('ring.spotifyBack')}
          >
            {view === 'now-playing' ? <Search className="w-3.5 h-3.5" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>

      {connectionsQuery.isLoading && <SpotifySkeleton />}

      {!connectionsQuery.isLoading && !isConnected && (
        <div className="flex flex-col items-center gap-3 py-6 px-4 text-center">
          <p className="text-xs text-[var(--label-3)]">{t('ring.spotifyConnectDesc')}</p>
          <button
            onClick={handleConnect}
            className="px-4 py-2 rounded-full text-xs font-semibold text-white transition-transform duration-[140ms] active:scale-95"
            style={{ background: 'var(--accent)' }}
          >
            {t('ring.spotifyConnect')}
          </button>
        </div>
      )}

      {/* --- Now playing --- */}
      {isConnected && !connectionsQuery.isLoading && view === 'now-playing' && !playback?.track && (
        <div className="flex flex-col items-center gap-3 py-6 px-4 text-center">
          <p className="text-xs text-[var(--label-3)]">{t('ring.spotifyNotPlaying')}</p>
          {spotifyConn?.isPremium === false && (
            <p className="text-[10px] text-[var(--label-3)] -mt-2">{t('ring.spotifyPremiumRequired')}</p>
          )}
          <button
            onClick={() => setView('browse')}
            className="px-4 py-2 rounded-full text-xs font-semibold text-white transition-transform duration-[140ms] active:scale-95"
            style={{ background: 'var(--accent)' }}
          >
            {t('ring.spotifyBrowse')}
          </button>
        </div>
      )}

      {isConnected && view === 'now-playing' && playback?.track && (
        <div className="relative">
          {/* Blurred album-art backdrop, tinting the card with the cover's colors */}
          {playback.track.albumArt && (
            <img
              src={playback.track.albumArt}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-25 scale-125 pointer-events-none"
            />
          )}

          <div className="relative p-4 space-y-3">
            <div className="flex items-center gap-3">
              {playback.track.albumArt ? (
                <img
                  src={playback.track.albumArt}
                  alt=""
                  className="w-16 h-16 rounded-[var(--radius-lg)] object-cover shrink-0 shadow-[var(--shadow-md,0_2px_8px_rgba(0,0,0,0.15))]"
                />
              ) : (
                <div className="w-16 h-16 rounded-[var(--radius-lg)] bg-[var(--surface-2)] flex items-center justify-center shrink-0">
                  <Music2 className="w-5 h-5 text-[var(--label-3)]" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--label)] truncate">{playback.track.name}</p>
                <p className="text-xs text-[var(--label-3)] truncate">{playback.track.artist}</p>
              </div>
            </div>

            {/* Progress bar + elapsed/total — draggable to seek, reusing the volume
                slider's styling (its 4px track already matches this bar's height) */}
            <div className="space-y-1">
              <input
                type="range"
                min={0}
                max={playback.track.durationMs || 1}
                step={1000}
                value={Math.min(displayedElapsed, playback.track.durationMs || 1)}
                onChange={(e) => setSeekPreviewMs(parseInt(e.target.value, 10))}
                onMouseUp={(e) => commitSeek(parseInt((e.target as HTMLInputElement).value, 10))}
                onTouchEnd={(e) => commitSeek(parseInt((e.target as HTMLInputElement).value, 10))}
                onKeyUp={() => {
                  if (seekPreviewMs !== null) commitSeek(seekPreviewMs)
                }}
                disabled={!canControl}
                className="ambient-slider w-full disabled:opacity-40 disabled:pointer-events-none"
                style={{ '--fill': `${playback.track.durationMs ? Math.min(100, (displayedElapsed / playback.track.durationMs) * 100) : 0}%` } as React.CSSProperties}
                aria-label={t('ring.spotifySeek')}
              />
              <div className="flex items-center justify-between text-[10px] text-[var(--label-3)] tabular-nums">
                <span>{formatMs(displayedElapsed)}</span>
                <span>{formatMs(playback.track.durationMs)}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handlePrevious}
                disabled={!canControl || (!localActive && controlMutation.isPending)}
                className="text-[var(--label-2)] hover:text-[var(--label)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={handleTogglePlay}
                disabled={!canControl || (!localActive && controlMutation.isPending)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-[transform] duration-[140ms] active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                style={{ background: 'var(--accent)' }}
              >
                {playback.isPlaying ? (
                  <Pause className="w-3.5 h-3.5" style={{ color: '#fff' }} />
                ) : (
                  <Play className="w-3.5 h-3.5" style={{ color: '#fff', marginLeft: '1px' }} />
                )}
              </button>
              <button
                onClick={handleNext}
                disabled={!canControl || (!localActive && controlMutation.isPending)}
                className="text-[var(--label-2)] hover:text-[var(--label)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            {/* Volume slider — reuses the ambient widget's slider styling */}
            {volume !== null && (
              <div className="flex items-center gap-3">
                <Volume2 className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--label-3)' }} />
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={volume}
                  onChange={(e) => handleVolumeChange(parseInt(e.target.value, 10))}
                  disabled={!canControl}
                  className="ambient-slider flex-1 disabled:opacity-40 disabled:pointer-events-none"
                  style={{ '--fill': `${volume}%` } as React.CSSProperties}
                  aria-label={t('ring.spotifyVolume')}
                />
              </div>
            )}

            {localActive ? (
              <p className="text-[10px] text-[var(--label-3)] text-center truncate">
                {t('ring.spotifyPlayingOn', { device: 'Rumbo' })}
              </p>
            ) : hasDevice ? (
              <p className="text-[10px] text-[var(--label-3)] text-center truncate">
                {t('ring.spotifyPlayingOn', { device: remotePlayback!.device!.name })}
              </p>
            ) : sdkStatus === 'connecting' ? (
              <p className="text-[10px] text-[var(--label-3)] text-center">{t('ring.spotifyConnectingPlayer')}</p>
            ) : spotifyConn?.isPremium === false ? (
              <p className="text-[10px] text-[var(--label-3)] text-center">{t('ring.spotifyPremiumRequired')}</p>
            ) : (
              <p className="text-[10px] text-[var(--label-3)] text-center">{t('ring.spotifyUnavailable')}</p>
            )}
          </div>
        </div>
      )}

      {/* --- Browse: search + your playlists --- */}
      {isConnected && view === 'browse' && (
        <div className="flex flex-col" style={{ height: BROWSE_HEIGHT }}>
          <div className="p-3 border-b border-[var(--sep)] shrink-0">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('ring.spotifySearchPlaceholder')}
              autoFocus
              className="w-full px-3 py-2 text-xs rounded-[var(--radius-lg)] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow duration-[160ms]"
            />
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
            {debouncedQuery === '' ? (
              playlistsQuery.isLoading ? (
                <RowSkeleton />
              ) : !playlistsQuery.data?.length ? (
                <p className="text-xs text-[var(--label-3)] text-center py-6">{t('ring.spotifyYourPlaylists')}</p>
              ) : (
                <div>
                  <SectionLabel>{t('ring.spotifyYourPlaylists')}</SectionLabel>
                  <div className="space-y-0.5">
                    {playlistsQuery.data.map((p) => (
                      <ResultRow
                        key={p.uri}
                        imageUrl={p.imageUrl}
                        icon={ListMusic}
                        title={p.name}
                        subtitle={t('ring.spotifyTrackCount', { count: p.trackCount })}
                        onClick={() => openPlaylist(p)}
                      />
                    ))}
                  </div>
                </div>
              )
            ) : searchQuery.isLoading ? (
              <RowSkeleton />
            ) : !hasAnyResults ? (
              <p className="text-xs text-[var(--label-3)] text-center py-6">{t('ring.spotifyNoResults')}</p>
            ) : (
              <div className="space-y-3">
                {Boolean(ownPlaylistMatches.length) && (
                  <div>
                    <SectionLabel>{t('ring.spotifyYourPlaylists')}</SectionLabel>
                    <div className="space-y-0.5">
                      {ownPlaylistMatches.map((p) => (
                        <ResultRow
                          key={p.uri}
                          imageUrl={p.imageUrl}
                          icon={ListMusic}
                          title={p.name}
                          subtitle={t('ring.spotifyTrackCount', { count: p.trackCount })}
                          onClick={() => openPlaylist(p)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {Boolean(search?.tracks.length) && (
                  <div>
                    <SectionLabel>{t('ring.spotifySongs')}</SectionLabel>
                    <div className="space-y-0.5">
                      {search!.tracks.map((track: SpotifySearchResultTrack) => (
                        <ResultRow
                          key={track.uri}
                          imageUrl={track.albumArt}
                          icon={Music2}
                          title={track.name}
                          subtitle={track.artist}
                          onClick={() => playTrack(track)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {Boolean(search?.artists.length) && (
                  <div>
                    <SectionLabel>{t('ring.spotifyArtists')}</SectionLabel>
                    <div className="space-y-0.5">
                      {search!.artists.map((artist: SpotifySearchResultArtist) => (
                        <ResultRow
                          key={artist.uri}
                          imageUrl={artist.imageUrl}
                          icon={User}
                          title={artist.name}
                          subtitle={null}
                          onClick={() => openArtist(artist)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {Boolean(search?.albums.length) && (
                  <div>
                    <SectionLabel>{t('ring.spotifyAlbums')}</SectionLabel>
                    <div className="space-y-0.5">
                      {search!.albums.map((album: SpotifySearchResultAlbum) => (
                        <ResultRow
                          key={album.uri}
                          imageUrl={album.imageUrl}
                          icon={Disc3}
                          title={album.name}
                          subtitle={album.artist}
                          onClick={() => openAlbum(album)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {Boolean(search?.playlists.length) && (
                  <div>
                    <SectionLabel>{t('ring.spotifyPlaylistsSection')}</SectionLabel>
                    <div className="space-y-0.5">
                      {search!.playlists.map((playlist: SpotifySearchResultPlaylist) => (
                        <ResultRow
                          key={playlist.uri}
                          imageUrl={playlist.imageUrl}
                          icon={ListMusic}
                          title={playlist.name}
                          subtitle={playlist.ownerName}
                          onClick={() => openPlaylist(playlist)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Playlist tracks --- */}
      {isConnected && view === 'playlist-tracks' && activePlaylist && (
        <div className="flex flex-col" style={{ height: BROWSE_HEIGHT }}>
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-[var(--sep)] shrink-0">
            <p className="text-xs font-medium text-[var(--label)] truncate min-w-0">{activePlaylist.name}</p>
            {/* Spotify only exposes a playlist's track list to its owner/collaborators
                (documented, blanket policy — see the isError branch below) — but playing
                a playlist by context_uri is a control command, not a data read, so it
                isn't subject to that restriction. Always offer this so playback works
                regardless of whether the list below loaded. */}
            <button
              onClick={() => playContext(activePlaylist.uri)}
              className="flex items-center gap-1 pl-2.5 pr-3 py-1.5 rounded-full text-[11px] font-semibold text-white transition-transform duration-[140ms] active:scale-95 shrink-0"
              style={{ background: 'var(--accent)' }}
            >
              <Play className="w-3 h-3" style={{ marginLeft: '-1px' }} />
              {t('ring.spotifyPlayPlaylist')}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
            {playlistTracksQuery.isLoading ? (
              <RowSkeleton />
            ) : playlistTracksQuery.isError ? (
              // Confirmed against Spotify's own docs: Get Playlist Items is only ever
              // accessible for playlists you own or collaborate on — a blanket policy,
              // not a Development Mode limit — so this branch, in practice, always means
              // "not your playlist," never a transient failure. Shown as an intentional
              // preview card (what we *do* know about it) rather than a bare error, since
              // the track list itself is never coming.
              <div className="flex flex-col items-center gap-2 py-6 px-2 text-center">
                {activePlaylist.imageUrl ? (
                  <img
                    src={activePlaylist.imageUrl}
                    alt=""
                    className="w-14 h-14 rounded-[var(--radius-lg)] object-cover shadow-[var(--shadow-md,0_2px_8px_rgba(0,0,0,0.15))]"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-[var(--radius-lg)] bg-[var(--surface-2)] flex items-center justify-center">
                    <ListMusic className="w-5 h-5 text-[var(--label-3)]" />
                  </div>
                )}
                <p className="text-[11px] text-[var(--label-3)]">
                  {activePlaylist.ownerName}
                  {activePlaylist.ownerName && ' · '}
                  {t('ring.spotifyTrackCount', { count: activePlaylist.trackCount })}
                </p>
                <p className="text-xs text-[var(--label-3)] max-w-[220px]">{t('ring.spotifyPlaylistOwnedOnly')}</p>
              </div>
            ) : !playlistTracksQuery.data?.length ? (
              <p className="text-xs text-[var(--label-3)] text-center py-6">{t('ring.spotifyNoResults')}</p>
            ) : (
              <div className="space-y-0.5">
                {playlistTracksQuery.data.map((track) => (
                  <ResultRow
                    key={track.uri}
                    imageUrl={track.albumArt}
                    icon={Music2}
                    title={track.name}
                    subtitle={track.artist}
                    onClick={() => playMutation.mutate({ contextUri: activePlaylist.uri, offsetUri: track.uri, deviceId: targetDeviceId })}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Album tracks --- */}
      {isConnected && view === 'album-tracks' && activeAlbum && (
        <div className="flex flex-col" style={{ height: BROWSE_HEIGHT }}>
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-[var(--sep)] shrink-0">
            <p className="text-xs font-medium text-[var(--label)] truncate min-w-0">{activeAlbum.name}</p>
            <button
              onClick={() => playContext(activeAlbum.uri)}
              className="flex items-center gap-1 pl-2.5 pr-3 py-1.5 rounded-full text-[11px] font-semibold text-white transition-transform duration-[140ms] active:scale-95 shrink-0"
              style={{ background: 'var(--accent)' }}
            >
              <Play className="w-3 h-3" style={{ marginLeft: '-1px' }} />
              {t('ring.spotifyPlayAlbum')}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
            {albumTracksQuery.isLoading ? (
              <RowSkeleton />
            ) : !albumTracksQuery.data?.length ? (
              <p className="text-xs text-[var(--label-3)] text-center py-6">{t('ring.spotifyNoResults')}</p>
            ) : (
              <div className="space-y-0.5">
                {albumTracksQuery.data.map((track) => (
                  <ResultRow
                    key={track.uri}
                    // Album tracks all share one cover — the API doesn't return it per
                    // track (unlike playlist entries, which can span albums), so use the
                    // album's own image (already known from the search result) for every row.
                    imageUrl={activeAlbum.imageUrl}
                    icon={Music2}
                    title={track.name}
                    subtitle={track.artist}
                    onClick={() => playMutation.mutate({ contextUri: activeAlbum.uri, offsetUri: track.uri, deviceId: targetDeviceId })}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Artist tracks --- */}
      {isConnected && view === 'artist-tracks' && activeArtist && (
        <div className="flex flex-col" style={{ height: BROWSE_HEIGHT }}>
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-[var(--sep)] shrink-0">
            <p className="text-xs font-medium text-[var(--label)] truncate min-w-0">{activeArtist.name}</p>
            {/* Plays the artist's context_uri (Spotify's own artist radio/mix), distinct
                from the list below — which isn't Spotify's real "Top Tracks" (that
                endpoint was removed for Development Mode apps) but a relevance search
                filtered to this artist, so there's no matching ordered context to offset
                into; each row is played independently via playTrack instead. */}
            <button
              onClick={() => playContext(activeArtist.uri)}
              className="flex items-center gap-1 pl-2.5 pr-3 py-1.5 rounded-full text-[11px] font-semibold text-white transition-transform duration-[140ms] active:scale-95 shrink-0"
              style={{ background: 'var(--accent)' }}
            >
              <Play className="w-3 h-3" style={{ marginLeft: '-1px' }} />
              {t('ring.spotifyPlayArtist')}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
            {artistTracksQuery.isLoading ? (
              <RowSkeleton />
            ) : !artistTracksQuery.data?.length ? (
              <p className="text-xs text-[var(--label-3)] text-center py-6">{t('ring.spotifyNoResults')}</p>
            ) : (
              <div className="space-y-0.5">
                {artistTracksQuery.data.map((track) => (
                  <ResultRow
                    key={track.uri}
                    imageUrl={track.albumArt}
                    icon={Music2}
                    title={track.name}
                    subtitle={track.artist}
                    onClick={() => playTrack(track)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
