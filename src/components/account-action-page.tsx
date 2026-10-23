import { useState, type FormEvent } from 'react'
import { ArrowRight, CheckCircle2, Compass, KeyRound, Mail, ShieldCheck } from 'lucide-react'
import TurnstileWidget from '@/components/turnstile-widget'

export type AccountActionMode = 'verify-email' | 'forgot-password' | 'reset-password'

type Props = {
  mode: AccountActionMode
  token?: string
  initialEmail?: string
  captchaSiteKey: string
  captchaRequired: boolean
  captchaLoading: boolean
  busy: boolean
  error: string
  notice: string
  onVerify: (token: string) => void
  onResendVerification: (email: string, captchaToken: string) => void
  onRequestReset: (email: string, captchaToken: string) => void
  onResetPassword: (token: string, password: string) => void
}

export default function AccountActionPage({ mode, token, initialEmail = '', captchaSiteKey, captchaRequired, captchaLoading, busy, error, notice, onVerify, onResendVerification, onRequestReset, onResetPassword }: Props) {
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaResetKey, setCaptchaResetKey] = useState(0)
  const isVerify = mode === 'verify-email'
  const isReset = mode === 'reset-password'
  const needsCaptcha = !isReset

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isVerify) onResendVerification(email.trim(), captchaToken)
    else if (isReset && token) {
      if (password !== confirmation) return
      onResetPassword(token, password)
    } else onRequestReset(email.trim(), captchaToken)
    if (needsCaptcha) {
      setCaptchaToken('')
      setCaptchaResetKey((value) => value + 1)
    }
  }

  return (
    <section className="auth-page">
      <section className="auth-panel auth-action-panel">
        <div className="auth-image" role="img" aria-label="A quiet road winds through the mountains of India">
          <div className="auth-image-shade" />
          <a className="auth-image-brand" href="#/"><Compass size={18} /> Himvoya /</a>
          <div className="auth-image-copy"><span>YOUR PLANS, KEPT CLOSE</span><h1>Good journeys<br />start with a<br /><em>little trust.</em></h1><p>Keep your account safe and your next trip within reach.</p></div>
          <span className="auth-image-caption">HIMVOYA / ACCOUNT SECURITY</span>
        </div>
        <div className="auth-content">
          <div className={`auth-icon ${notice ? 'success' : ''}`}>{notice ? <CheckCircle2 size={21} /> : isVerify ? <Mail size={21} /> : <KeyRound size={21} />}</div>
          <span className="auth-kicker">{isVerify ? 'EMAIL CONFIRMATION' : isReset ? 'ACCOUNT RECOVERY' : 'ACCOUNT RECOVERY'}</span>
          <h2>{isVerify ? 'Confirm your email.' : isReset ? 'Choose a new password.' : 'Find your way back.'}</h2>
          <p className="auth-intro">{isVerify ? 'Verify your email address to finish setting up your account.' : isReset ? 'Create a fresh password to protect your saved plans.' : 'Enter your account email and we’ll send a secure reset link if it matches a verified account.'}</p>

          {isVerify && token ? (
            <div className="auth-action-stack">
              {notice ? <p className="auth-notice" role="status">{notice}</p> : <p className="auth-action-copy">This single-use verification link expires after 24 hours.</p>}
              {error && <p className="auth-error" role="alert">{error}</p>}
              {!notice && <button className="auth-submit" type="button" onClick={() => onVerify(token)} disabled={busy}><span>{busy ? 'Verifying…' : 'Verify email address'}</span><ArrowRight size={16} /></button>}
              <a className="auth-back-link" href="#/login">Continue to sign in</a>
            </div>
          ) : isReset && !token ? (
            <div className="auth-action-stack">
              {error && <p className="auth-error" role="alert">{error}</p>}
              <p className="auth-action-copy">This reset link is missing or expired. Request a new one to continue.</p>
              <a className="auth-submit auth-link-button" href="#/forgot-password">Request a new reset link <ArrowRight size={16} /></a>
            </div>
          ) : (
            <form className="auth-form" onSubmit={submit}>
              {(!isReset || !token) && <label className="auth-field"><span>Email address</span><div><Mail size={16} /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" maxLength={254} required /></div></label>}
              {isReset && token && <>
                <label className="auth-field"><span>New password</span><div><KeyRound size={16} /><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 10 characters" minLength={10} maxLength={128} required /></div></label>
                <label className="auth-field"><span>Confirm new password</span><div><KeyRound size={16} /><input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Enter it again" minLength={10} maxLength={128} required /></div></label>
                {confirmation && password !== confirmation && <p className="auth-error" role="alert">The passwords do not match yet.</p>}
              </>}
              {needsCaptcha && captchaSiteKey && <TurnstileWidget siteKey={captchaSiteKey} resetKey={captchaResetKey} onToken={setCaptchaToken} />}
              {needsCaptcha && captchaRequired && !captchaSiteKey && !captchaLoading && <p className="auth-error" role="alert">The security check is not configured yet. Please try again later.</p>}
              {notice && <p className="auth-notice" role="status">{notice}</p>}
              {error && <p className="auth-error" role="alert">{error}</p>}
              <button className="auth-submit" type="submit" disabled={busy || (needsCaptcha && captchaLoading) || (needsCaptcha && captchaRequired && (!captchaSiteKey || !captchaToken)) || (isReset && password !== confirmation)}><span>{needsCaptcha && captchaLoading ? 'Loading security check…' : busy ? 'One moment…' : isVerify ? 'Send verification link' : isReset ? 'Save new password' : 'Send reset link'}</span><ArrowRight size={16} /></button>
            </form>
          )}

          <p className="auth-security"><ShieldCheck size={13} /> Links are single-use and expire automatically.</p>
        </div>
      </section>
      <a className="auth-home-link" href="#/">← Back to Himvoya</a>
    </section>
  )
}
