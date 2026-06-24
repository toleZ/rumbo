import { Component, type ErrorInfo, type ReactNode } from 'react'

const copy = {
  es: {
    heading: 'Algo salió mal',
    body: 'Ocurrió un error inesperado.',
    tryAgain: 'Intentar de nuevo',
    reload: 'Recargar página',
    home: 'Ir al inicio',
  },
  en: {
    heading: 'Something went wrong',
    body: 'An unexpected error occurred.',
    tryAgain: 'Try again',
    reload: 'Reload page',
    home: 'Go to home',
  },
}

// Local copy of detectLanguage — intentionally not imported from lib/i18n
// to keep this boundary functional even if the i18n module itself crashes.
function getLang(): 'es' | 'en' {
  try {
    const stored = localStorage.getItem('language')
    if (stored === 'es' || stored === 'en') return stored
    const browser = navigator.language?.slice(0, 2).toLowerCase()
    if (browser === 'en') return 'en'
  } catch {
    // localStorage unavailable (Safari private browsing, sandboxed iframe)
  }
  return 'es'
}

function getTheme(): 'dark' | 'light' {
  try {
    return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  lang: 'es' | 'en'
  theme: 'dark' | 'light'
}

export class ErrorBoundary extends Component<Props, State> {
  // Prevents StrictMode from double-reporting the same error in development.
  private _reported = false

  state: State = { hasError: false, error: null, lang: 'es', theme: 'light' }

  static getDerivedStateFromError(error: Error): State {
    // Capture lang + theme once at crash time so render() never reads localStorage.
    return { hasError: true, error, lang: getLang(), theme: getTheme() }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (this._reported) return
    this._reported = true
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    const { error, lang, theme } = this.state
    const t = copy[lang]

    return (
      <div
        className={`${theme === 'dark' ? 'dark ' : ''}min-h-screen flex flex-col items-center justify-center gap-4 p-8`}
        style={{ background: 'var(--bg)', color: 'var(--label)' }}
      >
        <h1 className="text-2xl font-semibold">{t.heading}</h1>
        <p className="text-sm opacity-60">{t.body}</p>
        {error?.message && (
          <p className="text-xs font-mono opacity-40 max-w-md text-center break-all">{error.message}</p>
        )}
        <div className="flex gap-3 mt-2">
          <button
            onClick={() => {
              this._reported = false
              this.setState({ hasError: false, error: null, lang: getLang(), theme: getTheme() })
            }}
            className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {t.tryAgain}
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
            style={{ background: 'var(--surface)', border: '1px solid var(--sep)', color: 'var(--label)' }}
          >
            {t.reload}
          </button>
          <a
            href="/"
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--surface)', border: '1px solid var(--sep)', color: 'var(--label)' }}
          >
            {t.home}
          </a>
        </div>
      </div>
    )
  }
}
