import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ArrowRight, CircleAlert, RotateCcw } from 'lucide-react'

type Props = { children: ReactNode }
type State = { failed: boolean }

function reportClientError(error: Error) {
  const hash = window.location.hash.slice(1).split('?')[0] || '/'
  const knownRoutes = new Set(['/', '/places', '/world', '/planner', '/about', '/privacy', '/terms', '/welcome', '/login', '/register', '/account', '/verify-email', '/forgot-password', '/reset-password'])
  const route = knownRoutes.has(hash) ? hash : '/not-found'
  void fetch('/api/errors/client', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ route, type: error.name, message: error.message }),
    keepalive: true,
  }).catch(() => undefined)
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    reportClientError(error)
  }

  render() {
    if (this.state.failed) {
      return <main className="app-error-page"><div className="app-error-card"><CircleAlert size={25} /><span>HIMVOYA / SOMETHING WENT WRONG</span><h1>This part of the journey paused.</h1><p>The app hit an unexpected error. Your saved itinerary should still be available when you reload.</p><div><button type="button" onClick={() => window.location.reload()}><RotateCcw size={15} /> Reload the page</button><a href="#/">Back to Himvoya <ArrowRight size={15} /></a></div></div></main>
    }
    return this.props.children
  }
}
