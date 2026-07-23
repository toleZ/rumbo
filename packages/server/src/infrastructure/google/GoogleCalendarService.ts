import { env } from '../../env.js'
import {
  GoogleAuthRevokedError,
  GoogleEventNotFoundError,
  type IGoogleCalendarClient,
  type GoogleTokenResult,
  type GoogleProfile,
  type GoogleCalendarEvent,
  type GoogleCalendarListEntry,
  type GoogleEventInput,
} from '../../application/ports/IGoogleCalendarClient.js'

const ACCOUNTS_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'

// calendar.events: read/write event data. calendar.calendarlist.readonly: needed
// separately for the calendar picker (calendarList.list is NOT covered by
// calendar.events — verified against Google's own API reference). userinfo.email: to
// show "Connected as ..." in Settings — narrower than `profile`, which isn't needed just
// to display an email address.
// NOTE: existing connections predating calendarlist.readonly won't have it until the
// user reconnects — listCalendars will fail for them until then (handled gracefully by
// the settings UI, not a hard error).
const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/userinfo.email'

interface GoogleEventDate { date?: string; dateTime?: string; timeZone?: string }
interface GoogleEventItem {
  id: string
  summary?: string
  start: GoogleEventDate
  end: GoogleEventDate
  htmlLink: string
  status?: string // 'cancelled' entries can still appear in an incremental sync; harmless here since we don't use sync tokens
  location?: string
  description?: string
}

// Google's all-day events use an EXCLUSIVE end date (a single day on the 22nd has
// start.date="2026-07-22", end.date="2026-07-23") — Rumbo's own Task.dueDate is
// INCLUSIVE (matching how the Calendar page already renders multi-day task bars), so
// every boundary crosses this file needs an explicit +1/-1 day conversion. Done in UTC
// on the plain date string to avoid local-timezone off-by-one drift.
function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function toGoogleEvent(item: GoogleEventItem): GoogleCalendarEvent {
  const isAllDay = Boolean(item.start.date)
  return {
    id: item.id,
    title: item.summary ?? '',
    start: item.start.date ?? item.start.dateTime ?? '',
    // Convert Google's exclusive all-day end back to Rumbo's inclusive convention.
    end: isAllDay && item.end.date ? addDays(item.end.date, -1) : (item.end.dateTime ?? item.end.date ?? ''),
    isAllDay,
    htmlLink: item.htmlLink,
    location: item.location,
    description: item.description,
  }
}

export class GoogleCalendarService implements IGoogleCalendarClient {
  getAuthorizeUrl(state: string, codeChallenge: string): string {
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      response_type: 'code',
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      state,
      scope: SCOPES,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      // access_type=offline is required to get a refresh token at all; prompt=consent
      // forces Google to reissue one on every authorization, not just the very first —
      // without both, a user who reconnects (e.g. after disconnecting) would silently
      // get no refresh token and the connection would stop working at the next access
      // token expiry with no obvious cause.
      access_type: 'offline',
      prompt: 'consent',
    })
    return `${ACCOUNTS_URL}?${params.toString()}`
  }

  async exchangeCode(code: string, codeVerifier: string): Promise<GoogleTokenResult> {
    return this.requestToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      code_verifier: codeVerifier,
    })
  }

  async refreshAccessToken(refreshToken: string): Promise<GoogleTokenResult> {
    return this.requestToken({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }, refreshToken)
  }

  async getProfile(accessToken: string): Promise<GoogleProfile> {
    const res = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) throw new Error(`Google getProfile error ${res.status}`)
    const data = await res.json()
    return { email: data.email, name: data.name ?? null }
  }

  async listCalendars(accessToken: string): Promise<GoogleCalendarListEntry[]> {
    const res = await fetch(`${CALENDAR_API}/users/me/calendarList?minAccessRole=writer`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) {
      const body = await res.text()
      console.error(`Google listCalendars error ${res.status}: ${body}`)
      throw new Error(`Google listCalendars error ${res.status}`)
    }
    const data = await res.json()
    return ((data.items ?? []) as Array<{ id: string; summary: string; primary?: boolean }>)
      .map((item) => ({ id: item.id, summary: item.summary, primary: Boolean(item.primary) }))
  }

  async listEvents(accessToken: string, timeMinISO: string, timeMaxISO: string, calendarId?: string | null): Promise<GoogleCalendarEvent[]> {
    const params = new URLSearchParams({
      timeMin: timeMinISO,
      timeMax: timeMaxISO,
      // Expands recurring events into individual occurrences with concrete dates —
      // without this, a recurring event returns only the master with an RRULE, which
      // this read-only overlay has no interest in resolving itself.
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    })
    const res = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId || 'primary')}/events?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) {
      const body = await res.text()
      console.error(`Google listEvents error ${res.status}: ${body}`)
      throw new Error(`Google listEvents error ${res.status}`)
    }
    const data = await res.json()
    return ((data.items ?? []) as GoogleEventItem[])
      .filter((item) => item.status !== 'cancelled')
      .map(toGoogleEvent)
  }

  private toEventBody(input: GoogleEventInput) {
    return {
      summary: input.title,
      start: { date: input.startDate },
      // Convert Rumbo's inclusive end date to Google's exclusive convention.
      end: { date: addDays(input.endDate, 1) },
    }
  }

  async createEvent(accessToken: string, calendarId: string | null, input: GoogleEventInput): Promise<{ eventId: string; htmlLink: string }> {
    const res = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId || 'primary')}/events`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(this.toEventBody(input)),
    })
    if (!res.ok) {
      const errBody = await res.text()
      console.error(`Google createEvent error ${res.status}: ${errBody}`)
      throw new Error(`Google createEvent error ${res.status}`)
    }
    const data = await res.json()
    return { eventId: data.id, htmlLink: data.htmlLink }
  }

  async updateEvent(accessToken: string, calendarId: string | null, eventId: string, input: GoogleEventInput): Promise<{ eventId: string; htmlLink: string }> {
    const res = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId || 'primary')}/events/${eventId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(this.toEventBody(input)),
    })
    if (res.ok) {
      const data = await res.json()
      return { eventId: data.id, htmlLink: data.htmlLink }
    }
    // The event doesn't exist in this calendar — deleted directly in Google, or it lives
    // in a different calendar than the one being targeted. The caller decides what to do
    // (e.g. fall back to creating a fresh event) rather than that being baked in here.
    if (res.status === 404 || res.status === 410) {
      throw new GoogleEventNotFoundError(`Google event ${eventId} not found in calendar ${calendarId ?? 'primary'}`)
    }
    const errBody = await res.text()
    console.error(`Google updateEvent error ${res.status}: ${errBody}`)
    throw new Error(`Google updateEvent error ${res.status}`)
  }

  async deleteEvent(accessToken: string, calendarId: string | null, eventId: string): Promise<void> {
    const res = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId || 'primary')}/events/${eventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    // 404/410 means the event is already gone (e.g. deleted directly in Google) —
    // that's the desired end state for a delete, not a failure.
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      const errBody = await res.text()
      console.error(`Google deleteEvent error ${res.status}: ${errBody}`)
      throw new Error(`Google deleteEvent error ${res.status}`)
    }
  }

  private async requestToken(
    params: Record<string, string>,
    fallbackRefreshToken?: string,
  ): Promise<GoogleTokenResult> {
    const body = new URLSearchParams({
      ...params,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
    })
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    if (!res.ok) {
      const text = await res.text()
      // Google returns 400 invalid_grant when the refresh token has been revoked
      // (user revoked access, or reused/expired grant) — distinguish this so callers
      // can prompt a reconnect instead of treating it as a generic/transient failure.
      if (res.status === 400 && /invalid_grant/i.test(text)) {
        throw new GoogleAuthRevokedError(`Google auth revoked: ${text}`)
      }
      throw new Error(`Google token error ${res.status}: ${text}`)
    }

    const data = await res.json()
    return {
      accessToken: data.access_token,
      // Only present on the initial (or prompt=consent-forced) authorization — keep the
      // existing one on a plain refresh_token grant, which never returns a new one.
      refreshToken: data.refresh_token ?? fallbackRefreshToken ?? '',
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope ?? '',
    }
  }
}
