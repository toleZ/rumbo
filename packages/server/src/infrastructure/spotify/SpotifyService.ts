import { env } from '../../env.js'
import type {
  ISpotifyClient,
  SpotifyTokenResult,
  SpotifyProfile,
  SpotifyPlaybackState,
  SpotifyPlaybackAction,
  SpotifySearchResults,
  SpotifySearchResultTrack,
  SpotifySearchResultArtist,
  SpotifySearchResultAlbum,
  SpotifySearchResultPlaylist,
} from '../../application/ports/ISpotifyClient.js'
import { SpotifyPlaybackUnavailableError } from '../../application/ports/ISpotifyClient.js'
import { NotFoundError } from '../../domain/errors.js'

const ACCOUNTS_URL = 'https://accounts.spotify.com'
const API_URL = 'https://api.spotify.com/v1'

// Read-only now-playing + play/pause/skip control (`user-modify-playback-state`
// requires Spotify Premium and an active device — see SpotifyPlaybackUnavailableError),
// reading the user's playlist library for Browse (`playlist-read-private`/
// `-collaborative`), `streaming` for the Web Playback SDK (makes the Rumbo tab itself a
// controllable device), and `user-read-private` so `/me`'s `product` field tells us
// whether the account is Premium (the SDK requires it). Any scope added here means
// anyone connected before it existed needs to reconnect (Settings > Connections >
// Disconnect, then Connect again) before the new capability works for them.
const SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private playlist-read-collaborative streaming user-read-private'

interface SpotifyImage { url: string }
interface SpotifyArtistRef { name: string }
interface SpotifyTrackItem {
  uri: string
  name: string
  duration_ms: number
  artists: SpotifyArtistRef[]
  album?: { images: SpotifyImage[] }
}
interface SpotifyArtistItem { uri: string; name: string; images: SpotifyImage[] }
interface SpotifyAlbumItem { uri: string; name: string; artists: SpotifyArtistRef[]; images: SpotifyImage[] }
interface SpotifyPlaylistItem {
  uri: string
  name: string
  owner?: { display_name: string | null }
  images: SpotifyImage[] | null
  // Renamed from `tracks` as part of Spotify's Feb 2026 Web API migration (confirmed
  // live: `/me/playlists` and `/search?type=playlist` items now carry this count under
  // `items.total`, not `tracks.total` — the old field is simply absent).
  items?: { total: number }
}

function toTrack(t: SpotifyTrackItem): SpotifySearchResultTrack {
  return {
    uri: t.uri,
    name: t.name,
    artist: (t.artists ?? []).map((a) => a.name).join(', '),
    albumArt: t.album?.images?.[0]?.url ?? null,
    durationMs: t.duration_ms ?? 0,
  }
}

function toArtist(a: SpotifyArtistItem): SpotifySearchResultArtist {
  return { uri: a.uri, name: a.name, imageUrl: a.images?.[0]?.url ?? null }
}

function toAlbum(al: SpotifyAlbumItem): SpotifySearchResultAlbum {
  return {
    uri: al.uri,
    name: al.name,
    artist: (al.artists ?? []).map((a) => a.name).join(', '),
    imageUrl: al.images?.[0]?.url ?? null,
  }
}

function toPlaylist(p: SpotifyPlaylistItem): SpotifySearchResultPlaylist {
  return {
    uri: p.uri,
    name: p.name,
    ownerName: p.owner?.display_name ?? null,
    imageUrl: p.images?.[0]?.url ?? null,
    trackCount: p.items?.total ?? 0,
  }
}

export class SpotifyService implements ISpotifyClient {
  getAuthorizeUrl(state: string, codeChallenge: string): string {
    const params = new URLSearchParams({
      client_id: env.SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: env.SPOTIFY_REDIRECT_URI,
      state,
      scope: SCOPES,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
    })
    return `${ACCOUNTS_URL}/authorize?${params.toString()}`
  }

  async exchangeCode(code: string, codeVerifier: string): Promise<SpotifyTokenResult> {
    return this.requestToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: env.SPOTIFY_REDIRECT_URI,
      code_verifier: codeVerifier,
    })
  }

  async refreshAccessToken(refreshToken: string): Promise<SpotifyTokenResult> {
    return this.requestToken({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }, refreshToken)
  }

  async getProfile(accessToken: string): Promise<SpotifyProfile> {
    const res = await fetch(`${API_URL}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) throw new Error(`Spotify getProfile error ${res.status}`)
    const data = await res.json()
    // `product` is only present with the `user-read-private` scope — omitted (not
    // errored) otherwise, so this degrades gracefully for tokens without it.
    return { id: data.id, displayName: data.display_name ?? null, product: data.product ?? null }
  }

  async getCurrentPlayback(accessToken: string): Promise<SpotifyPlaybackState | null> {
    const res = await fetch(`${API_URL}/me/player`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    // 204 = nothing currently playing (no active session at all).
    if (res.status === 204) return null
    if (!res.ok) throw new Error(`Spotify getCurrentPlayback error ${res.status}`)

    const data = await res.json()
    const item = data.item
    return {
      isPlaying: Boolean(data.is_playing),
      progressMs: data.progress_ms ?? 0,
      device: data.device
        ? { name: data.device.name, volumePercent: data.device.volume_percent ?? null }
        : null,
      track: item
        ? {
            name: item.name,
            artist: (item.artists ?? []).map((a: { name: string }) => a.name).join(', '),
            albumArt: item.album?.images?.[0]?.url ?? null,
            durationMs: item.duration_ms ?? 0,
          }
        : null,
    }
  }

  async controlPlayback(accessToken: string, action: SpotifyPlaybackAction, deviceId?: string): Promise<void> {
    const method = action === 'next' || action === 'previous' ? 'POST' : 'PUT'
    const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : ''
    const res = await fetch(`${API_URL}/me/player/${action}${query}`, {
      method,
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    this.assertPlaybackOk(res.status)
  }

  async setVolume(accessToken: string, volumePercent: number, deviceId?: string): Promise<void> {
    const clamped = Math.max(0, Math.min(100, Math.round(volumePercent)))
    const params = new URLSearchParams({ volume_percent: String(clamped) })
    if (deviceId) params.set('device_id', deviceId)
    const res = await fetch(`${API_URL}/me/player/volume?${params.toString()}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    this.assertPlaybackOk(res.status)
  }

  async seek(accessToken: string, positionMs: number, deviceId?: string): Promise<void> {
    const params = new URLSearchParams({ position_ms: String(Math.max(0, Math.round(positionMs))) })
    if (deviceId) params.set('device_id', deviceId)
    const res = await fetch(`${API_URL}/me/player/seek?${params.toString()}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    this.assertPlaybackOk(res.status)
  }

  // Single request returns all four categories, keyed tracks/artists/albums/playlists —
  // each `{ items: [...] }`. Items can be `null` (removed tracks, deleted playlists),
  // hence the `.filter(Boolean)` before mapping.
  async search(accessToken: string, query: string): Promise<SpotifySearchResults> {
    const params = new URLSearchParams({
      q: query,
      type: 'track,artist,album,playlist',
      limit: '5',
    })
    const res = await fetch(`${API_URL}/search?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) throw new Error(`Spotify search error ${res.status}`)
    const data = await res.json()

    return {
      tracks: ((data.tracks?.items ?? []) as (SpotifyTrackItem | null)[]).filter((t): t is SpotifyTrackItem => Boolean(t)).map(toTrack),
      artists: ((data.artists?.items ?? []) as (SpotifyArtistItem | null)[]).filter((a): a is SpotifyArtistItem => Boolean(a)).map(toArtist),
      albums: ((data.albums?.items ?? []) as (SpotifyAlbumItem | null)[]).filter((a): a is SpotifyAlbumItem => Boolean(a)).map(toAlbum),
      playlists: ((data.playlists?.items ?? []) as (SpotifyPlaylistItem | null)[]).filter((p): p is SpotifyPlaylistItem => Boolean(p)).map(toPlaylist),
    }
  }

  async getUserPlaylists(accessToken: string): Promise<SpotifySearchResultPlaylist[]> {
    const res = await fetch(`${API_URL}/me/playlists?limit=50`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) throw new Error(`Spotify getUserPlaylists error ${res.status}`)
    const data = await res.json()
    return ((data.items ?? []) as (SpotifyPlaylistItem | null)[])
      .filter((p): p is SpotifyPlaylistItem => Boolean(p))
      .map(toPlaylist)
  }

  // Uses the `/items` sub-resource, not the older `/tracks` one — Spotify has migrated
  // playlist item access there (confirmed live: `/tracks` 403s "Forbidden" even for a
  // plain, self-owned playlist with full playlist-read-private scope granted, while
  // `/items` returns 200 with identical data under an `item` key instead of `track`).
  async getPlaylistTracks(accessToken: string, playlistId: string): Promise<SpotifySearchResultTrack[]> {
    const fields = encodeURIComponent('items(item(uri,name,duration_ms,artists(name),album(images)))')
    const res = await fetch(`${API_URL}/playlists/${playlistId}/items?limit=50&fields=${fields}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) {
      const body = await res.text()
      console.error(`Spotify getPlaylistTracks error ${res.status} for playlist ${playlistId}: ${body}`)
      // Surface as NOT_FOUND (via NotFoundError) so the widget can tell "couldn't load"
      // apart from "genuinely empty" rather than reusing the unrelated playback-control
      // CONFLICT error.
      if (res.status === 403 || res.status === 404) throw new NotFoundError('Playlist tracks unavailable')
      throw new Error(`Spotify getPlaylistTracks error ${res.status}`)
    }
    const data = await res.json()
    // Entries can hold a null `item` (removed track) or a podcast episode
    // (different shape, no `duration_ms`/`artists` in the same form) — only keep real tracks.
    return ((data.items ?? []) as { item: SpotifyTrackItem | null }[])
      .map((entry) => entry.item)
      .filter((t): t is SpotifyTrackItem => Boolean(t?.uri))
      .map(toTrack)
  }

  // Unlike playlists, albums are pure catalog data with no "owner" concept — no
  // equivalent ownership restriction applies here, confirmed against Spotify's docs.
  // Track items from this endpoint have no per-track `album` field (all tracks share the
  // same cover) — `toTrack`'s optional chaining on `t.album?.images` already degrades to
  // `albumArt: null` for these, which is fine: the client renders the album's own cover
  // (already known client-side from the search result) for every row instead.
  async getAlbumTracks(accessToken: string, albumId: string): Promise<SpotifySearchResultTrack[]> {
    const res = await fetch(`${API_URL}/albums/${albumId}/tracks?limit=50`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) {
      const body = await res.text()
      console.error(`Spotify getAlbumTracks error ${res.status} for album ${albumId}: ${body}`)
      throw new Error(`Spotify getAlbumTracks error ${res.status}`)
    }
    const data = await res.json()
    return ((data.items ?? []) as (SpotifyTrackItem | null)[])
      .filter((t): t is SpotifyTrackItem => Boolean(t?.uri))
      .map(toTrack)
  }

  // Spotify's actual "Get Artist's Top Tracks" endpoint (GET /artists/{id}/top-tracks) was
  // removed entirely in the Feb 2026 API migration for Development Mode apps (confirmed
  // live: 403 regardless of market param, and Spotify's own changelog lists it as
  // removed/restricted) — there's no fix, so this uses a relevance search filtered to the
  // artist by name instead (`q=artist:"{name}"&type=track`), which is unaffected and, per
  // live testing, surfaces genuinely well-known tracks (search relevance loosely tracks
  // popularity). Note: this endpoint shape also rejects `limit` above ~10 for this
  // single-type + field-filtered query (confirmed live: 400 "Invalid limit" at 20+) —
  // capped at 10 here, which is plenty for a track-list preview.
  async getArtistTracks(accessToken: string, artistName: string): Promise<SpotifySearchResultTrack[]> {
    const params = new URLSearchParams({ q: `artist:"${artistName}"`, type: 'track', limit: '10' })
    const res = await fetch(`${API_URL}/search?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) {
      const body = await res.text()
      console.error(`Spotify getArtistTracks error ${res.status} for artist "${artistName}": ${body}`)
      throw new Error(`Spotify getArtistTracks error ${res.status}`)
    }
    const data = await res.json()
    return ((data.tracks?.items ?? []) as (SpotifyTrackItem | null)[])
      .filter((t): t is SpotifyTrackItem => Boolean(t?.uri))
      .map(toTrack)
  }

  async playTrack(accessToken: string, trackUri: string, deviceId?: string): Promise<void> {
    const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : ''
    const res = await fetch(`${API_URL}/me/player/play${query}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: [trackUri] }),
    })
    this.assertPlaybackOk(res.status)
  }

  async playContext(accessToken: string, contextUri: string, offsetTrackUri?: string, deviceId?: string): Promise<void> {
    const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : ''
    const res = await fetch(`${API_URL}/me/player/play${query}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context_uri: contextUri,
        ...(offsetTrackUri ? { offset: { uri: offsetTrackUri } } : {}),
      }),
    })
    this.assertPlaybackOk(res.status)
  }

  // Spotify returns 403 (Premium required) or 404 (no active device) for playback
  // control on accounts/sessions that can't take the action — surface both as the
  // same "unavailable" case so the widget can show one graceful message.
  private assertPlaybackOk(status: number): void {
    if (status === 204 || status === 200) return
    if (status === 403 || status === 404) throw new SpotifyPlaybackUnavailableError()
    throw new Error(`Spotify playback control error ${status}`)
  }

  private async requestToken(
    params: Record<string, string>,
    fallbackRefreshToken?: string,
  ): Promise<SpotifyTokenResult> {
    const body = new URLSearchParams({ ...params, client_id: env.SPOTIFY_CLIENT_ID })
    const basic = Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString('base64')

    const res = await fetch(`${ACCOUNTS_URL}/api/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basic}`,
      },
      body: body.toString(),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Spotify token error ${res.status}: ${text}`)
    }

    const data = await res.json()
    return {
      accessToken: data.access_token,
      // Spotify only rotates the refresh token sometimes — keep the existing one otherwise.
      refreshToken: data.refresh_token ?? fallbackRefreshToken ?? '',
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope ?? '',
    }
  }
}
