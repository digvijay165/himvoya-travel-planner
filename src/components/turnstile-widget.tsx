import { useEffect, useRef } from 'react'

type TurnstileOptions = {
  sitekey: string
  theme?: 'light' | 'dark' | 'auto'
  callback: (token: string) => void
  'expired-callback': () => void
  'error-callback': () => void
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileOptions) => string
      remove: (widgetId: string) => void
      reset: (widgetId: string) => void
    }
  }
}

type Props = {
  siteKey: string
  resetKey: number
  onToken: (token: string) => void
}

export default function TurnstileWidget({ siteKey, resetKey, onToken }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const onTokenRef = useRef(onToken)

  useEffect(() => { onTokenRef.current = onToken }, [onToken])

  useEffect(() => {
    if (!siteKey || !host.current) return
    let cancelled = false
    const render = () => {
      if (cancelled || !host.current || !window.turnstile || widgetId.current) return
      widgetId.current = window.turnstile.render(host.current, {
        sitekey: siteKey,
        theme: 'light',
        callback: (token) => onTokenRef.current(token),
        'expired-callback': () => onTokenRef.current(''),
        'error-callback': () => onTokenRef.current(''),
      })
    }

    const existingScript = document.querySelector<HTMLScriptElement>('script[data-roam-turnstile]')
    if (window.turnstile) render()
    else if (existingScript) existingScript.addEventListener('load', render)
    else {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.dataset.roamTurnstile = 'true'
      script.addEventListener('load', render)
      document.head.append(script)
    }

    return () => {
      cancelled = true
      existingScript?.removeEventListener('load', render)
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current)
      widgetId.current = null
    }
  }, [siteKey])

  useEffect(() => {
    if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current)
  }, [resetKey])

  if (!siteKey) return null
  return <div className="auth-captcha"><div ref={host} /><span>Protected by Cloudflare Turnstile</span></div>
}
