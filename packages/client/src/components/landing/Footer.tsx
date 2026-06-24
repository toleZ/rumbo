import { Link, useLocation } from 'react-router-dom'
import { ThemeToggle } from '../layout/ThemeToggle'
import { LanguageToggle } from '../layout/LanguageToggle'

export function Footer() {
  const { pathname } = useLocation()
  const onHome = pathname === '/'
  return (
    <footer className="border-t border-[var(--sep)] bg-[var(--surface)]">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <svg width="22" height="22" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                <circle cx="14" cy="14" r="13" stroke="var(--accent)" strokeWidth="2" fill="none" />
                <circle cx="14" cy="14" r="2" fill="var(--accent)" />
                <line x1="14" y1="4" x2="14" y2="8" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
                <line x1="14" y1="20" x2="14" y2="24" stroke="var(--label-3)" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="4" y1="14" x2="8" y2="14" stroke="var(--label-3)" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="20" y1="14" x2="24" y2="14" stroke="var(--label-3)" strokeWidth="1.5" strokeLinecap="round" />
                <polygon points="14,7 16.5,13 14,12 11.5,13" fill="var(--accent)" />
              </svg>
              <span className="text-sm font-bold text-[var(--label)]">Rumbo</span>
            </div>
            <p className="text-xs text-[var(--label-3)] leading-relaxed max-w-[180px]">
              Tu espacio de trabajo, sin ruido.
            </p>
          </div>

          {/* Producto */}
          <div>
            <p className="text-sm font-semibold text-[var(--label)] mb-3">Producto</p>
            <ul className="space-y-2">
              <li>{onHome
                ? <a href="#features" className="text-sm text-[var(--label-2)] hover:text-[var(--label)] transition-colors">Funciones</a>
                : <Link to="/#features" className="text-sm text-[var(--label-2)] hover:text-[var(--label)] transition-colors">Funciones</Link>
              }</li>
              <li><Link to="/beta" className="text-sm text-[var(--label-2)] hover:text-[var(--label)] transition-colors">Unirse a la beta</Link></li>
            </ul>
          </div>

          {/* Empresa */}
          <div>
            <p className="text-sm font-semibold text-[var(--label)] mb-3">Empresa</p>
            <ul className="space-y-2">
              <li><Link to="/about" className="text-sm text-[var(--label-2)] hover:text-[var(--label)] transition-colors">Sobre nosotros</Link></li>
              <li><Link to="/contact" className="text-sm text-[var(--label-2)] hover:text-[var(--label)] transition-colors">Contacto</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="text-sm font-semibold text-[var(--label)] mb-3">Legal</p>
            <ul className="space-y-2">
              <li><a href="#" className="text-sm text-[var(--label-2)] hover:text-[var(--label)] transition-colors">Privacidad</a></li>
              <li><a href="#" className="text-sm text-[var(--label-2)] hover:text-[var(--label)] transition-colors">Términos</a></li>
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-between pt-6 border-t border-[var(--sep)]">
          <p className="text-xs text-[var(--label-3)]">© {new Date().getFullYear()} Rumbo. Todos los derechos reservados.</p>
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  )
}
