import { NotFoundError } from '../../../domain/errors.js'
import type { IConnectionRepository } from '../../../domain/repositories/IConnectionRepository.js'
import type {
  ISpotifyClient,
  SpotifyPlaybackState,
  SpotifyPlaybackAction,
  SpotifySearchResults,
  SpotifySearchResultPlaylist,
  SpotifySearchResultTrack,
} from '../../ports/ISpotifyClient.js'
import { encrypt, decrypt } from '../../../infrastructure/crypto/tokenCipher.js'

export type SpotifyPlaySelection =
  | { trackUri: string; deviceId?: string }
  | { contextUri: string; offsetUri?: string; deviceId?: string }

export const SPOTIFY_PROVIDER = 'spotify'

export interface ConnectionSummary {
  provider: string
  connected: boolean
  displayName: string | null
  isPremium: boolean | null
}

export class ConnectSpotifyUseCase {
  private readonly connections: IConnectionRepository
  private readonly spotify: ISpotifyClient

  constructor(connections: IConnectionRepository, spotify: ISpotifyClient) {
    this.connections = connections
    this.spotify = spotify
  }

  async execute(userId: string, code: string, codeVerifier: string): Promise<void> {
    const tokens = await this.spotify.exchangeCode(code, codeVerifier)
    const profile = await this.spotify.getProfile(tokens.accessToken)

    await this.connections.upsert({
      userId,
      provider: SPOTIFY_PROVIDER,
      accessToken: encrypt(tokens.accessToken),
      refreshToken: encrypt(tokens.refreshToken),
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
      providerUserId: profile.id,
      displayName: profile.displayName,
      isPremium: profile.product === 'premium',
    })
  }
}

// Returns a live Spotify access token for the user, transparently refreshing +
// re-persisting it if the stored one is expired (or about to expire). Every
// playback-related use case below goes through this rather than reading the
// stored access token directly.
export class GetValidSpotifyTokenUseCase {
  private readonly connections: IConnectionRepository
  private readonly spotify: ISpotifyClient

  constructor(connections: IConnectionRepository, spotify: ISpotifyClient) {
    this.connections = connections
    this.spotify = spotify
  }

  async execute(userId: string): Promise<string> {
    const conn = await this.connections.findByUserAndProvider(userId, SPOTIFY_PROVIDER)
    if (!conn) throw new NotFoundError('Spotify no está conectado')

    // 30s safety margin so we never hand out a token that expires mid-request.
    if (conn.expiresAt.getTime() > Date.now() + 30_000) {
      return decrypt(conn.accessToken)
    }

    const refreshed = await this.spotify.refreshAccessToken(decrypt(conn.refreshToken))
    await this.connections.upsert({
      userId,
      provider: SPOTIFY_PROVIDER,
      accessToken: encrypt(refreshed.accessToken),
      refreshToken: encrypt(refreshed.refreshToken),
      expiresAt: refreshed.expiresAt,
      scope: refreshed.scope || conn.scope,
      providerUserId: conn.providerUserId,
      displayName: conn.displayName,
      isPremium: conn.isPremium,
    })
    return refreshed.accessToken
  }
}

// The only use case that ever hands a raw Spotify access token to the client — needed
// by the Web Playback SDK's `getOAuthToken` callback, which runs in the browser and
// must authenticate its own streaming connection directly with Spotify. The SDK calls
// this repeatedly on its own schedule as tokens near expiry, so this simply delegates
// to GetValidSpotifyTokenUseCase (which already refreshes if needed) on every call —
// no separate expiry tracking required here.
export class GetSpotifyPlaybackTokenUseCase {
  private readonly getToken: GetValidSpotifyTokenUseCase

  constructor(getToken: GetValidSpotifyTokenUseCase) {
    this.getToken = getToken
  }

  async execute(userId: string): Promise<{ accessToken: string }> {
    const accessToken = await this.getToken.execute(userId)
    return { accessToken }
  }
}

export class GetSpotifyPlaybackUseCase {
  private readonly getToken: GetValidSpotifyTokenUseCase
  private readonly spotify: ISpotifyClient

  constructor(getToken: GetValidSpotifyTokenUseCase, spotify: ISpotifyClient) {
    this.getToken = getToken
    this.spotify = spotify
  }

  async execute(userId: string): Promise<SpotifyPlaybackState | null> {
    const accessToken = await this.getToken.execute(userId)
    return this.spotify.getCurrentPlayback(accessToken)
  }
}

export class ControlSpotifyPlaybackUseCase {
  private readonly getToken: GetValidSpotifyTokenUseCase
  private readonly spotify: ISpotifyClient

  constructor(getToken: GetValidSpotifyTokenUseCase, spotify: ISpotifyClient) {
    this.getToken = getToken
    this.spotify = spotify
  }

  async execute(userId: string, action: SpotifyPlaybackAction, deviceId?: string): Promise<void> {
    const accessToken = await this.getToken.execute(userId)
    await this.spotify.controlPlayback(accessToken, action, deviceId)
  }
}

export class SetSpotifyVolumeUseCase {
  private readonly getToken: GetValidSpotifyTokenUseCase
  private readonly spotify: ISpotifyClient

  constructor(getToken: GetValidSpotifyTokenUseCase, spotify: ISpotifyClient) {
    this.getToken = getToken
    this.spotify = spotify
  }

  async execute(userId: string, volumePercent: number, deviceId?: string): Promise<void> {
    const accessToken = await this.getToken.execute(userId)
    await this.spotify.setVolume(accessToken, volumePercent, deviceId)
  }
}

export class SeekSpotifyPlaybackUseCase {
  private readonly getToken: GetValidSpotifyTokenUseCase
  private readonly spotify: ISpotifyClient

  constructor(getToken: GetValidSpotifyTokenUseCase, spotify: ISpotifyClient) {
    this.getToken = getToken
    this.spotify = spotify
  }

  async execute(userId: string, positionMs: number, deviceId?: string): Promise<void> {
    const accessToken = await this.getToken.execute(userId)
    await this.spotify.seek(accessToken, positionMs, deviceId)
  }
}

export class SearchSpotifyUseCase {
  private readonly getToken: GetValidSpotifyTokenUseCase
  private readonly spotify: ISpotifyClient

  constructor(getToken: GetValidSpotifyTokenUseCase, spotify: ISpotifyClient) {
    this.getToken = getToken
    this.spotify = spotify
  }

  async execute(userId: string, query: string): Promise<SpotifySearchResults> {
    const accessToken = await this.getToken.execute(userId)
    return this.spotify.search(accessToken, query)
  }
}

export class ListSpotifyPlaylistsUseCase {
  private readonly getToken: GetValidSpotifyTokenUseCase
  private readonly spotify: ISpotifyClient

  constructor(getToken: GetValidSpotifyTokenUseCase, spotify: ISpotifyClient) {
    this.getToken = getToken
    this.spotify = spotify
  }

  async execute(userId: string): Promise<SpotifySearchResultPlaylist[]> {
    const accessToken = await this.getToken.execute(userId)
    return this.spotify.getUserPlaylists(accessToken)
  }
}

export class GetSpotifyPlaylistTracksUseCase {
  private readonly getToken: GetValidSpotifyTokenUseCase
  private readonly spotify: ISpotifyClient

  constructor(getToken: GetValidSpotifyTokenUseCase, spotify: ISpotifyClient) {
    this.getToken = getToken
    this.spotify = spotify
  }

  async execute(userId: string, playlistId: string): Promise<SpotifySearchResultTrack[]> {
    const accessToken = await this.getToken.execute(userId)
    return this.spotify.getPlaylistTracks(accessToken, playlistId)
  }
}

export class GetSpotifyAlbumTracksUseCase {
  private readonly getToken: GetValidSpotifyTokenUseCase
  private readonly spotify: ISpotifyClient

  constructor(getToken: GetValidSpotifyTokenUseCase, spotify: ISpotifyClient) {
    this.getToken = getToken
    this.spotify = spotify
  }

  async execute(userId: string, albumId: string): Promise<SpotifySearchResultTrack[]> {
    const accessToken = await this.getToken.execute(userId)
    return this.spotify.getAlbumTracks(accessToken, albumId)
  }
}

export class GetSpotifyArtistTracksUseCase {
  private readonly getToken: GetValidSpotifyTokenUseCase
  private readonly spotify: ISpotifyClient

  constructor(getToken: GetValidSpotifyTokenUseCase, spotify: ISpotifyClient) {
    this.getToken = getToken
    this.spotify = spotify
  }

  async execute(userId: string, artistName: string): Promise<SpotifySearchResultTrack[]> {
    const accessToken = await this.getToken.execute(userId)
    return this.spotify.getArtistTracks(accessToken, artistName)
  }
}

export class PlaySpotifySelectionUseCase {
  private readonly getToken: GetValidSpotifyTokenUseCase
  private readonly spotify: ISpotifyClient

  constructor(getToken: GetValidSpotifyTokenUseCase, spotify: ISpotifyClient) {
    this.getToken = getToken
    this.spotify = spotify
  }

  async execute(userId: string, selection: SpotifyPlaySelection): Promise<void> {
    const accessToken = await this.getToken.execute(userId)
    if ('trackUri' in selection) {
      await this.spotify.playTrack(accessToken, selection.trackUri, selection.deviceId)
    } else {
      await this.spotify.playContext(accessToken, selection.contextUri, selection.offsetUri, selection.deviceId)
    }
  }
}

export class ListConnectionsUseCase {
  private readonly connections: IConnectionRepository

  constructor(connections: IConnectionRepository) {
    this.connections = connections
  }

  // Deliberately strips tokens/expiry — only connection status + display name
  // are safe to return to the client.
  async execute(userId: string): Promise<ConnectionSummary[]> {
    const rows = await this.connections.listByUser(userId)
    return rows.map((r) => ({ provider: r.provider, connected: true, displayName: r.displayName, isPremium: r.isPremium }))
  }
}

export class DisconnectUseCase {
  private readonly connections: IConnectionRepository

  constructor(connections: IConnectionRepository) {
    this.connections = connections
  }

  async execute(userId: string, provider: string): Promise<void> {
    await this.connections.deleteByUserAndProvider(userId, provider)
  }
}
