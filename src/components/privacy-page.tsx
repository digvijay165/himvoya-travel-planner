import { Activity, ArrowRight, CloudSun, Database, KeyRound, MapPin, ShieldCheck, Trash2 } from 'lucide-react'

const dataItems = [
  {
    icon: <KeyRound size={19} />,
    number: '01',
    title: 'Your account',
    text: 'If you create an account, Himvoya stores your email, a random account ID, a password salt and password hash, and the account creation date. Your password is not stored as readable text.',
  },
  {
    icon: <MapPin size={19} />,
    number: '02',
    title: 'Your trip',
    text: 'A saved plan can include chosen places, dates, route and daily itinerary, budget, group size, transport, stay style, and your freeform travel note.',
  },
  {
    icon: <Database size={19} />,
    number: '03',
    title: 'Your browser',
    text: 'This browser keeps a planner session ID and a local copy of your draft, selected places, and custom place cards so the planner can restore them on return.',
  },
  {
    icon: <ShieldCheck size={19} />,
    number: '04',
    title: 'Sign-in sessions',
    text: 'A sign-in uses a random, HttpOnly cookie that expires after 30 days. The database keeps a hash of its token and its expiry time; signing out revokes that session.',
  },
  {
    icon: <Activity size={19} />,
    number: '05',
    title: 'Usage & errors',
    text: 'Basic analytics count page views by day and route. Error reports are grouped by a one-way digest, route, and error type; raw messages and account identifiers are not stored in these tables.',
  },
]

export default function PrivacyPage() {
  return (
    <section className="privacy-page">
      <header className="privacy-hero">
        <span className="eyebrow"><span className="eyebrow-mark" />HIMVOYA / PRIVACY & DATABASE</span>
        <h1>Your plans are personal.<br /><em>Here’s where they go.</em></h1>
        <p>This plain-language guide describes what the current Himvoya travel planner stores, where it goes, and the controls available to you.</p>
        <div className="privacy-hero-note"><ShieldCheck size={17} /><span>We describe the app as it works today. We do not claim that the database is encrypted at rest or that backups are automatically erased.</span></div>
      </header>

      <div className="privacy-content">
        <section className="privacy-section">
          <div className="privacy-section-title"><span>01 / THE DETAILS</span><h2>What Himvoya saves</h2><p>These are the details needed to remember your route and keep your account signed in.</p></div>
          <div className="privacy-data-grid">
            {dataItems.map((item) => (
              <article className="privacy-data-card" key={item.number}>
                <div className="privacy-card-top"><span>{item.icon}</span><small>{item.number}</small></div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="privacy-section privacy-split-section">
          <div className="privacy-section-title"><span>02 / STORAGE</span><h2>Where it lives</h2></div>
          <div className="privacy-prose">
            <p>When the backend is available, Himvoya saves trip details and account records in a SQLite database on the server that runs this app. The server creates a snapshot at startup and every 24 hours while it is running, keeping up to 14 copies in a local backups folder. These copies are on the same server, not off-site; deleted records can remain in them until the operator removes those snapshots.</p>
            <p>A trip draft is also kept in this browser’s local storage. Signing in can associate an anonymous draft with your account when the account does not already have a saved trip. Signing out ends the current login session; it does not clear trip data.</p>
            <p>Trip details remain until you clear or replace the trip, or the server operator removes them. Login sessions expire after 30 days. You can delete an account from My account after confirming the current password; this removes the active account, sessions, tokens, trip, and browser planner copy. Existing database snapshots can retain a copy until their operator deletes them.</p>
            <p>Analytics store daily totals by page route for up to 365 days. Error summaries store the day, route, error type, a one-way message digest, and a count for up to 90 days. They do not store a browser IP address, account ID, or login cookie.</p>
          </div>
        </section>

        <section className="privacy-section privacy-services-section">
          <div className="privacy-section-title"><span>03 / OUTSIDE SERVICES</span><h2>Place search, weather & photos</h2><p>Some travel information comes from services outside Himvoya.</p></div>
          <div className="privacy-service-list">
            <article><CloudSun size={19} /><div><h3>Location and weather</h3><p>Place names you search and destination coordinates used for forecasts are sent to Open-Meteo. Its geocoding data is based on GeoNames.</p></div></article>
            <article><MapPin size={19} /><div><h3>Destination photos</h3><p>When you search for a place, its name is sent to Wikimedia Commons for photo previews. Destination and gallery images may load directly from Wikimedia Commons or Unsplash in your browser.</p></div></article>
            <article><ShieldCheck size={19} /><div><h3>Account security check</h3><p>When enabled by the site operator, login, signup, and recovery forms load Cloudflare Turnstile. The browser communicates with Cloudflare and the server sends the one-time challenge token to Cloudflare for verification. Himvoya does not store the token.</p></div></article>
            <div className="privacy-service-note">Himvoya does not include your account email or private trip note in these place, weather, or photo lookups. Those services receive their own requests and may process standard connection data under their own practices.</div>
          </div>
        </section>

        <section className="privacy-controls">
          <div className="privacy-controls-icon"><Trash2 size={20} /></div>
          <div><span>04 / YOUR CONTROLS</span><h2>Clear a saved trip</h2><p>Choose <strong>Clear trip</strong> in the planner to remove the current itinerary and selected places from the browser and, when connected, the Himvoya database. Custom place cards remain in this browser until its site data is cleared in browser settings.</p></div>
          <div className="privacy-control-links"><a href="#/planner">Open the planner <ArrowRight size={15} /></a><a href="#/account">Account and sign-in <ArrowRight size={15} /></a></div>
        </section>

        <p className="privacy-last-note">Questions about data on a self-hosted Himvoya app? Contact the person or organization that operates that app.</p>
      </div>
    </section>
  )
}
