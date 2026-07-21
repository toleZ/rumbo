import { ConflictError } from '../../domain/errors.js'

export interface SpotifyTokenResult {
  accessToken: string
  refreshToken: string // Spotify only returns a new one on some refreshes — callers keep the old one otherwise
  expiresAt: Date
  scope: string
}

export interface SpotifyProfile {
  id: string
  displayName: string | null
  product: string | null // 'premium' | 'free' | 'open' | null (unknown / scope not granted)
}

export interface SpotifyTrack {
  name: string
  artist: string
  albumArt: string | null
  durationMs: number
}

export interface SpotifyPlaybackState {
  isPlaying: boolean
  progressMs: number
  device: { name: string; volumePercent: number | null } | null
  track: SpotifyTrack | null
}

export type SpotifyPlaybackAction = 'play' | 'pause' | 'next' | 'previous'

export interface SpotifySearchResultTrack {
  uri: string
  name: string
  artist: string
  albumArt: string | null
  durationMs: number
}

export interface SpotifySearchResultArtist {
  uri: string
  name: string
  imageUrl: string | null
}

export interface SpotifySearchResultAlbum {
  uri: string
  name: string
  artist: string
  imageUrl: string | null
}

export interface SpotifySearchResultPlaylist {
  uri: string
  name: string
  ownerName: string | null
  imageUrl: string | null
  trackCount: number
}

export interface SpotifySearchResults {
  tracks: SpotifySearchResultTrack[]
  artists: SpotifySearchResultArtist[]
  albums: SpotifySearchResultAlbum[]
  playlists: SpotifySearchResultPlaylist[]
}

// Thrown when Spotify rejects a playback-control call because there's no active
// device or the account isn't Premium (403/404) — distinct from auth/network failures.
// Extends ConflictError so it flows through trpc.ts's domainErrorMiddleware as a
// well-formed CONFLICT response instead of a generic 500, letting the widget show a
// specific, actionable message.
export class SpotifyPlaybackUnavailableError extends ConflictError {
  constructor(message = 'No active Spotify device') {
    super(message)
  }
}

export interface ISpotifyClient {
  getAuthorizeUrl(state: string, codeChallenge: string): string
  exchangeCode(code: string, codeVerifier: string): Promise<SpotifyTokenResult>
  refreshAccessToken(refreshToken: string): Promise<SpotifyTokenResult>
  getProfile(accessToken: string): Promise<SpotifyProfile>
  getCurrentPlayback(accessToken: string): Promise<SpotifyPlaybackState | null>
  controlPlayback(accessToken: string, action: SpotifyPlaybackAction, deviceId?: string): Promise<void>
  setVolume(accessToken: string, volumePercent: number, deviceId?: string): Promise<void>
  seek(accessToken: string, positionMs: number, deviceId?: string): Promise<void>
  search(accessToken: string, query: string): Promise<SpotifySearchResults>
  getUserPlaylists(accessToken: string): Promise<SpotifySearchResultPlaylist[]>
  getPlaylistTracks(accessToken: string, playlistId: string): Promise<SpotifySearchResultTrack[]>
  getAlbumTracks(accessToken: string, albumId: string): Promise<SpotifySearchResultTrack[]>
  getArtistTracks(accessToken: string, artistName: string): Promise<SpotifySearchResultTrack[]>
  playTrack(accessToken: string, trackUri: string, deviceId?: string): Promise<void>
  playContext(accessToken: string, contextUri: string, offsetTrackUri?: string, deviceId?: string): Promise<void>
}
