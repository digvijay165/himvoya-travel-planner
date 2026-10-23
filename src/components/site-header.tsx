import { ArrowUpRight, Menu } from 'lucide-react'

type Props = {
  page: string
  userEmail: string | null
}

const links = [
  { label: 'Home', href: '#/', page: 'home' },
  { label: 'Explore India', href: '#/places', page: 'places' },
  { label: 'Foreign places', href: '#/world', page: 'world' },
  { label: 'Trip planner', href: '#/planner', page: 'planner' },
  { label: 'About', href: '#/about', page: 'about' },
  { label: 'Privacy', href: '#/privacy', page: 'privacy' },
]

export default function SiteHeader({ page, userEmail }: Props) {
  const activePage = page === 'place' ? 'places' : page

  return (
    <header className="site-header">
      <a className="header-brand" href="#/" aria-label="Himvoya home">
        <span className="header-brand-mark" aria-hidden="true">
          <svg viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="11.25" />
            <path d="m18.5 8.5-2.9 7.1-7.1 2.9 2.9-7.1 7.1-2.9Z" />
            <path d="m13.4 14.6 1.2-1.2" />
            <circle cx="14" cy="14" r="1.1" />
          </svg>
        </span>
        <span>Himvoya <i>/</i></span>
        <small>INDIA, YOUR WAY</small>
      </a>
      <nav className="header-nav" aria-label="Main navigation">
        {links.map((link) => (
          <a key={link.page} className={activePage === link.page ? 'active' : ''} href={link.href} aria-current={activePage === link.page ? 'page' : undefined}>
            {link.label}
          </a>
        ))}
      </nav>
      <a className="header-account" href={userEmail ? '#/account' : '#/login'}>
        <span>{userEmail ? 'My account' : 'Sign in'}</span><ArrowUpRight size={15} />
      </a>
      <a className="header-mobile-menu" href="#/places" aria-label="Explore India"><Menu size={20} /></a>
    </header>
  )
}
