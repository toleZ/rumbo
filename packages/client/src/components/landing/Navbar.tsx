import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { ThemeToggle } from '../layout/ThemeToggle'
import { LanguageToggle } from '../layout/LanguageToggle'

function RumboLogo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 select-none">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <circle cx="14" cy="14" r="13" stroke="var(--accent)" strokeWidth="2" fill="none" />
        <circle cx="14" cy="14" r="2" fill="var(--accent)" />
        <line x1="14" y1="4" x2="14" y2="8" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
        <line x1="14" y1="20" x2="14" y2="24" stroke="var(--label-3)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="4" y1="14" x2="8" y2="14" stroke="var(--label-3)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="20" y1="14" x2="24" y2="14" stroke="var(--label-3)" strokeWidth="1.5" strokeLinecap="round" />
        <polygon points="14,7 16.5,13 14,12 11.5,13" fill="var(--accent)" />
      </svg>
      <span className="text-[15px] font-bold text-[var(--label)] tracking-tight">Rumbo</span>
      <span className="text-[11px] font-semibold text-[var(--accent)] bg-[var(--accent-f)] px-1.5 py-0.5 rounded-full">
        Beta
      </span>
    </Link>
  )
}

export function Navbar() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="navbar-glass navbar-edge fixed top-0 left-0 right-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <RumboLogo />

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          <Link to="/about" className="px-3 py-1.5 text-sm text-[var(--label-2)] hover:text-[var(--label)] transition-colors rounded-[8px] hover:bg-[var(--surface-2)]">
            Sobre nosotros
          </Link>
          <Link to="/contact" className="px-3 py-1.5 text-sm text-[var(--label-2)] hover:text-[var(--label)] transition-colors rounded-[8px] hover:bg-[var(--surface-2)]">
            Contacto
          </Link>
          <div className="w-px h-4 bg-[var(--sep)] mx-2" />
          <LanguageToggle />
          <ThemeToggle />
          {user ? (
            <button
              onClick={() => navigate('/app')}
              className="px-4 py-1.5 text-sm font-semibold bg-[var(--accent)] text-white rounded-[8px] hover:bg-[var(--accent-h)] transition-colors"
            >
              Abrir app
            </button>
          ) : (
            <>
              <Link to="/login" className="px-3 py-1.5 text-sm text-[var(--label-2)] hover:text-[var(--label)] transition-colors rounded-[8px] hover:bg-[var(--surface-2)]">
                Inicia sesión
              </Link>
              <Link to="/beta" className="ml-1 px-4 py-1.5 text-sm font-semibold bg-[var(--accent)] text-white rounded-[8px] hover:bg-[var(--accent-h)] transition-colors">
                Solicitar acceso
              </Link>
            </>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-[8px] hover:bg-[var(--surface-2)] text-[var(--label-2)] transition-colors"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menú"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="navbar-glass-mobile md:hidden border-t border-[var(--sep)] px-6 py-4 flex flex-col gap-1">
          <Link to="/about" onClick={() => setMenuOpen(false)} className="px-3 py-2.5 text-sm text-[var(--label-2)] hover:text-[var(--label)] rounded-[8px] hover:bg-[var(--surface-2)] transition-colors">
            Sobre nosotros
          </Link>
          <Link to="/contact" onClick={() => setMenuOpen(false)} className="px-3 py-2.5 text-sm text-[var(--label-2)] hover:text-[var(--label)] rounded-[8px] hover:bg-[var(--surface-2)] transition-colors">
            Contacto
          </Link>
          <div className="h-px bg-[var(--sep)] my-1" />
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm text-[var(--label-2)]">Tema</span>
            <div className="flex items-center gap-1">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
          <div className="h-px bg-[var(--sep)] my-1" />
          {user ? (
            <button onClick={() => { setMenuOpen(false); navigate('/app') }} className="px-3 py-2.5 text-sm font-semibold text-[var(--accent)] text-left">
              Abrir app →
            </button>
          ) : (
            <>
              <Link to="/login" onClick={() => setMenuOpen(false)} className="px-3 py-2.5 text-sm text-[var(--label-2)] hover:text-[var(--label)] rounded-[8px] hover:bg-[var(--surface-2)] transition-colors">
                Inicia sesión
              </Link>
              <Link to="/beta" onClick={() => setMenuOpen(false)} className="mt-1 px-3 py-2.5 text-sm font-semibold bg-[var(--accent)] text-white rounded-[8px] text-center hover:bg-[var(--accent-h)] transition-colors">
                Solicitar acceso
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  )
}
