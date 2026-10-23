import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowUpRight, Clock3, Cloud, CloudDrizzle, CloudLightning, CloudRain, CloudSnow, CloudSun, Droplets, MapPin, Sun, Wind, X } from 'lucide-react'

export type PlaceHighlight = {
  name: string
  area: string
  kind: string
  description: string
  time: string
}

export type PlaceGuideData = {
  id: string
  city: string
  country: string
  region: string
  category: string
  image: string
  note: string
  from: string
  moments: string[]
  location?: string
  coordinates?: { lat: number; lon: number }
  overview?: string
  bestTime?: string
  language?: string
  currency?: string
  gallery?: string[]
  galleryAttributions?: Array<{ label: string; url: string } | null>
  timezone?: string
  population?: number | null
  elevation?: number | null
  highlights?: PlaceHighlight[]
  localTip?: string
  officialGuide?: string
  gettingAround?: string
  whereToStay?: string
  localFlavours?: string[]
  nearbyEscapes?: string[]
  planningNotes?: string[]
}

type Props = {
  destination: PlaceGuideData
  isPicked: boolean
  onClose: () => void
  onToggle: () => void
  page?: boolean
}

type WeatherSummary = {
  timezone: string
  current: { temperature: number | null; feelsLike: number | null; humidity: number | null; windSpeed: number | null; weatherCode: number | null }
  forecast: Array<{ date: string; weatherCode: number; high: number; low: number; precipitationChance: number | null }>
}

// Gallery buttons load a small Wikimedia thumbnail instead of the full 1280px photo.
const thumbnailPhoto = (src: string) => src.replace(/\/1280px-/, '/330px-')

function weatherDescription(code: number | null) {
  if (code === 0) return { label: 'Clear', icon: Sun }
  if (code === 1 || code === 2) return { label: 'Partly cloudy', icon: CloudSun }
  if (code === 3 || code === 45 || code === 48) return { label: code === 3 ? 'Cloudy' : 'Fog', icon: Cloud }
  if (code !== null && code >= 51 && code <= 57) return { label: 'Drizzle', icon: CloudDrizzle }
  if (code !== null && code >= 61 && code <= 67) return { label: 'Rain', icon: CloudRain }
  if (code !== null && code >= 71 && code <= 86) return { label: 'Snow', icon: CloudSnow }
  if (code !== null && code >= 95) return { label: 'Thunderstorm', icon: CloudLightning }
  return { label: 'Changing conditions', icon: Cloud }
}

export default function DestinationGuide({ destination, isPicked, onClose, onToggle, page = false }: Props) {
  const photos = destination.gallery?.length ? destination.gallery : [destination.image]
  const [activePhoto, setActivePhoto] = useState(0)
  const photoCredit = destination.galleryAttributions?.[activePhoto]
  const [weather, setWeather] = useState<WeatherSummary | null>(null)
  const [weatherState, setWeatherState] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const latitude = destination.coordinates?.lat
  const longitude = destination.coordinates?.lon

  useEffect(() => {
    setActivePhoto(0)
  }, [destination.id])

  useEffect(() => {
    let active = true
    if (latitude == null || longitude == null) {
      setWeather(null)
      setWeatherState('unavailable')
      return () => { active = false }
    }
    setWeatherState('loading')
    fetch(`/api/places/weather?lat=${latitude}&lon=${longitude}`)
      .then(async (response) => {
        const result = await response.json() as WeatherSummary & { error?: string }
        if (!response.ok) throw new Error(result.error || 'Weather unavailable')
        return result
      })
      .then((result) => {
        if (!active) return
        setWeather(result)
        setWeatherState('ready')
      })
      .catch(() => {
        if (!active) return
        setWeather(null)
        setWeatherState('unavailable')
      })
    return () => { active = false }
  }, [latitude, longitude])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const previousOverflow = document.body.style.overflow
    if (!page) document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKey)
    return () => {
      if (!page) document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose, page])

  const placeName = `${destination.city}, ${destination.country}`
  const coordinates = destination.coordinates
  const mapUrl = coordinates
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${coordinates.lon - 0.08}%2C${coordinates.lat - 0.055}%2C${coordinates.lon + 0.08}%2C${coordinates.lat + 0.055}&layer=mapnik&marker=${coordinates.lat}%2C${coordinates.lon}`
    : `https://www.openstreetmap.org/search?query=${encodeURIComponent(placeName)}`

  const content = (
    <div className={page ? 'guide-page' : 'guide-backdrop'} role={page ? undefined : 'presentation'} onMouseDown={(event) => { if (!page && event.target === event.currentTarget) onClose() }}>
      <section className={`place-guide ${page ? 'place-guide-page' : ''}`} role={page ? undefined : 'dialog'} aria-modal={page ? undefined : true} aria-labelledby="guide-title">
        <button type="button" className={`guide-close ${page ? 'guide-back-link' : ''}`} onClick={onClose} aria-label={page ? 'Back to explore' : 'Close place guide'} autoFocus>{page ? <><ArrowLeft size={16} /> Back to Explore</> : <X size={19} />}</button>

        <div className="guide-layout">
          <div className="guide-gallery-column">
            <div className="guide-main-photo" style={{ backgroundImage: `url("${photos[activePhoto]}")` }} role="img" aria-label={`${destination.city} travel photo ${activePhoto + 1}`}>
              <span className="guide-photo-count">{String(activePhoto + 1).padStart(2, '0')} / {String(photos.length).padStart(2, '0')}</span>
            </div>
            {photos.length > 1 && (
              <div className="guide-thumbnails" aria-label="Place photo gallery">
                {photos.map((photo, index) => (
                  <button key={`${photo}-${index}`} className={`guide-thumbnail ${index === activePhoto ? 'active' : ''}`} type="button" onClick={() => setActivePhoto(index)} aria-label={`Show photo ${index + 1}`} aria-pressed={index === activePhoto} style={{ backgroundImage: `url("${thumbnailPhoto(photo)}")` }} />
                ))}
              </div>
            )}
            <div className="guide-map-wrap">
              <div className="guide-map-heading"><span><MapPin size={15} /> Find your bearings</span><a href={mapUrl} target="_blank" rel="noreferrer">Open map <ArrowUpRight size={13} /></a></div>
              {coordinates ? <iframe title={`Map of ${destination.city}`} src={mapUrl} loading="lazy" referrerPolicy="no-referrer" /> : <a className="guide-map-search" href={mapUrl} target="_blank" rel="noreferrer"><MapPin size={20} /><span>Search for {destination.city} on OpenStreetMap</span><ArrowUpRight size={15} /></a>}
            </div>
          </div>

          <div className="guide-content">
            <div className="guide-kicker"><span>{destination.category}</span><span className="guide-kicker-rule" />{destination.region}</div>
            <h2 id="guide-title">{destination.city}<em>{destination.country !== 'Your own discovery' ? destination.country : ''}</em></h2>
            <p className="guide-location"><MapPin size={15} />{destination.location || `${destination.city} · ${destination.country}`}</p>
            <p className="guide-overview">{destination.overview || destination.note}</p>

            <div className="guide-facts">
              <div><span>SUGGESTED STAY</span><strong>{destination.from.replace(' feels right', '')}</strong></div>
              <div><span>BEST TIME</span><strong>{destination.bestTime || 'Anytime, at your pace'}</strong></div>
              <div><span>LANGUAGE</span><strong>{destination.language || 'Ask a local'}</strong></div>
              <div><span>CURRENCY</span><strong>{destination.currency || 'Check before you go'}</strong></div>
              {destination.timezone && <div><span>TIME ZONE</span><strong>{destination.timezone}</strong></div>}
              {destination.population != null && <div><span>POPULATION</span><strong>{destination.population.toLocaleString()}</strong></div>}
              {destination.elevation != null && <div><span>ELEVATION</span><strong>{Math.round(destination.elevation)} m above sea level</strong></div>}
            </div>

            {coordinates && <section className="guide-weather" aria-label={`Weather forecast for ${destination.city}`} aria-live="polite">
              <div className="weather-heading"><div><span><Sun size={14} /> LOCAL WEATHER</span><small>{weather?.timezone || destination.timezone || 'Local forecast'}</small></div><small>5-day outlook</small></div>
              {weatherState === 'loading' && <p className="weather-status">Loading local forecast…</p>}
              {weatherState === 'unavailable' && <p className="weather-status">Forecast unavailable right now. Check a local forecast closer to your trip.</p>}
              {weatherState === 'ready' && weather && <>
                <div className="weather-now">
                  {(() => { const TodayIcon = weatherDescription(weather.current.weatherCode).icon; return <TodayIcon size={29} strokeWidth={1.4} /> })()}
                  <strong>{weather.current.temperature != null ? `${Math.round(weather.current.temperature)}°` : '—'}</strong>
                  <span>{weatherDescription(weather.current.weatherCode).label}</span>
                  <small>{weather.current.feelsLike != null ? `Feels ${Math.round(weather.current.feelsLike)}°` : ''}</small>
                  {weather.current.humidity != null && <small><Droplets size={11} />{weather.current.humidity}%</small>}
                  {weather.current.windSpeed != null && <small><Wind size={11} />{Math.round(weather.current.windSpeed)} km/h</small>}
                </div>
                <div className="weather-forecast">
                  {weather.forecast.map((day) => {
                    const DayIcon = weatherDescription(day.weatherCode).icon
                    return <div className="weather-day" key={day.date}>
                      <span>{new Intl.DateTimeFormat('en', { weekday: 'short' }).format(new Date(`${day.date}T12:00:00`))}</span>
                      <DayIcon size={16} strokeWidth={1.5} />
                      <strong>{Math.round(day.high)}° <i>{Math.round(day.low)}°</i></strong>
                      {day.precipitationChance != null && <small>{Math.round(day.precipitationChance)}% rain</small>}
                    </div>
                  })}
                </div>
                <p className="weather-attribution">Forecast by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>. Forecasts change; check again before travel.</p>
              </>}
            </section>}

            <div className="guide-section-heading"><span className="guide-index">01</span><div><span>MAKE A LITTLE TIME FOR</span><h3>Worth seeing</h3></div></div>
            <div className="guide-highlights">
              {(destination.highlights?.length ? destination.highlights : destination.moments.map((moment, index) => ({ name: moment, area: destination.city, kind: 'Local moment', description: moment, time: index === 0 ? 'A morning' : 'Take your time' }))).map((highlight, index) => (
                <article key={`${highlight.name}-${index}`} className="guide-highlight">
                  <span className="highlight-number">{String(index + 1).padStart(2, '0')}</span>
                  <div><span className="highlight-area">{highlight.kind} · {highlight.area}</span><h4>{highlight.name}</h4><p>{highlight.description}</p><span className="highlight-time"><Clock3 size={12} />{highlight.time}</span></div>
                </article>
              ))}
            </div>

            <div className="guide-section-heading guide-details-heading"><span className="guide-index">02</span><div><span>THE LITTLE THINGS</span><h3>Useful to know</h3></div></div>
            <div className="guide-practical-grid">
              <article className="guide-practical-card guide-transport-card"><span className="practical-label">GETTING AROUND</span><p>{destination.gettingAround || 'Check local transit options and current schedules before you head out.'}</p></article>
              <article className="guide-practical-card"><span className="practical-label">WHERE TO BASE YOURSELF</span><p>{destination.whereToStay || 'Choose a base near the places you most want to explore.'}</p></article>
              <article className="guide-practical-card"><span className="practical-label">TASTE OF THE PLACE</span><div className="guide-tag-list">{(destination.localFlavours?.length ? destination.localFlavours : ['Ask for a local specialty']).map((food) => <span key={food}>{food}</span>)}</div></article>
              {destination.nearbyEscapes?.length ? <article className="guide-practical-card"><span className="practical-label">NEARBY IDEAS</span><div className="guide-tag-list">{destination.nearbyEscapes.map((escape) => <span key={escape}>{escape}</span>)}</div></article> : null}
            </div>
            {destination.planningNotes?.length ? <div className="guide-planning-notes"><span className="practical-label">BEFORE YOU GO</span><ul>{destination.planningNotes.map((note) => <li key={note}>{note}</li>)}</ul></div> : null}

            <aside className="guide-tip"><span>A SMALL LOCAL NOTE</span><p>{destination.localTip || 'Leave a little room in your day for a recommendation you didn’t plan.'}</p></aside>
            <div className="guide-actions">
              {destination.officialGuide && <a className="guide-official-link" href={destination.officialGuide} target="_blank" rel="noreferrer">Official visitor guide <ArrowUpRight size={14} /></a>}
              <button type="button" className={`guide-add-button ${isPicked ? 'selected' : ''}`} onClick={onToggle}>{isPicked ? 'Remove from your trip' : 'Add to your trip'}<span>{isPicked ? '−' : '+'}</span></button>
            </div>
            <p className="guide-photo-credit">
              {photoCredit
                ? <>Photo: <a href={photoCredit.url} target="_blank" rel="noreferrer">{photoCredit.label}</a> · Wikimedia Commons</>
                : 'Photos from Unsplash'}
              {' · '}Check local access and seasonal conditions before visiting.
            </p>
          </div>
        </div>
      </section>
    </div>
  )

  return page ? content : createPortal(content, document.body)
}

