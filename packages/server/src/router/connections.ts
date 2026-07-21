import { router, protectedProcedure } from '../trpc.js'
import {
  disconnectConnectionSchema,
  spotifyControlSchema,
  spotifySetVolumeSchema,
  spotifySeekSchema,
  spotifySearchSchema,
  spotifyPlaylistTracksSchema,
  spotifyAlbumTracksSchema,
  spotifyArtistTracksSchema,
  spotifyPlaySchema,
} from '@rumbo/shared'
import { SpotifyService } from '../infrastructure/spotify/SpotifyService.js'
import {
  ListConnectionsUseCase,
  DisconnectUseCase,
  GetValidSpotifyTokenUseCase,
  GetSpotifyPlaybackTokenUseCase,
  GetSpotifyPlaybackUseCase,
  ControlSpotifyPlaybackUseCase,
  SetSpotifyVolumeUseCase,
  SeekSpotifyPlaybackUseCase,
  SearchSpotifyUseCase,
  ListSpotifyPlaylistsUseCase,
  GetSpotifyPlaylistTracksUseCase,
  GetSpotifyAlbumTracksUseCase,
  GetSpotifyArtistTracksUseCase,
  PlaySpotifySelectionUseCase,
} from '../application/use-cases/connections/ConnectionUseCases.js'

// Stateless adapter, safe to share across requests (mirrors OpenRouterService's
// per-request instantiation pattern in AssistantChatUseCase's caller).
const spotify = new SpotifyService()

export const connectionsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return new ListConnectionsUseCase(ctx.connections).execute(ctx.userId)
  }),

  disconnect: protectedProcedure.input(disconnectConnectionSchema).mutation(async ({ ctx, input }) => {
    await new DisconnectUseCase(ctx.connections).execute(ctx.userId, input.provider)
    return { success: true }
  }),

  spotifyPlayback: protectedProcedure.query(async ({ ctx }) => {
    const getToken = new GetValidSpotifyTokenUseCase(ctx.connections, spotify)
    return new GetSpotifyPlaybackUseCase(getToken, spotify).execute(ctx.userId)
  }),

  // Used only by the Web Playback SDK's getOAuthToken callback (client-side player) —
  // see GetSpotifyPlaybackTokenUseCase for why this is the sole endpoint that returns
  // a raw Spotify token.
  spotifyPlaybackToken: protectedProcedure.query(async ({ ctx }) => {
    const getToken = new GetValidSpotifyTokenUseCase(ctx.connections, spotify)
    return new GetSpotifyPlaybackTokenUseCase(getToken).execute(ctx.userId)
  }),

  spotifyControl: protectedProcedure.input(spotifyControlSchema).mutation(async ({ ctx, input }) => {
    const getToken = new GetValidSpotifyTokenUseCase(ctx.connections, spotify)
    await new ControlSpotifyPlaybackUseCase(getToken, spotify).execute(ctx.userId, input.action, input.deviceId)
    return { success: true }
  }),

  spotifySetVolume: protectedProcedure.input(spotifySetVolumeSchema).mutation(async ({ ctx, input }) => {
    const getToken = new GetValidSpotifyTokenUseCase(ctx.connections, spotify)
    await new SetSpotifyVolumeUseCase(getToken, spotify).execute(ctx.userId, input.volumePercent, input.deviceId)
    return { success: true }
  }),

  spotifySeek: protectedProcedure.input(spotifySeekSchema).mutation(async ({ ctx, input }) => {
    const getToken = new GetValidSpotifyTokenUseCase(ctx.connections, spotify)
    await new SeekSpotifyPlaybackUseCase(getToken, spotify).execute(ctx.userId, input.positionMs, input.deviceId)
    return { success: true }
  }),

  spotifySearch: protectedProcedure.input(spotifySearchSchema).query(async ({ ctx, input }) => {
    const getToken = new GetValidSpotifyTokenUseCase(ctx.connections, spotify)
    return new SearchSpotifyUseCase(getToken, spotify).execute(ctx.userId, input.query)
  }),

  spotifyPlaylists: protectedProcedure.query(async ({ ctx }) => {
    const getToken = new GetValidSpotifyTokenUseCase(ctx.connections, spotify)
    return new ListSpotifyPlaylistsUseCase(getToken, spotify).execute(ctx.userId)
  }),

  spotifyPlaylistTracks: protectedProcedure.input(spotifyPlaylistTracksSchema).query(async ({ ctx, input }) => {
    const getToken = new GetValidSpotifyTokenUseCase(ctx.connections, spotify)
    return new GetSpotifyPlaylistTracksUseCase(getToken, spotify).execute(ctx.userId, input.playlistId)
  }),

  spotifyAlbumTracks: protectedProcedure.input(spotifyAlbumTracksSchema).query(async ({ ctx, input }) => {
    const getToken = new GetValidSpotifyTokenUseCase(ctx.connections, spotify)
    return new GetSpotifyAlbumTracksUseCase(getToken, spotify).execute(ctx.userId, input.albumId)
  }),

  spotifyArtistTracks: protectedProcedure.input(spotifyArtistTracksSchema).query(async ({ ctx, input }) => {
    const getToken = new GetValidSpotifyTokenUseCase(ctx.connections, spotify)
    return new GetSpotifyArtistTracksUseCase(getToken, spotify).execute(ctx.userId, input.artistName)
  }),

  spotifyPlay: protectedProcedure.input(spotifyPlaySchema).mutation(async ({ ctx, input }) => {
    const getToken = new GetValidSpotifyTokenUseCase(ctx.connections, spotify)
    await new PlaySpotifySelectionUseCase(getToken, spotify).execute(ctx.userId, input)
    return { success: true }
  }),
})
