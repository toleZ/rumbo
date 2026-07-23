export interface GoogleTokenResult {
  accessToken: string
  refreshToken: string // Google only returns one on the very first consent, or every time if prompt=consent is forced — see GoogleCalendarService
  expiresAt: Date
  scope: string
}

export interface GoogleProfile {
  email: string
  name: string | null
}

export interface GoogleCalendarEvent {
  id: string
  title: string
  // Inclusive on both ends, ISO date (YYYY-MM-DD) for all-day events or ISO datetime for
  // timed ones — Google's own all-day `end.date` is exclusive; the service converts to
  // Rumbo's inclusive convention (matching how Task.dueDate is treated) before returning.
  start: string
  end: string
  isAllDay: boolean
  htmlLink: string
  location?: string
  description?: string
}

// Thrown by refreshAccessToken (and exchangeCode) when Google rejects the grant outright
// (e.g. `invalid_grant` — the user revoked Rumbo's access from their Google account) as
// opposed to a transient network/server failure. Defined on the port, not the
// infrastructure implementation, so both the application layer (which needs to catch it
// and map it to the domain's UnauthorizedError) and the infrastructure layer (which throws
// it) depend only on this shared contract.
export class GoogleAuthRevokedError extends Error {}

// Thrown by updateEvent when the target event id doesn't exist in the given calendar
// (deleted directly in Google, or the task's link points at a calendar the caller no
// longer has it in) — distinguished from a genuine failure so callers can decide whether
// to fall back to creating a fresh event, rather than that decision being baked into the
// infrastructure layer.
export class GoogleEventNotFoundError extends Error {}

export interface GoogleEventInput {
  title: string
  startDate: string // inclusive ISO date (YYYY-MM-DD)
  endDate: string // inclusive ISO date (YYYY-MM-DD) — same as startDate for a single-day task
}

export interface GoogleCalendarListEntry {
  id: string
  summary: string
  primary: boolean
}

export interface IGoogleCalendarClient {
  getAuthorizeUrl(state: string, codeChallenge: string): string
  exchangeCode(code: string, codeVerifier: string): Promise<GoogleTokenResult>
  refreshAccessToken(refreshToken: string): Promise<GoogleTokenResult>
  getProfile(accessToken: string): Promise<GoogleProfile>
  // `calendarId` defaults to 'primary' everywhere below when omitted/null (the account's
  // primary calendar). Every method takes an explicit calendarId (never silently reused
  // from elsewhere) so callers must consciously choose which calendar an operation targets
  // — critical for updateEvent/deleteEvent, which must target the calendar an existing
  // event actually lives in, not necessarily the user's *current* sync-target setting.
  listCalendars(accessToken: string): Promise<GoogleCalendarListEntry[]>
  listEvents(accessToken: string, timeMinISO: string, timeMaxISO: string, calendarId?: string | null): Promise<GoogleCalendarEvent[]>
  createEvent(accessToken: string, calendarId: string | null, input: GoogleEventInput): Promise<{ eventId: string; htmlLink: string }>
  // Throws GoogleEventNotFoundError on a 404/410 (rather than silently falling back to
  // create) — the caller owns the fallback decision since it also owns which calendarId to
  // create the replacement in.
  updateEvent(accessToken: string, calendarId: string | null, eventId: string, input: GoogleEventInput): Promise<{ eventId: string; htmlLink: string }>
  deleteEvent(accessToken: string, calendarId: string | null, eventId: string): Promise<void>
}
