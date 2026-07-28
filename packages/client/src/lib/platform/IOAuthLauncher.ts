export type ConnectProvider = 'spotify' | 'google_calendar'

// How a third-party connect flow is started.
//
// Web navigates the top-level document straight at the server's /authorize route, which
// authenticates the navigation with the httpOnly refresh cookie. A native shell cannot:
// the flow must open in a SYSTEM browser (Google refuses OAuth in embedded WebViews), and
// that browser shares no cookie jar with the app — so it authenticates differently and
// returns via a deep link rather than a same-document redirect.
//
// Async because that native path has to mint its authorization out-of-band before it has
// a URL to open. The web adapter has no await to do, but keeping one signature means
// call sites don't change when the native adapter lands.
export interface IOAuthLauncher {
  startConnect(provider: ConnectProvider): Promise<void>
}
