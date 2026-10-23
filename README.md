# Himvoya — India-first Travel Planner

A responsive, multi-page travel planner built with React, TypeScript, Tailwind CSS, Vite, Express, and SQLite. India is the featured destination collection; a separate Foreign Places page searches worldwide cities and towns. It uses the supplied Liquid Sculpture hero component in `src/components/ui`.

## Run in development

```bash
npm install
npm run dev
```

The development command starts the Vite frontend and the Express API together. The API writes accounts and trips to `data/travel-planner.sqlite`. It creates SQLite snapshots in `data/backups/` at startup and every 24 hours while the server is running, keeping up to 14 files. These snapshots are on the same machine; copy them to a separate backup service for disaster recovery.

## Run as a production app

```bash
npm run build
npm start
```

The Node server serves the built frontend and `/api` from one origin. Set `PORT` to change the listening port or `ROAM_DB_PATH` to store the SQLite database at another path.

## Deploy to Render Free

The repository includes a Render Blueprint for a free Node web service. Apply it from Render after connecting this repository. The service uses `/tmp/travel-planner.sqlite` because Free services cannot attach persistent disks. **Render Free clears local files when the service sleeps, restarts, or redeploys, so saved accounts and trips can be lost.** The service also sleeps after 15 minutes without traffic and can take about a minute to wake. This deployment is suitable for a public demo, not for storing important user data.

After the service gets its public URL, set `ROAM_PUBLIC_URL` to that HTTPS address. To enable account registration, email verification, and password reset, add `RESEND_API_KEY`, `ROAM_EMAIL_FROM`, `ROAM_TURNSTILE_SITE_KEY`, and `ROAM_TURNSTILE_SECRET_KEY` in the Render service settings. Configure Turnstile for the assigned hostname. Add optional `ROAM_ADMIN_TOKEN` only if you need the private analytics endpoint. Keep secrets in Render, never in GitHub.

See [Render's free-service limits](https://render.com/docs/free) and [persistent disk pricing](https://render.com/docs/disks). Durable SQLite storage requires a paid Render service with a persistent disk.

## API

- `GET /api/health` reports whether the backend is running.
- `GET /api/auth/me` reports the signed-in account, if any.
- `POST /api/auth/register` creates an account.
- `POST /api/auth/login` signs in.
- `POST /api/auth/logout` revokes the current session.
- `GET /api/places/search?q=...` searches worldwide settlements using Open-Meteo Geocoding (GeoNames data).
- `GET /api/places/photos?q=...` looks up destination photos through Wikimedia Commons.
- `GET /api/places/weather?lat=...&lon=...` loads a five-day local forecast from Open-Meteo.
- `GET /api/trips/current` loads the current browser’s trip.
- `PUT /api/trips/current` creates or updates it.
- `DELETE /api/trips/current` clears it.

Trip requests include an `x-roam-session` UUID generated in the browser. This scopes anonymous drafts; signed-in trip reads, writes, and deletes are scoped to the authenticated user ID in every SQL query. SQLite does not provide native row-level security policies, so ownership is enforced by the API layer. Account sessions use a separate HttpOnly cookie and only a hash of the random session token is stored in SQLite. Passwords are salted and hashed with Node's scrypt implementation.

## Account email and recovery

Account registration requires email verification. Password reset and verification links are single-use tokens stored as hashes, with 1-hour reset links and 24-hour verification links. Configure a [Resend](https://resend.com/) API key, a verified sender address, and the public app URL in server environment variables:

```text
RESEND_API_KEY=...
ROAM_EMAIL_FROM=Himvoya <no-reply@your-verified-domain.example>
ROAM_PUBLIC_URL=https://your-domain.example
ROAM_TURNSTILE_SITE_KEY=...
ROAM_TURNSTILE_SECRET_KEY=...
```

Copy `.env.example` to `.env` for local development. Resend credentials and the Turnstile secret are read only by the Node API and must never use a `VITE_` prefix. The Turnstile site key is public and is returned by `/api/public-config`; its secret stays on the server. Production requires a complete Turnstile key pair for signup, sign-in, verification resend, and password-reset requests. Local development can run without CAPTCHA keys; when configured, the server verifies each one-use challenge with Cloudflare before processing the form. Configure the widget for your production hostname. Without email delivery configured, local development prints action links in the API terminal; production refuses new account registration until delivery is configured. Existing users from before email verification was added are treated as verified.

Account endpoints allow at most 12 attempts per IP in a 15-minute window. This limiter is held in process memory, so it resets on server restart and is not shared across multiple server instances; use a shared limiter such as Redis if deploying multiple instances.

## Analytics and error reporting

First-party page analytics store daily route counts, not user IDs or IP addresses. React and API errors are grouped by a one-way message digest, route, and error type; raw client error messages are not stored in the database. Data expires after 365 days for analytics and 90 days for error groups. Set the server-only `ROAM_ADMIN_TOKEN` to enable `GET /api/admin/analytics`, then send it as the `x-roam-admin-token` header from a trusted operator environment. Do not put this token in the frontend.

## Backups and restore

Snapshots use Node's SQLite online backup API and are created in a sibling `backups/` directory for custom `ROAM_DB_PATH` values. To restore, stop the app and replace the configured SQLite database with a chosen snapshot before restarting. Keep an encrypted off-host copy if the app contains real user data; local snapshots alone do not protect against loss of the host.

## What’s included

- Interactive particle hero with a static-image fallback.
- Separate Home, India, Foreign Places, Trip Planner, About, Place Guide, Onboarding, Terms, Privacy, Sign in, Register, Account, and Sign out pages connected by shared navigation.
- Twenty curated Indian destinations for scenic drives, heritage rail journeys, trekking, culture, coast, nature, and slower trips; search for additional Indian cities and towns.
- Fourteen curated international guides in a separate Foreign Places section, plus worldwide city and town search, maps, destination photos, geographic facts, a five-day local forecast, and starter trip notes.
- Multi-image galleries on curated destination guides, with click-to-open place cards and additional photo search for custom destinations.
- Destination guides with photo galleries, map embeds, sights and activity ideas, local transport, stay areas, food, nearby outings, and planning notes.
- Trip dates, duration, budget style, travelers, preferred transport, stay type, personal notes, and a day-by-day draft itinerary.
- Express API for verified account registration, login/logout, password recovery, account deletion, place search/photos, and loading/saving/clearing trips.
- SQLite persistence for accounts, hashed account sessions/action tokens, trip details, aggregate analytics/error groups, and selected destinations.
- Mobile layouts, form validation, loading/empty/error states, and a custom not-found page.
- Turnstile challenge on production account and recovery forms, with server-side Siteverify validation.
- Browser local storage as an offline fallback for anonymous drafts and a migration path for existing drafts.
- shadcn-compatible `src/components/ui` structure and `components.json` aliases.

Featured photos load from Unsplash; searched destination photos come from Wikimedia Commons and link to file attribution. Worldwide location search covers GeoNames cities and towns, not every attraction or live travel inventory. The app creates planning drafts and does not book flights, accommodation, or tours. The backend uses Node’s built-in SQLite module, so run it with Node 24.15 or newer.

