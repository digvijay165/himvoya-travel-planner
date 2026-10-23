import { useState, type FormEvent } from 'react'
import { ArrowRight, CheckCircle2, Compass, LockKeyhole, LogOut, Mail, ShieldCheck } from 'lucide-react'
import TurnstileWidget from '@/components/turnstile-widget'

export type AuthMode = 'login' | 'register' | 'account' | 'signed-out'

type Props = {
  mode: AuthMode
  email: string | null
  error: string
  busy: boolean
  notice: string
  captchaSiteKey: string
  captchaRequired: boolean
  captchaLoading: boolean
  accountDeleted?: boolean
  onAuthenticate: (mode: 'login' | 'register', email: string, password: string, captchaToken: string) => void
  onLogout: () => void
  onDeleteAccount: (password: string) => void
}

export default function AuthPage({ mode, email: accountEmail, error, busy, notice, captchaSiteKey, captchaRequired, captchaLoading, accountDeleted = false, onAuthenticate, onLogout, onDeleteAccount }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaResetKey, setCaptchaResetKey] = useState(0)
  const isRegister = mode === 'register'

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onAuthenticate(isRegister ? 'register' : 'login', email.trim(), password, captchaToken)
    setCaptchaToken('')
    setCaptchaResetKey((value) => value + 1)
  }

  return (
    <section className="auth-page">
      <section className="auth-panel">
        <div className="auth-image" role="img" aria-label="A quiet road winds through the mountains of India">
          <div className="auth-image-shade" />
          <a className="auth-image-brand" href="#/"><Compass size={18} /> Himvoya /</a>
          <div className="auth-image-copy"><span>MADE FOR THE WAY THERE</span><h1>India opens<br />up when you<br /><em>take your time.</em></h1><p>Save your route. Keep the little details close.</p></div>
          <span className="auth-image-caption">HIMALAYAN FOOTHILLS · INDIA</span>
        </div>

        <div className="auth-content">
          {mode === 'account' ? (
            <>
              <div className="auth-icon"><ShieldCheck size={21} /></div>
              <span className="auth-kicker">YOUR HIMVOYA ACCOUNT</span>
              <h2>Welcome back.</h2>
              <p className="auth-intro">Your saved trips are ready whenever you are.</p>
              <div className="account-summary"><span>Signed in as</span><strong>{accountEmail}</strong><small>Your trip planner is synced to your account.</small></div>
              <a className="auth-submit auth-link-button" href="#/planner">Open my planner <ArrowRight size={16} /></a>
              <button className="auth-secondary" type="button" onClick={onLogout} disabled={busy}><LogOut size={15} />{busy ? 'Signing out…' : 'Sign out'}</button>
              {!confirmDelete ? <button className="auth-delete-link" type="button" onClick={() => setConfirmDelete(true)} disabled={busy}>Delete account and saved trip</button> : <div className="account-delete-confirm">
                <strong>Delete this account permanently?</strong>
                <p>This removes your account, sessions, and saved trip from the active database. Enter your current password to confirm.</p>
                <label className="auth-field"><span>Current password</span><div><LockKeyhole size={16} /><input type="password" autoComplete="current-password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} maxLength={128} required /></div></label>
                <button className="auth-danger-button" type="button" onClick={() => onDeleteAccount(deletePassword)} disabled={busy || !deletePassword}>{busy ? 'Deleting account…' : 'Permanently delete account'}</button>
                <button className="auth-cancel-delete" type="button" onClick={() => { setConfirmDelete(false); setDeletePassword('') }} disabled={busy}>Keep my account</button>
              </div>}
              {error && <p className="auth-error" role="alert">{error}</p>}
            </>
          ) : mode === 'signed-out' ? (
            <>
              <div className="auth-icon success"><CheckCircle2 size={21} /></div>
              <span className="auth-kicker">{accountDeleted ? 'ACCOUNT DELETED' : 'SIGNED OUT'}</span>
              <h2>{accountDeleted ? 'Your data is cleared.' : 'See you out there.'}</h2>
              <p className="auth-intro">{accountDeleted ? 'Your Himvoya account, login sessions, and account trip were removed from this database. A copy previously downloaded or stored by this browser or host backups may remain.' : 'Your account is signed out on this device. Your saved trips will be waiting when you sign in again.'}</p>
              <a className="auth-submit auth-link-button" href={accountDeleted ? '#/register' : '#/login'}>{accountDeleted ? 'Create a new account' : 'Sign in again'} <ArrowRight size={16} /></a>
              <a className="auth-back-link" href="#/">Back to home</a>
            </>
          ) : (
            <>
              <div className="auth-icon"><Compass size={21} /></div>
              <span className="auth-kicker">{isRegister ? 'START YOUR NEXT CHAPTER' : 'PICK UP WHERE YOU LEFT OFF'}</span>
              <h2>{isRegister ? 'Make room for wonder.' : 'Welcome back.'}</h2>
              <p className="auth-intro">{isRegister ? 'Create an account to keep your India trip plans together.' : 'Sign in to find your saved trips and travel notes.'}</p>
              <form className="auth-form" onSubmit={submit}>
                <label className="auth-field"><span>Email address</span><div><Mail size={16} /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" maxLength={254} required /></div></label>
                <label className="auth-field"><span>Password</span><div><LockKeyhole size={16} /><input type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isRegister ? 'At least 10 characters' : 'Your password'} minLength={isRegister ? 10 : undefined} maxLength={128} required /></div></label>
                {captchaSiteKey && <TurnstileWidget siteKey={captchaSiteKey} resetKey={captchaResetKey} onToken={setCaptchaToken} />}
                {captchaRequired && !captchaSiteKey && !captchaLoading && <p className="auth-error" role="alert">The security check is not configured yet. Please try again later.</p>}
                {error && <p className="auth-error" role="alert">{error}</p>}
                {notice && <p className="auth-notice" role="status">{notice}</p>}
                <button className="auth-submit" type="submit" disabled={busy || captchaLoading || (captchaRequired && (!captchaSiteKey || !captchaToken))}><span>{captchaLoading ? 'Loading security check…' : busy ? 'One moment…' : isRegister ? 'Create account' : 'Sign in'}</span><ArrowRight size={16} /></button>
              </form>
              <p className="auth-switch">{isRegister ? 'Already planned with us?' : 'New to Himvoya?'} <a href={isRegister ? '#/login' : '#/register'}>{isRegister ? 'Sign in' : 'Create an account'}</a></p>
              {!isRegister && <p className="auth-recovery-link"><a href="#/forgot-password">Forgot your password?</a><span>·</span><a href="#/verify-email">Verify email</a></p>}
              <p className="auth-security"><ShieldCheck size={13} /> Passwords are securely stored. Your trip is private to your account.</p>
              <p className="auth-legal-links">By continuing, you agree to the <a href="#/terms">Terms</a> and <a href="#/privacy">Privacy policy</a>.</p>
            </>
          )}
        </div>
      </section>
      <a className="auth-home-link" href="#/">← Back to Himvoya</a>
    </section>
  )
}
