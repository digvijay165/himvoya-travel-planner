import { ArrowUpRight, Compass, ShieldCheck } from 'lucide-react'

const terms = [
  ['Planning, not booking', 'Himvoya helps you collect destinations and draft an itinerary. It does not reserve or sell flights, accommodation, transport, tours, or entry tickets. Confirm prices, availability, and booking conditions with the provider before paying.'],
  ['Check current local guidance', 'Travel details, maps, images, forecasts, and suggested activities can be incomplete or out of date. Check official sources for visa and entry rules, safety advice, weather, opening times, permits, road status, and health guidance.'],
  ['Your account and trip notes', 'Keep your sign-in details private and provide accurate account information. You are responsible for the notes and trip details you add. Read the Privacy & database page for how this app stores them and how to clear a trip.'],
  ['Use the service responsibly', 'Do not attempt to access another traveller’s account or data, disrupt the service, misuse its search tools, or upload content that violates another person’s rights. We may restrict access to protect the service and its users.'],
  ['External services and links', 'Place search, weather, maps, and photo providers operate independently and may have their own terms, content rules, and availability. Himvoya does not control their services.'],
  ['Availability and changes', 'The app is provided as a travel-planning tool and may change as it is maintained. Save important bookings and documents with the providers involved; do not rely on Himvoya as the only copy of essential travel information.'],
]

export default function TermsPage() {
  return (
    <section className="terms-page">
      <header className="terms-hero"><a href="#/" className="terms-brand"><Compass size={18} /> Himvoya /</a><span className="eyebrow"><span className="eyebrow-mark" />TERMS OF USE</span><h1>Good journeys begin<br /><em>with clear expectations.</em></h1><p>These terms explain the basics of using Himvoya, a travel-planning app.</p></header>
      <div className="terms-content"><div className="terms-intro-note"><ShieldCheck size={18} /><p>Himvoya creates itinerary drafts and discovery guides. You stay in control of your plans, bookings, and travel decisions.</p></div>
        {terms.map(([title, text], index) => <section className="terms-section" key={title}><span>{String(index + 1).padStart(2, '0')}</span><div><h2>{title}</h2><p>{text}</p></div></section>)}
        <section className="terms-contact"><div><span>TRAVEL LIGHT, PLAN THOUGHTFULLY</span><h2>Ready to make a plan?</h2></div><a href="#/planner">Open the planner <ArrowUpRight size={15} /></a></section>
        <p className="terms-policy-link">For information about saved account and trip details, see the <a href="#/privacy">Privacy & database page</a>.</p>
      </div>
    </section>
  )
}
