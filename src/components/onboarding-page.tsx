import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Compass, MapPin, Sparkles } from 'lucide-react'

type Props = { email: string | null; onNavigate: (path: string) => void }
const travelStyles = ['Roads & rail', 'Trek & trails', 'Coast & slow days', 'Culture & food']

export default function OnboardingPage({ email, onNavigate }: Props) {
  const [step, setStep] = useState(1)
  const [styles, setStyles] = useState<string[]>([])
  const [region, setRegion] = useState<'India' | 'World' | ''>('')

  function toggleStyle(style: string) {
    setStyles((current) => current.includes(style) ? current.filter((item) => item !== style) : [...current, style])
  }

  return (
    <section className="onboarding-page">
      <section className="onboarding-panel">
        <div className="onboarding-topline"><a href="#/" className="onboarding-brand"><Compass size={19} /> Himvoya /</a><span>YOUR FIRST JOURNEY · {String(step).padStart(2, '0')} / 03</span></div>
        <div className="onboarding-progress"><span style={{ width: `${step / 3 * 100}%` }} /></div>
        {step === 1 ? <div className="onboarding-body">
          <span className="auth-kicker">A GOOD PLACE TO BEGIN</span><h1>What feels like <em>your kind of trip?</em></h1><p className="onboarding-copy">Choose a few things you love. There’s no wrong way to travel, and you can change your mind anytime.</p>
          <div className="onboarding-choice-grid">{travelStyles.map((style) => <button key={style} type="button" className={`onboarding-choice ${styles.includes(style) ? 'selected' : ''}`} onClick={() => toggleStyle(style)} aria-pressed={styles.includes(style)}><span>{styles.includes(style) ? <Check size={17} /> : <Sparkles size={17} />}</span>{style}</button>)}</div>
          <div className="onboarding-actions"><button type="button" className="onboarding-quiet" onClick={() => setStep(2)}>Skip for now</button><button type="button" className="auth-submit onboarding-next" onClick={() => setStep(2)}><span>Continue</span><ArrowRight size={16} /></button></div>
        </div> : step === 2 ? <div className="onboarding-body">
          <span className="auth-kicker">CHOOSE YOUR MAP</span><h1>Where would you like <em>to start?</em></h1><p className="onboarding-copy">Himvoya starts with the mountain roads, coastlines, train journeys, and small discoveries of India. There’s a separate map for everywhere else.</p>
          <div className="onboarding-choice-grid region-grid"><button type="button" className={`onboarding-choice ${region === 'India' ? 'selected' : ''}`} onClick={() => setRegion('India')} aria-pressed={region === 'India'}><span><MapPin size={17} /></span>Explore India</button><button type="button" className={`onboarding-choice ${region === 'World' ? 'selected' : ''}`} onClick={() => setRegion('World')} aria-pressed={region === 'World'}><span><Compass size={17} /></span>See the world</button></div>
          <div className="onboarding-actions"><button type="button" className="onboarding-quiet" onClick={() => setStep(1)}><ArrowLeft size={14} /> Back</button><button type="button" className="auth-submit onboarding-next" onClick={() => setStep(3)} disabled={!region}><span>Continue</span><ArrowRight size={16} /></button></div>
        </div> : <div className="onboarding-body">
          <span className="auth-kicker">YOU’RE ALL SET{email ? ` · ${email}` : ''}</span><h1>Let’s make a little <em>room for wonder.</em></h1><p className="onboarding-copy">Save the places that catch your eye, then shape them into a route when you’re ready. Your picks will stay with your account.</p>
          {styles.length > 0 && <div className="onboarding-summary"><span>Your travel notes</span>{styles.map((style) => <small key={style}>{style}</small>)}</div>}
          <div className="onboarding-actions"><button type="button" className="onboarding-quiet" onClick={() => setStep(2)}><ArrowLeft size={14} /> Back</button><div className="onboarding-final-actions"><button type="button" className="auth-submit" onClick={() => onNavigate(region === 'World' ? '#/world' : '#/places')}><span>Explore {region || 'India'}</span><ArrowRight size={16} /></button><button type="button" className="onboarding-plan-link" onClick={() => onNavigate('#/planner')}>Open trip planner</button></div></div>
        </div>}
      </section>
      <button type="button" className="onboarding-skip-link" onClick={() => onNavigate('#/planner')}>Skip onboarding and plan a trip <ArrowRight size={14} /></button>
    </section>
  )
}
