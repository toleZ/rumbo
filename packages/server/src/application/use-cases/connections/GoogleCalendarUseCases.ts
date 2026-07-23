import { NotFoundError, BadRequestError, UnauthorizedError } from '../../../domain/errors.js'
import type { IConnectionRepository } from '../../../domain/repositories/IConnectionRepository.js'
import type { ITaskRepository } from '../../../domain/repositories/ITaskRepository.js'
import type { IAuthRepository, UpdateGoogleSyncSettingsInput } from '../../../domain/repositories/IAuthRepository.js'
import {
  GoogleAuthRevokedError,
  GoogleEventNotFoundError,
  type IGoogleCalendarClient,
  type GoogleCalendarEvent,
  type GoogleCalendarListEntry,
} from '../../ports/IGoogleCalendarClient.js'
import type { GoogleSyncSettings, GoogleAutoSyncMode, Task } from '@rumbo/shared'
import { encrypt, decrypt } from '../../../infrastructure/crypto/tokenCipher.js'

export const GOOGLE_PROVIDER = 'google_calendar'

// Buckets a stored UTC instant into the account's own calendar day — the server has no
// notion of "the user's timezone" otherwise (unlike the browser-side eventDayKey, which
// can fall back to the browser's own zone). Falls back to UTC, matching this code's
// previous (less accurate) behavior, only when the user hasn't set one in Settings.
function toLocalDateKey(iso: string, timezone: string | null): string {
  const tz = timezone || 'UTC'
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}

export class ConnectGoogleUseCase {
  private readonly connections: IConnectionRepository
  private readonly google: IGoogleCalendarClient

  constructor(connections: IConnectionRepository, google: IGoogleCalendarClient) {
    this.connections = connections
    this.google = google
  }

  async execute(userId: string, code: string, codeVerifier: string): Promise<void> {
    const tokens = await this.google.exchangeCode(code, codeVerifier)
    const profile = await this.google.getProfile(tokens.accessToken)

    await this.connections.upsert({
      userId,
      provider: GOOGLE_PROVIDER,
      accessToken: encrypt(tokens.accessToken),
      refreshToken: encrypt(tokens.refreshToken),
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
      providerUserId: profile.email,
      displayName: profile.name ?? profile.email,
      isPremium: null, // Spotify-only field, always null for Google rows
    })
  }
}

// Mirrors GetValidSpotifyTokenUseCase's refresh-and-upsert pattern exactly.
export class GetValidGoogleTokenUseCase {
  private readonly connections: IConnectionRepository
  private readonly google: IGoogleCalendarClient

  constructor(connections: IConnectionRepository, google: IGoogleCalendarClient) {
    this.connections = connections
    this.google = google
  }

  async execute(userId: string): Promise<string> {
    const conn = await this.connections.findByUserAndProvider(userId, GOOGLE_PROVIDER)
    if (!conn) throw new NotFoundError('Google Calendar no está conectado')

    // 30s safety margin so we never hand out a token that expires mid-request.
    if (conn.expiresAt.getTime() > Date.now() + 30_000) {
      return decrypt(conn.accessToken)
    }

    let refreshed
    try {
      refreshed = await this.google.refreshAccessToken(decrypt(conn.refreshToken))
    } catch (err) {
      if (err instanceof GoogleAuthRevokedError) {
        throw new UnauthorizedError('Google Calendar access was revoked. Please reconnect.')
      }
      throw err
    }
    await this.connections.upsert({
      userId,
      provider: GOOGLE_PROVIDER,
      accessToken: encrypt(refreshed.accessToken),
      refreshToken: encrypt(refreshed.refreshToken),
      expiresAt: refreshed.expiresAt,
      scope: refreshed.scope || conn.scope,
      providerUserId: conn.providerUserId,
      displayName: conn.displayName,
      isPremium: null,
    })
    return refreshed.accessToken
  }
}

export class ListGoogleCalendarEventsUseCase {
  private readonly getToken: GetValidGoogleTokenUseCase
  private readonly google: IGoogleCalendarClient
  private readonly auth: IAuthRepository

  constructor(getToken: GetValidGoogleTokenUseCase, google: IGoogleCalendarClient, auth: IAuthRepository) {
    this.getToken = getToken
    this.google = google
    this.auth = auth
  }

  async execute(userId: string, from: string, to: string): Promise<GoogleCalendarEvent[]> {
    const [accessToken, user] = await Promise.all([
      this.getToken.execute(userId),
      this.auth.findUserById(userId),
    ])
    return this.google.listEvents(accessToken, from, to, user?.googleCalendarId ?? null)
  }
}

export class PushTaskToGoogleCalendarUseCase {
  private readonly getToken: GetValidGoogleTokenUseCase
  private readonly google: IGoogleCalendarClient
  private readonly tasks: ITaskRepository
  private readonly auth: IAuthRepository

  constructor(getToken: GetValidGoogleTokenUseCase, google: IGoogleCalendarClient, tasks: ITaskRepository, auth: IAuthRepository) {
    this.getToken = getToken
    this.google = google
    this.tasks = tasks
    this.auth = auth
  }

  async execute(userId: string, taskId: string): Promise<{ eventId: string; htmlLink: string }> {
    const task = await this.tasks.findById(taskId)
    if (!task || task.boardUserId !== userId) {
      throw new NotFoundError('Task not found')
    }

    const user = await this.auth.findUserById(userId)
    if (user && user.googleSyncBoardIds.length > 0 && !user.googleSyncBoardIds.includes(task.boardId)) {
      throw new BadRequestError('This board is excluded from Google Calendar sync')
    }

    // Sorting the 1-2 present date keys works because YYYY-MM-DD sorts lexicographically =
    // chronologically — handles a single date, a normal range, or (defensively) a range
    // entered backwards, uniformly. Bucketed into the account's timezone (not a raw UTC
    // slice) so the date pushed to Google matches what Rumbo's own UI shows the user.
    const timezone = user?.timezone ?? null
    const dates = [task.scheduledDate, task.dueDate]
      .filter((d): d is string => Boolean(d))
      .map((d) => toLocalDateKey(d, timezone))
      .sort()
    if (dates.length === 0) {
      throw new BadRequestError('Task has no scheduled or due date to push')
    }

    const accessToken = await this.getToken.execute(userId)
    const input = { title: task.title, startDate: dates[0], endDate: dates[dates.length - 1] }

    if (task.googleCalendarEventId) {
      try {
        const result = await this.google.updateEvent(accessToken, task.googleCalendarEventCalendarId, task.googleCalendarEventId, input)
        await this.tasks.update(taskId, { googleCalendarEventUrl: result.htmlLink })
        return result
      } catch (err) {
        if (!(err instanceof GoogleEventNotFoundError)) throw err
        // Fall through: the linked event is gone (deleted directly in Google, or the link
        // outlived a target-calendar switch) — create a fresh one below instead of failing.
      }
    }

    const targetCalendarId = user?.googleCalendarId ?? null
    const result = await this.google.createEvent(accessToken, targetCalendarId, input)
    await this.tasks.update(taskId, {
      googleCalendarEventId: result.eventId,
      googleCalendarEventUrl: result.htmlLink,
      googleCalendarEventCalendarId: targetCalendarId,
    })
    return result
  }

  // Deletes the linked Google event (in whichever calendar it actually lives in) and
  // clears the task's link fields — used when a previously-synced task no longer has
  // anything to represent in Google Calendar (e.g. its dates were cleared).
  async unlinkAndDelete(userId: string, taskId: string): Promise<void> {
    const task = await this.tasks.findById(taskId)
    if (!task || task.boardUserId !== userId || !task.googleCalendarEventId) return
    const accessToken = await this.getToken.execute(userId)
    await this.google.deleteEvent(accessToken, task.googleCalendarEventCalendarId, task.googleCalendarEventId)
    await this.tasks.update(taskId, {
      googleCalendarEventId: null,
      googleCalendarEventUrl: null,
      googleCalendarEventCalendarId: null,
    })
  }
}

export class ListGoogleCalendarsUseCase {
  private readonly getToken: GetValidGoogleTokenUseCase
  private readonly google: IGoogleCalendarClient

  constructor(getToken: GetValidGoogleTokenUseCase, google: IGoogleCalendarClient) {
    this.getToken = getToken
    this.google = google
  }

  async execute(userId: string): Promise<GoogleCalendarListEntry[]> {
    const accessToken = await this.getToken.execute(userId)
    return this.google.listCalendars(accessToken)
  }
}

export class GetGoogleSyncSettingsUseCase {
  private readonly auth: IAuthRepository

  constructor(auth: IAuthRepository) {
    this.auth = auth
  }

  async execute(userId: string): Promise<GoogleSyncSettings> {
    const user = await this.auth.findUserById(userId)
    if (!user) throw new NotFoundError('User not found')
    return {
      autoSyncMode: (user.googleAutoSyncMode as GoogleAutoSyncMode) || 'off',
      syncBoardIds: user.googleSyncBoardIds,
      calendarId: user.googleCalendarId,
    }
  }
}

export class UpdateGoogleSyncSettingsUseCase {
  private readonly auth: IAuthRepository

  constructor(auth: IAuthRepository) {
    this.auth = auth
  }

  async execute(userId: string, data: UpdateGoogleSyncSettingsInput): Promise<void> {
    await this.auth.updateGoogleSyncSettings(userId, data)
  }
}

// Called after a task is created/updated to opportunistically push it to Google Calendar
// when the user's auto-sync setting calls for it — best-effort: any failure (not
// connected, board excluded, transient API error) is caught and logged, never surfaced to
// the caller, since this is a background convenience on top of an already-successful
// create/update, not something that should fail the user's edit.
export class MaybeAutoSyncTaskUseCase {
  private readonly auth: IAuthRepository
  private readonly push: PushTaskToGoogleCalendarUseCase

  constructor(auth: IAuthRepository, push: PushTaskToGoogleCalendarUseCase) {
    this.auth = auth
    this.push = push
  }

  async execute(userId: string, task: Task): Promise<void> {
    // Everything below — including the user lookup — is best-effort: this runs after an
    // already-successful task create/update, so nothing here may ever surface as a failure
    // of that create/update (a transient DB error here shouldn't make an already-saved
    // edit look like it failed).
    try {
      const user = await this.auth.findUserById(userId)
      if (!user) return
      const mode = (user.googleAutoSyncMode as GoogleAutoSyncMode) || 'off'
      if (mode === 'off') return
      const eligible = mode === 'all' || (mode === 'per_task' && task.googleAutoSync)
      if (!eligible) return

      if (!task.scheduledDate && !task.dueDate) {
        // A previously-synced task just lost its only date(s) — there's nothing left for
        // it to represent in Google Calendar, so remove the stale event instead of leaving
        // it showing old data forever.
        if (task.googleCalendarEventId) {
          await this.push.unlinkAndDelete(userId, task.id)
        }
        return
      }

      await this.push.execute(userId, task.id)
    } catch (err) {
      console.error(`[MaybeAutoSyncTaskUseCase] failed to auto-sync task ${task.id}:`, err)
    }
  }
}
