import { mkdirSync, existsSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { backup as sqliteBackup, DatabaseSync } from 'node:sqlite'
import express from 'express'

const rootDirectory = dirname(fileURLToPath(import.meta.url))
const databasePath = process.env.ROAM_DB_PATH || 'data/travel-planner.sqlite'
const absoluteDatabasePath = databasePath === ':memory:' ? databasePath : resolve(rootDirectory, databasePath)
const port = Number(process.env.PORT || 3001)
const scrypt = promisify(scryptCallback)
const sessionTtlMs = 1000 * 60 * 60 * 24 * 30
const authCookieName = 'roam_auth'
const resendApiKey = process.env.RESEND_API_KEY
const emailFrom = process.env.ROAM_EMAIL_FROM
const turnstileSiteKey = process.env.ROAM_TURNSTILE_SITE_KEY || ''
const turnstileSecretKey = process.env.ROAM_TURNSTILE_SECRET_KEY || ''
const turnstileConfigured = Boolean(turnstileSiteKey && turnstileSecretKey)
const authAttempts = new Map()
const eventAttempts = new Map()
let lastTelemetryPruneAt = 0
const placeSearchCache = new Map()
const placePhotoCache = new Map()
const weatherCache = new Map()
let lastGeocodingRequestAt = 0

if (absoluteDatabasePath !== ':memory:') mkdirSync(dirname(absoluteDatabasePath), { recursive: true })

const database = new DatabaseSync(absoluteDatabasePath)
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS trips (
    session_id TEXT PRIMARY KEY,
    trip_json TEXT NOT NULL,
    selected_ids_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    email_verified INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS auth_sessions_user_id ON auth_sessions(user_id);
  CREATE TABLE IF NOT EXISTS account_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS account_tokens_user_purpose ON account_tokens(user_id, purpose);
  CREATE TABLE IF NOT EXISTS analytics_daily (
    day TEXT NOT NULL,
    route TEXT NOT NULL,
    page_views INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, route)
  );
  CREATE TABLE IF NOT EXISTS error_groups (
    day TEXT NOT NULL,
    error_hash TEXT NOT NULL,
    route TEXT NOT NULL,
    error_type TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (day, error_hash, route)
  );
`)

const userColumns = database.prepare('PRAGMA table_info(users)').all()
if (!userColumns.some((column) => column.name === 'email_verified')) {
  database.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1')
}

const tripColumns = database.prepare('PRAGMA table_info(trips)').all()
if (!tripColumns.some((column) => column.name === 'user_id')) {
  database.exec('ALTER TABLE trips ADD COLUMN user_id TEXT REFERENCES users(id)')
}
database.exec('CREATE UNIQUE INDEX IF NOT EXISTS trips_user_id_unique ON trips(user_id) WHERE user_id IS NOT NULL')

const backupDirectory = absoluteDatabasePath === ':memory:' ? null : resolve(dirname(absoluteDatabasePath), 'backups')
let backupRunning = false
async function createDatabaseBackup() {
  if (!backupDirectory || backupRunning) return
  backupRunning = true
  let temporary = ''
  try {
    mkdirSync(backupDirectory, { recursive: true, mode: 0o700 })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const destination = resolve(backupDirectory, `roam-${stamp}.sqlite`)
    temporary = `${destination}.tmp`
    await sqliteBackup(database, temporary)
    renameSync(temporary, destination)
    const snapshots = readdirSync(backupDirectory)
      .filter((name) => /^roam-.*\.sqlite$/.test(name))
      .sort()
    for (const expired of snapshots.slice(0, Math.max(0, snapshots.length - 14))) {
      rmSync(resolve(backupDirectory, expired), { force: true })
    }
    console.info(`[roam backup] SQLite snapshot created: ${destination}`)
  } catch (error) {
    if (temporary) rmSync(temporary, { force: true })
    console.error('[roam backup] Could not create SQLite snapshot:', error instanceof Error ? error.message : 'unknown backup error')
  } finally {
    backupRunning = false
  }
}
void createDatabaseBackup()
const backupTimer = setInterval(createDatabaseBackup, 24 * 60 * 60 * 1000)
backupTimer.unref()

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(express.json({ limit: '256kb' }))

function getSessionId(request, response) {
  const sessionId = request.get('x-roam-session')
  if (!sessionId || !/^[a-f\d-]{36}$/i.test(sessionId)) {
    response.status(400).json({ error: 'A valid planner session is required.' })
    return null
  }
  return sessionId
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function makeAccountToken(userId, purpose, ttlMs) {
  database.prepare('DELETE FROM account_tokens WHERE user_id = ? AND purpose = ?').run(userId, purpose)
  const token = randomBytes(32).toString('hex')
  database.prepare('INSERT INTO account_tokens (token_hash, user_id, purpose, expires_at) VALUES (?, ?, ?, ?)').run(hashToken(token), userId, purpose, Date.now() + ttlMs)
  return token
}

function publicAppUrl(request) {
  const origin = process.env.ROAM_PUBLIC_URL || request.get('origin') || `${request.protocol}://${request.get('host')}`
  return origin.replace(/\/$/, '')
}

async function sendAccountActionEmail(email, url, purpose) {
  const isVerification = purpose === 'verify_email'
  const subject = isVerification ? 'Verify your Himvoya account' : 'Reset your Himvoya password'
  const action = isVerification ? 'Verify email address' : 'Choose a new password'
  const description = isVerification
    ? 'Confirm this email address to finish setting up your Himvoya account.'
    : 'Use this link to set a new password for your Himvoya account.'
  if (!resendApiKey) {
    if (process.env.NODE_ENV === 'production') throw new Error('Email delivery is not configured.')
    console.info(`[roam email · development] ${subject} for ${email}: ${url}`)
    return false
  }
  if (!emailFrom) throw new Error('ROAM_EMAIL_FROM is required when email delivery is enabled.')
  const result = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${resendApiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: emailFrom,
      to: [email],
      subject,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#203b3b"><p style="letter-spacing:.16em;font-size:11px">HIMVOYA / TRAVEL PLANNER</p><h1 style="font-weight:500">${action}</h1><p>${description}</p><p style="margin:28px 0"><a href="${url}" style="background:#183b3b;color:white;padding:13px 18px;text-decoration:none">${action}</a></p><p style="font-size:13px;color:#71807a">This link expires in ${isVerification ? '24 hours' : '1 hour'}. If you did not request it, you can ignore this email.</p></div>`,
    }),
    signal: AbortSignal.timeout(10000),
  })
  if (!result.ok) throw new Error(`Email provider returned ${result.status}.`)
  return true
}

function actionLink(request, page, token) {
  return `${publicAppUrl(request)}/#/${page}?token=${encodeURIComponent(token)}`
}

async function validateCaptcha(request, response) {
  const configured = Boolean(turnstileSiteKey || turnstileSecretKey)
  const required = process.env.NODE_ENV === 'production' || configured
  if (!required) return true
  if (!turnstileConfigured) {
    response.status(503).json({ error: 'The security check is not configured yet. Please try again later.' })
    return false
  }

  const token = typeof request.body?.captchaToken === 'string' ? request.body.captchaToken : ''
  if (!token || token.length > 2048) {
    response.status(400).json({ error: 'Complete the security check and try again.' })
    return false
  }
  try {
    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: turnstileSecretKey, response: token, idempotency_key: randomUUID() }),
      signal: AbortSignal.timeout(8000),
    })
    if (!result.ok) throw new Error(`Turnstile returned ${result.status}.`)
    const verification = await result.json()
    const expectedHostname = new URL(publicAppUrl(request)).hostname
    if (verification.success === true && verification.hostname === expectedHostname) return true
    response.status(400).json({ error: 'The security check expired or could not be verified. Complete it again.' })
    return false
  } catch (error) {
    console.error('[roam security] Turnstile verification failed:', error instanceof Error ? error.message : 'unknown verification error')
    response.status(503).json({ error: 'The security check is temporarily unavailable. Please try again shortly.' })
    return false
  }
}

function recordError(route, type, message) {
  const routeCandidate = String(route || '/')
  const normalizedRoute = /^\/[a-z0-9/-]{0,79}$/i.test(routeCandidate) ? routeCandidate : '/other'
  const typeCandidate = String(type || 'Error')
  const normalizedType = /^[A-Z][A-Za-z0-9]{0,38}Error$/.test(typeCandidate) ? typeCandidate : 'Error'
  const digest = createHash('sha256').update(`${normalizedType}\0${String(message || '').slice(0, 500)}`).digest('hex')
  database.prepare(`
    INSERT INTO error_groups (day, error_hash, route, error_type, count, last_seen)
    VALUES (date('now'), ?, ?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(day, error_hash, route) DO UPDATE SET count = count + 1, last_seen = CURRENT_TIMESTAMP
  `).run(digest, normalizedRoute, normalizedType)
}

function pruneTelemetry() {
  const now = Date.now()
  if (now - lastTelemetryPruneAt < 6 * 60 * 60 * 1000) return
  database.exec("DELETE FROM analytics_daily WHERE day < date('now', '-365 days'); DELETE FROM error_groups WHERE day < date('now', '-90 days')")
  lastTelemetryPruneAt = now
}

function getCookie(request, name) {
  const cookies = request.get('cookie')?.split(';') ?? []
  const match = cookies.map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))
  return match ? match.slice(name.length + 1) : null
}

function getAuthenticatedUser(request) {
  const token = getCookie(request, authCookieName)
  if (!token || !/^[a-f\d]{64}$/i.test(token)) return null
  const tokenHash = hashToken(token)
  const row = database.prepare(`
    SELECT users.id, users.email, auth_sessions.expires_at
    FROM auth_sessions JOIN users ON users.id = auth_sessions.user_id
    WHERE auth_sessions.token_hash = ?
  `).get(tokenHash)
  if (!row) return null
  if (row.expires_at <= Date.now()) {
    database.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(tokenHash)
    return null
  }
  return { id: row.id, email: row.email }
}

function setAuthCookie(request, response, token) {
  const flags = ['HttpOnly', 'Path=/', 'SameSite=Lax', `Max-Age=${Math.floor(sessionTtlMs / 1000)}`]
  if (request.secure || process.env.NODE_ENV === 'production') flags.push('Secure')
  response.setHeader('Set-Cookie', `${authCookieName}=${token}; ${flags.join('; ')}`)
}

function clearAuthCookie(request, response) {
  const flags = ['HttpOnly', 'Path=/', 'SameSite=Lax', 'Max-Age=0']
  if (request.secure || process.env.NODE_ENV === 'production') flags.push('Secure')
  response.setHeader('Set-Cookie', `${authCookieName}=; ${flags.join('; ')}`)
}

function revokeCurrentSession(request) {
  const token = getCookie(request, authCookieName)
  if (token && /^[a-f\d]{64}$/i.test(token)) {
    database.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(hashToken(token))
  }
}

function allowSameOrigin(request, response, next) {
  const fetchSite = request.get('sec-fetch-site')
  const origin = request.get('origin')
  if (fetchSite === 'cross-site') return response.status(403).json({ error: 'Cross-site requests are not accepted.' })
  if (origin) {
    try {
      if (new URL(origin).host.toLowerCase() !== request.get('host')?.toLowerCase()) {
        return response.status(403).json({ error: 'Request origin did not match this app.' })
      }
    } catch {
      return response.status(403).json({ error: 'Request origin is invalid.' })
    }
  }
  next()
}

function authRateLimit(request, response, next) {
  const key = request.ip || request.socket.remoteAddress || 'unknown'
  const now = Date.now()
  const current = authAttempts.get(key)
  const record = !current || now - current.startedAt > 15 * 60 * 1000 ? { startedAt: now, count: 0 } : current
  record.count += 1
  authAttempts.set(key, record)
  if (record.count > 12) return response.status(429).json({ error: 'Too many account attempts. Wait a few minutes and try again.' })
  if (authAttempts.size > 1000) {
    for (const [address, attempt] of authAttempts) if (now - attempt.startedAt > 30 * 60 * 1000) authAttempts.delete(address)
  }
  next()
}

function eventRateLimit(request, response, next) {
  const key = request.ip || request.socket.remoteAddress || 'unknown'
  const now = Date.now()
  const current = eventAttempts.get(key)
  const record = !current || now - current.startedAt > 60_000 ? { startedAt: now, count: 0 } : current
  record.count += 1
  eventAttempts.set(key, record)
  if (record.count > 60) return response.status(429).json({ error: 'Please slow down and try again shortly.' })
  if (eventAttempts.size > 1000) {
    for (const [address, attempt] of eventAttempts) if (now - attempt.startedAt > 120_000) eventAttempts.delete(address)
  }
  next()
}

function mergeAnonymousTrip(userId, sessionId) {
  if (!sessionId) return
  const userTrip = database.prepare('SELECT session_id FROM trips WHERE user_id = ?').get(userId)
  if (userTrip) return
  database.prepare('UPDATE trips SET user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND user_id IS NULL').run(userId, sessionId)
}

function getTripContext(request, response) {
  const sessionId = getSessionId(request, response)
  if (!sessionId) return null
  return { sessionId, user: getAuthenticatedUser(request) }
}

function readCurrentTrip(context) {
  if (context.user) {
    return database.prepare('SELECT trip_json, selected_ids_json, updated_at FROM trips WHERE user_id = ?').get(context.user.id)
  }
  return database.prepare('SELECT trip_json, selected_ids_json, updated_at FROM trips WHERE session_id = ? AND user_id IS NULL').get(context.sessionId)
}

function saveCurrentTrip(context, trip, selectedIds) {
  const tripJson = JSON.stringify(trip)
  const selectedJson = JSON.stringify(selectedIds)
  if (!context.user) {
    const existing = database.prepare('SELECT session_id FROM trips WHERE session_id = ? AND user_id IS NULL').get(context.sessionId)
    if (existing) {
      database.prepare('UPDATE trips SET trip_json = ?, selected_ids_json = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND user_id IS NULL').run(tripJson, selectedJson, context.sessionId)
    } else {
      const occupied = database.prepare('SELECT user_id FROM trips WHERE session_id = ?').get(context.sessionId)
      if (occupied) return false
      database.prepare('INSERT INTO trips (session_id, trip_json, selected_ids_json) VALUES (?, ?, ?)').run(context.sessionId, tripJson, selectedJson)
    }
    return true
  }

  const existing = database.prepare('SELECT session_id FROM trips WHERE user_id = ?').get(context.user.id)
  if (existing) {
    database.prepare('UPDATE trips SET trip_json = ?, selected_ids_json = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(tripJson, selectedJson, context.user.id)
    return true
  }
  const anonymous = database.prepare('SELECT session_id FROM trips WHERE session_id = ? AND user_id IS NULL').get(context.sessionId)
  if (anonymous) {
    database.prepare('UPDATE trips SET user_id = ?, trip_json = ?, selected_ids_json = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND user_id IS NULL').run(context.user.id, tripJson, selectedJson, context.sessionId)
    return true
  }
  database.prepare('INSERT INTO trips (session_id, user_id, trip_json, selected_ids_json) VALUES (?, ?, ?, ?)').run(`user:${context.user.id}`, context.user.id, tripJson, selectedJson)
  return true
}

function cacheValue(cache, key, value, ttlMs) {
  if (cache.size >= 500) cache.delete(cache.keys().next().value)
  cache.set(key, { value, expiresAt: Date.now() + ttlMs })
}

function readCache(cache, key) {
  const cached = cache.get(key)
  if (!cached) return null
  if (cached.expiresAt <= Date.now()) {
    cache.delete(key)
    return null
  }
  return cached.value
}

function stripMarkup(value) {
  return String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
}

app.use('/api/auth', allowSameOrigin)

app.get('/api/public-config', (_request, response) => {
  response.setHeader('Cache-Control', 'no-store')
  response.json({
    captchaRequired: process.env.NODE_ENV === 'production' || Boolean(turnstileSiteKey || turnstileSecretKey),
    captchaSiteKey: turnstileConfigured ? turnstileSiteKey : null,
  })
})

app.get('/api/auth/me', (request, response) => {
  response.json({ user: getAuthenticatedUser(request) })
})

app.post('/api/auth/register', authRateLimit, async (request, response) => {
  const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : ''
  const password = typeof request.body?.password === 'string' ? request.body.password : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
    return response.status(400).json({ error: 'Enter a valid email address.' })
  }
  if (password.length < 10 || password.length > 128) {
    return response.status(400).json({ error: 'Use a password between 10 and 128 characters.' })
  }
  if (!await validateCaptcha(request, response)) return
  if (process.env.NODE_ENV === 'production' && (!resendApiKey || !emailFrom)) {
    return response.status(503).json({ error: 'Account email delivery is not configured. Please contact the site owner.' })
  }
  if (database.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(email)) {
    return response.status(409).json({ error: 'An account with that email already exists.' })
  }

  const salt = randomBytes(16).toString('hex')
  const passwordHash = await scrypt(password, salt, 64)
  const id = randomUUID()
  database.prepare('INSERT INTO users (id, email, password_salt, password_hash, email_verified) VALUES (?, ?, ?, ?, 0)').run(id, email, salt, Buffer.from(passwordHash).toString('base64'))
  const token = makeAccountToken(id, 'verify_email', 1000 * 60 * 60 * 24)
  let emailSent = false
  try {
    emailSent = await sendAccountActionEmail(email, actionLink(request, 'verify-email', token), 'verify_email')
  } catch (error) {
    console.error('[roam auth] Verification email could not be sent:', error instanceof Error ? error.message : 'unknown email error')
  }
  authAttempts.delete(request.ip || request.socket.remoteAddress || 'unknown')
  response.status(201).json({ verificationRequired: true, email, emailSent })
})

app.post('/api/auth/login', authRateLimit, async (request, response) => {
  const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : ''
  const password = typeof request.body?.password === 'string' ? request.body.password : ''
  if (email.length > 254 || password.length > 128) return response.status(400).json({ error: 'Enter your email and password.' })
  if (!await validateCaptcha(request, response)) return
  const user = database.prepare('SELECT id, email, password_salt, password_hash FROM users WHERE email = ? COLLATE NOCASE').get(email)
  if (!user || password.length < 1) return response.status(401).json({ error: 'Email or password is incorrect.' })
  const suppliedHash = Buffer.from(await scrypt(password, user.password_salt, 64))
  const storedHash = Buffer.from(user.password_hash, 'base64')
  if (suppliedHash.length !== storedHash.length || !timingSafeEqual(suppliedHash, storedHash)) {
    return response.status(401).json({ error: 'Email or password is incorrect.' })
  }
  const verified = database.prepare('SELECT email_verified FROM users WHERE id = ?').get(user.id)
  if (!verified?.email_verified) return response.status(403).json({ error: 'Verify your email before signing in. You can request a new verification link.' })
  const sessionId = request.get('x-roam-session')
  mergeAnonymousTrip(user.id, sessionId && /^[a-f\d-]{36}$/i.test(sessionId) ? sessionId : null)
  revokeCurrentSession(request)
  const token = randomBytes(32).toString('hex')
  database.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(hashToken(token), user.id, Date.now() + sessionTtlMs)
  setAuthCookie(request, response, token)
  authAttempts.delete(request.ip || request.socket.remoteAddress || 'unknown')
  response.json({ user: { id: user.id, email: user.email } })
})

app.post('/api/auth/logout', (request, response) => {
  revokeCurrentSession(request)
  clearAuthCookie(request, response)
  response.json({ loggedOut: true })
})

app.post('/api/auth/verification/send', authRateLimit, async (request, response) => {
  const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
    return response.status(400).json({ error: 'Enter a valid email address.' })
  }
  if (!await validateCaptcha(request, response)) return
  if (process.env.NODE_ENV === 'production' && (!resendApiKey || !emailFrom)) {
    return response.status(503).json({ error: 'Account email delivery is not configured. Please contact the site owner.' })
  }
  const user = database.prepare('SELECT id, email, email_verified FROM users WHERE email = ? COLLATE NOCASE').get(email)
  if (user && !user.email_verified) {
    const token = makeAccountToken(user.id, 'verify_email', 1000 * 60 * 60 * 24)
    try {
      await sendAccountActionEmail(user.email, actionLink(request, 'verify-email', token), 'verify_email')
    } catch (error) {
      console.error('[roam auth] Verification email could not be sent:', error instanceof Error ? error.message : 'unknown email error')
    }
  }
  response.status(202).json({ accepted: true, message: 'If the account needs verification, a new link will be sent.' })
})

app.post('/api/auth/verification/confirm', authRateLimit, (request, response) => {
  const token = typeof request.body?.token === 'string' ? request.body.token : ''
  if (!/^[a-f\d]{64}$/i.test(token)) return response.status(400).json({ error: 'This verification link is invalid or expired. Request a new one.' })
  const row = database.prepare("SELECT user_id, expires_at FROM account_tokens WHERE token_hash = ? AND purpose = 'verify_email'").get(hashToken(token))
  if (!row || row.expires_at <= Date.now()) {
    if (row) database.prepare('DELETE FROM account_tokens WHERE token_hash = ?').run(hashToken(token))
    return response.status(400).json({ error: 'This verification link is invalid or expired. Request a new one.' })
  }
  database.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(row.user_id)
  database.prepare("DELETE FROM account_tokens WHERE user_id = ? AND purpose = 'verify_email'").run(row.user_id)
  const user = database.prepare('SELECT id, email FROM users WHERE id = ?').get(row.user_id)
  const sessionId = request.get('x-roam-session')
  mergeAnonymousTrip(user.id, sessionId && /^[a-f\d-]{36}$/i.test(sessionId) ? sessionId : null)
  revokeCurrentSession(request)
  const sessionToken = randomBytes(32).toString('hex')
  database.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(hashToken(sessionToken), user.id, Date.now() + sessionTtlMs)
  setAuthCookie(request, response, sessionToken)
  response.json({ verified: true, user })
})

app.post('/api/auth/password-reset/request', authRateLimit, async (request, response) => {
  const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
    return response.status(400).json({ error: 'Enter a valid email address.' })
  }
  if (!await validateCaptcha(request, response)) return
  if (process.env.NODE_ENV === 'production' && (!resendApiKey || !emailFrom)) {
    return response.status(503).json({ error: 'Account email delivery is not configured. Please contact the site owner.' })
  }
  const user = database.prepare('SELECT id, email FROM users WHERE email = ? COLLATE NOCASE AND email_verified = 1').get(email)
  if (user) {
    const token = makeAccountToken(user.id, 'reset_password', 1000 * 60 * 60)
    try {
      await sendAccountActionEmail(user.email, actionLink(request, 'reset-password', token), 'reset_password')
    } catch (error) {
      console.error('[roam auth] Password reset email could not be sent:', error instanceof Error ? error.message : 'unknown email error')
    }
  }
  response.status(202).json({ accepted: true, message: 'If a verified account matches that address, a password reset link will be sent.' })
})

app.post('/api/auth/password-reset/confirm', authRateLimit, async (request, response) => {
  const token = typeof request.body?.token === 'string' ? request.body.token : ''
  const password = typeof request.body?.password === 'string' ? request.body.password : ''
  if (!/^[a-f\d]{64}$/i.test(token)) return response.status(400).json({ error: 'This password reset link is invalid or expired. Request a new one.' })
  if (password.length < 10 || password.length > 128) return response.status(400).json({ error: 'Use a password between 10 and 128 characters.' })
  const tokenHash = hashToken(token)
  const row = database.prepare("SELECT user_id, expires_at FROM account_tokens WHERE token_hash = ? AND purpose = 'reset_password'").get(tokenHash)
  if (!row || row.expires_at <= Date.now()) {
    if (row) database.prepare('DELETE FROM account_tokens WHERE token_hash = ?').run(tokenHash)
    return response.status(400).json({ error: 'This password reset link is invalid or expired. Request a new one.' })
  }
  const salt = randomBytes(16).toString('hex')
  const passwordHash = await scrypt(password, salt, 64)
  database.exec('BEGIN IMMEDIATE')
  try {
    database.prepare('UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?').run(salt, Buffer.from(passwordHash).toString('base64'), row.user_id)
    database.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(row.user_id)
    database.prepare('DELETE FROM account_tokens WHERE user_id = ?').run(row.user_id)
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
  clearAuthCookie(request, response)
  response.json({ reset: true })
})

app.delete('/api/auth/me', authRateLimit, async (request, response) => {
  const user = getAuthenticatedUser(request)
  if (!user) return response.status(401).json({ error: 'Sign in again before deleting this account.' })
  const password = typeof request.body?.password === 'string' ? request.body.password : ''
  if (!password || password.length > 128) return response.status(400).json({ error: 'Enter your current password to confirm account deletion.' })
  const stored = database.prepare('SELECT password_salt, password_hash FROM users WHERE id = ?').get(user.id)
  const suppliedHash = Buffer.from(await scrypt(password, stored.password_salt, 64))
  const storedHash = Buffer.from(stored.password_hash, 'base64')
  if (suppliedHash.length !== storedHash.length || !timingSafeEqual(suppliedHash, storedHash)) {
    return response.status(401).json({ error: 'That password did not match. Your account was not deleted.' })
  }
  database.exec('BEGIN IMMEDIATE')
  try {
    database.prepare('DELETE FROM trips WHERE user_id = ?').run(user.id)
    database.prepare('DELETE FROM account_tokens WHERE user_id = ?').run(user.id)
    database.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(user.id)
    database.prepare('DELETE FROM users WHERE id = ?').run(user.id)
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
  clearAuthCookie(request, response)
  response.json({ deleted: true })
})

app.get('/api/places/search', async (request, response) => {
  const query = typeof request.query.q === 'string' ? request.query.q.trim().replace(/[\u0000-\u001f]/g, '') : ''
  if (query.length < 2 || query.length > 80) return response.status(400).json({ error: 'Enter 2 to 80 characters to search places.' })
  const cacheKey = query.toLocaleLowerCase()
  const cached = readCache(placeSearchCache, cacheKey)
  if (cached) return response.json(cached)
  if (Date.now() - lastGeocodingRequestAt < 1000) return response.status(429).json({ error: 'Wait a moment before searching for another place.' })
  lastGeocodingRequestAt = Date.now()
  try {
    const params = new URLSearchParams({ name: query, count: '8', language: 'en', format: 'json' })
    const upstream = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, {
      headers: { accept: 'application/json', 'user-agent': 'HimvoyaTravelPlanner/1.0 (worldwide destination search)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!upstream.ok) throw new Error(`Geocoding service returned ${upstream.status}`)
    const payload = await upstream.json()
    const results = (Array.isArray(payload.results) ? payload.results : []).map((place) => ({
      id: `geonames-${place.id}`,
      city: place.name,
      country: place.country || '',
      region: [place.admin1, place.admin2, place.country].filter(Boolean).filter((value, index, array) => array.indexOf(value) === index).join(', '),
      location: [place.name, place.admin1, place.country].filter(Boolean).filter((value, index, array) => array.indexOf(value) === index).join(', '),
      coordinates: { lat: Number(place.latitude), lon: Number(place.longitude) },
      timezone: place.timezone || '',
      population: Number.isFinite(place.population) ? place.population : null,
      elevation: Number.isFinite(place.elevation) ? place.elevation : null,
      featureCode: place.feature_code || '',
    })).filter((place) => place.city && Number.isFinite(place.coordinates.lat) && Number.isFinite(place.coordinates.lon))
    const result = { results, attribution: 'Location data based on GeoNames via Open-Meteo.' }
    cacheValue(placeSearchCache, cacheKey, result, 10 * 60 * 1000)
    response.json(result)
  } catch {
    response.status(502).json({ error: 'Worldwide place search is temporarily unavailable. Try again in a moment.' })
  }
})

app.get('/api/places/photos', async (request, response) => {
  const query = typeof request.query.q === 'string' ? request.query.q.trim().replace(/[\u0000-\u001f]/g, '') : ''
  if (query.length < 2 || query.length > 100) return response.status(400).json({ error: 'Enter a place name to find photos.' })
  const cacheKey = query.toLocaleLowerCase()
  const cached = readCache(placePhotoCache, cacheKey)
  if (cached) return response.json(cached)
  try {
    const params = new URLSearchParams({
      action: 'query', generator: 'search', gsrsearch: `${query} landscape`, gsrnamespace: '6', gsrwhat: 'text', gsrlimit: '6',
      prop: 'imageinfo', iiprop: 'url|user', iiurlwidth: '1400', format: 'json',
    })
    const upstream = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      headers: { accept: 'application/json', 'user-agent': 'HimvoyaTravelPlanner/1.0 (travel destination image gallery)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!upstream.ok) throw new Error(`Wikimedia Commons returned ${upstream.status}`)
    const payload = await upstream.json()
    const pages = Object.values(payload.query?.pages ?? {})
    const photos = pages.flatMap((page) => {
      const image = page.imageinfo?.[0]
      if (!image?.thumburl || !/^image\/(jpeg|png|webp|avif)$/i.test(image.mime || '')) return []
      const title = stripMarkup(page.title).replace(/^File:/i, '')
      return [{
        src: image.thumburl,
        label: `${title} · ${image.user || 'Wikimedia Commons contributor'}`,
        url: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replaceAll(' ', '_'))}`,
      }]
    })
    const result = { photos }
    cacheValue(placePhotoCache, cacheKey, result, 24 * 60 * 60 * 1000)
    response.json(result)
  } catch {
    response.status(502).json({ error: 'Place photos are temporarily unavailable.' })
  }
})

app.get('/api/places/weather', async (request, response) => {
  const latitude = Number(request.query.lat)
  const longitude = Number(request.query.lon)
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return response.status(400).json({ error: 'Valid latitude and longitude are required.' })
  }
  const cacheKey = `${latitude.toFixed(2)},${longitude.toFixed(2)}`
  const cached = readCache(weatherCache, cacheKey)
  if (cached) return response.json(cached)
  try {
    const params = new URLSearchParams({
      latitude: String(latitude), longitude: String(longitude),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      forecast_days: '5', timezone: 'auto',
    })
    const upstream = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      headers: { accept: 'application/json', 'user-agent': 'HimvoyaTravelPlanner/1.0 (destination weather context)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!upstream.ok) throw new Error(`Forecast service returned ${upstream.status}`)
    const payload = await upstream.json()
    const daily = payload.daily ?? {}
    const forecast = (Array.isArray(daily.time) ? daily.time : []).map((date, index) => ({
      date,
      weatherCode: Number(daily.weather_code?.[index]),
      high: Number(daily.temperature_2m_max?.[index]),
      low: Number(daily.temperature_2m_min?.[index]),
      precipitationChance: Number.isFinite(daily.precipitation_probability_max?.[index]) ? daily.precipitation_probability_max[index] : null,
    })).filter((day) => day.date && Number.isFinite(day.high) && Number.isFinite(day.low))
    const current = payload.current ?? {}
    const result = {
      timezone: payload.timezone || '',
      current: {
        temperature: Number.isFinite(current.temperature_2m) ? current.temperature_2m : null,
        feelsLike: Number.isFinite(current.apparent_temperature) ? current.apparent_temperature : null,
        humidity: Number.isFinite(current.relative_humidity_2m) ? current.relative_humidity_2m : null,
        windSpeed: Number.isFinite(current.wind_speed_10m) ? current.wind_speed_10m : null,
        weatherCode: Number.isFinite(current.weather_code) ? current.weather_code : null,
      },
      forecast,
      attribution: 'Forecast data from Open-Meteo.',
    }
    cacheValue(weatherCache, cacheKey, result, 30 * 60 * 1000)
    response.json(result)
  } catch {
    response.status(502).json({ error: 'Weather context is temporarily unavailable.' })
  }
})

// Uptime monitors and Render's health check poll this; it fails with 503 when SQLite can't answer.
app.get(['/api/health', '/health'], (_request, response) => {
  response.set('Cache-Control', 'no-store')
  const checkedAt = new Date().toISOString()
  const uptimeSeconds = Math.round(process.uptime())
  try {
    database.prepare('SELECT 1').get()
    response.json({ status: 'ok', storage: 'sqlite', database: 'ok', uptimeSeconds, checkedAt })
  } catch (error) {
    console.error('[roam api] Health check failed:', error?.name || 'Error')
    response.status(503).json({ status: 'error', storage: 'sqlite', database: 'unavailable', uptimeSeconds, checkedAt })
  }
})

const trackedRoutes = new Set(['/','/places','/place','/world','/planner','/about','/privacy','/terms','/onboarding','/login','/register','/account','/account-deleted','/verify-email','/forgot-password','/reset-password','/not-found'])

app.post('/api/analytics/pageview', allowSameOrigin, eventRateLimit, (request, response) => {
  pruneTelemetry()
  const route = typeof request.body?.route === 'string' && trackedRoutes.has(request.body.route) ? request.body.route : '/other'
  database.prepare(`
    INSERT INTO analytics_daily (day, route, page_views) VALUES (date('now'), ?, 1)
    ON CONFLICT(day, route) DO UPDATE SET page_views = page_views + 1
  `).run(route)
  response.status(202).json({ recorded: true })
})

app.post('/api/errors/client', allowSameOrigin, eventRateLimit, (request, response) => {
  pruneTelemetry()
  const route = typeof request.body?.route === 'string' && trackedRoutes.has(request.body.route) ? request.body.route : '/other'
  const errorType = typeof request.body?.type === 'string' ? request.body.type : 'ClientError'
  const message = typeof request.body?.message === 'string' ? request.body.message : ''
  recordError(route, errorType, message)
  response.status(202).json({ recorded: true })
})

app.get('/api/admin/analytics', authRateLimit, (request, response) => {
  const expected = process.env.ROAM_ADMIN_TOKEN
  if (!expected) return response.status(404).json({ error: 'Analytics reporting is not enabled.' })
  const supplied = request.get('x-roam-admin-token') || ''
  const expectedBuffer = Buffer.from(expected)
  const suppliedBuffer = Buffer.from(supplied)
  if (expectedBuffer.length !== suppliedBuffer.length || !timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    return response.status(404).json({ error: 'Analytics reporting is not enabled.' })
  }
  const pageViews = database.prepare("SELECT day, route, page_views AS views FROM analytics_daily WHERE day >= date('now', '-30 days') ORDER BY day DESC, views DESC").all()
  const errors = database.prepare("SELECT day, route, error_type AS type, count, last_seen AS lastSeen FROM error_groups WHERE day >= date('now', '-30 days') ORDER BY day DESC, count DESC").all()
  response.json({ pageViews, errors })
})

app.use('/api/trips', allowSameOrigin)

app.get('/api/trips/current', (request, response) => {
  const context = getTripContext(request, response)
  if (!context) return
  const row = readCurrentTrip(context)
  if (!row) {
    response.json({ trip: null, selectedIds: [] })
    return
  }
  response.json({
    trip: JSON.parse(row.trip_json),
    selectedIds: JSON.parse(row.selected_ids_json),
    updatedAt: row.updated_at,
  })
})

app.put('/api/trips/current', (request, response) => {
  const context = getTripContext(request, response)
  if (!context) return

  const { trip, selectedIds } = request.body ?? {}
  const validTrip = trip && typeof trip === 'object'
    && Array.isArray(trip.destinationNames)
    && trip.destinationNames.every((name) => typeof name === 'string' && name.length <= 100)
    && Array.isArray(trip.itinerary)
    && trip.itinerary.length <= 31
    && Number.isInteger(trip.days) && trip.days >= 1 && trip.days <= 31
    && Number.isInteger(trip.travelers) && trip.travelers >= 1 && trip.travelers <= 20
    && typeof trip.budget === 'string' && trip.budget.length <= 80
    && (trip.transport === undefined || typeof trip.transport === 'string' && trip.transport.length <= 80)
    && (trip.stayStyle === undefined || typeof trip.stayStyle === 'string' && trip.stayStyle.length <= 80)
    && (trip.travelNote === undefined || typeof trip.travelNote === 'string' && trip.travelNote.length <= 1000)
    && (trip.routeDestinations === undefined || Array.isArray(trip.routeDestinations) && trip.routeDestinations.length <= 30)
  const validSelectedIds = Array.isArray(selectedIds)
    && selectedIds.length <= 30
    && selectedIds.every((id) => typeof id === 'string' && id.length <= 100)

  if (!validTrip || !validSelectedIds) {
    response.status(400).json({ error: 'The trip details are not in a valid format.' })
    return
  }

  const saved = saveCurrentTrip(context, trip, selectedIds)
  if (!saved) return response.status(409).json({ error: 'Refresh the planner session before saving this trip.' })
  const row = context.user
    ? database.prepare('SELECT updated_at FROM trips WHERE user_id = ?').get(context.user.id)
    : database.prepare('SELECT updated_at FROM trips WHERE session_id = ? AND user_id IS NULL').get(context.sessionId)
  response.json({ trip, selectedIds, updatedAt: row.updated_at })
})

app.delete('/api/trips/current', (request, response) => {
  const context = getTripContext(request, response)
  if (!context) return
  if (context.user) database.prepare('DELETE FROM trips WHERE user_id = ?').run(context.user.id)
  else database.prepare('DELETE FROM trips WHERE session_id = ? AND user_id IS NULL').run(context.sessionId)
  response.json({ deleted: true })
})

app.use((error, request, response, _next) => {
  recordError(request.path, error?.name || 'ServerError', error?.message || 'Unhandled server error')
  console.error('[roam api] Request failed:', error?.name || 'Error', request.method, request.path)
  if (response.headersSent) return
  response.status(500).json({ error: 'Something went wrong. Please try again.' })
})

const builtIndex = resolve(rootDirectory, 'dist/index.html')
app.use(express.static(resolve(rootDirectory, 'dist'), { index: false, fallthrough: true }))
app.use((request, response) => {
  if (request.path.startsWith('/api/')) {
    response.status(404).json({ error: 'API route not found.' })
    return
  }
  if (!existsSync(builtIndex)) {
    response.status(503).type('text').send('Build the app with `npm run build` before using the production server.')
    return
  }
  response.sendFile(builtIndex)
})

app.listen(port, '0.0.0.0', () => {
  console.log(`roam backend listening on http://localhost:${port}`)
  console.log(`SQLite database: ${absoluteDatabasePath}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    database.close()
    process.exit(0)
  })
}
