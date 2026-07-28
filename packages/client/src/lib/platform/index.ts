import type { ISessionStorage } from './ISessionStorage'
import type { IOAuthLauncher } from './IOAuthLauncher'
import type { INotificationScheduler } from './INotificationScheduler'
import { WebSessionStorage } from './adapters/web/WebSessionStorage'
import { WebRedirectLauncher } from './adapters/web/WebRedirectLauncher'
import { WebToastScheduler } from './adapters/web/WebToastScheduler'

export type { AuthUser, ISessionStorage } from './ISessionStorage'
export type { ConnectProvider, IOAuthLauncher } from './IOAuthLauncher'
export type {
  INotificationScheduler,
  NotificationSchedulerHandlers,
  ScheduledReminder,
} from './INotificationScheduler'
export { capabilities } from './capabilities'
export { isNativePlatform } from './host'
export { API_BASE } from './apiBase'

// The one place an adapter set is resolved, at module load. Everything downstream imports
// the resolved instance and never learns which platform it got.
//
// Only the web adapter exists today. The native one lands alongside the server change that
// returns the refresh token out-of-band — until then a native shell would have a token it
// could store but no way to obtain one, so the branch would be unreachable rather than
// merely unused.
export const session: ISessionStorage = new WebSessionStorage()

export const oauthLauncher: IOAuthLauncher = new WebRedirectLauncher()

export const notificationScheduler: INotificationScheduler = new WebToastScheduler()
