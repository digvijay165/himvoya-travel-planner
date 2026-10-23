import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Compass,
  Heart,
  MapPin,
  Minus,
  Plus,
  Search,
  Sparkles,
  Users,
  X,
  CarFront,
  TrainFront,
  Footprints,
} from 'lucide-react'
import SculptureHero from '@/components/ui/liquid-sculpture-hero'
import DestinationGuide from '@/components/destination-guide'
import type { PlaceGuideData } from '@/components/destination-guide'
import SiteHeader from '@/components/site-header'
import AuthPage, { type AuthMode } from '@/components/auth-page'
import PrivacyPage from '@/components/privacy-page'
import AccountActionPage, { type AccountActionMode } from '@/components/account-action-page'
import OnboardingPage from '@/components/onboarding-page'
import TermsPage from '@/components/terms-page'

type Category = 'All' | 'Drive & rail' | 'Trek & trails' | 'Coast' | 'Culture' | 'Nature' | 'Slow living'

type Destination = PlaceGuideData & { category: Exclude<Category, 'All'> }

type ItineraryDay = {
  day: number
  date: string
  place: string
  morning: string
  afternoon: string
  evening: string
}

type SavedTrip = {
  destinationNames: string[]
  routeDestinations?: Destination[]
  days: number
  travelers: number
  budget: string
  transport?: string
  stayStyle?: string
  travelNote?: string
  startDate: string
  endDate: string
  itinerary: ItineraryDay[]
  savedAt: string
}

const storageKey = 'roam-planner-v1'
const destinationPhoto = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=85`
const fallbackTravelImage = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1400&q=85'
type CuratedPlaceSeed = Omit<Destination, 'image' | 'gallery'> & { imageId: string; galleryIds: string[] }

function curatedPlace({ imageId, galleryIds, ...place }: CuratedPlaceSeed): Destination {
  const image = destinationPhoto(imageId)
  return { ...place, image, gallery: [image, ...galleryIds.map(destinationPhoto)] }
}

const foreignSeedBase: Destination[] = [
  {
    id: 'kyoto',
    city: 'Kyoto',
    country: 'Japan',
    region: 'East Asia',
    category: 'Culture',
    image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=85',
    note: 'Temple paths & tea houses',
    from: '7 days feels right',
    moments: ['Walk the moss gardens before the gates open', 'A long lunch in a tiny soba shop', 'Take the quieter path up Fushimi Inari'],
    location: 'Kyoto, Kyoto Prefecture, Japan',
    coordinates: { lat: 35.0116, lon: 135.7681 },
    overview: 'A former imperial capital made for wandering: temple lanes, garden paths, neighborhood kitchens, and quiet corners tucked behind busy streets.',
    bestTime: 'Spring · autumn',
    language: 'Japanese',
    currency: 'Japanese yen (JPY)',
    gallery: ['photo-1528360983277-13d401cdc186', 'photo-1478436127897-769e1b3f0f36', 'photo-1503899036084-c55cdd92da26'].map(destinationPhoto),
    highlights: [
      { name: 'Fushimi Inari Taisha', area: 'Fushimi', kind: 'Shrine & hillside walk', description: 'Follow the long paths beneath rows of vermilion torii gates; turn around whenever the walk feels right.', time: '2–3 hours' },
      { name: 'Kiyomizu-dera', area: 'Higashiyama', kind: 'Temple & city view', description: 'See the celebrated wooden veranda and the rooftops spread across Kyoto below.', time: '1–2 hours' },
      { name: 'Gion lanes', area: 'Eastern Kyoto', kind: 'Historic neighborhood', description: 'Wander traditional streets, small shops, and tea-house lanes at a considerate pace.', time: 'An easy afternoon' },
    ],
    localTip: 'Visit popular temple paths early, and keep quieter residential streets peaceful for the people who live there.',
    officialGuide: 'https://kyoto.travel/en/',
    gettingAround: 'Use trains and subways for longer hops, then walk smaller neighborhoods. Group sights by area to avoid crossing the city repeatedly.',
    whereToStay: 'Downtown is handy for food and evenings; Kyoto Station is practical for rail connections and day trips.',
    localFlavours: ['Yudofu tofu', 'Yuba', 'Soba noodles', 'Matcha sweets'],
    nearbyEscapes: ['Uji tea town', 'Nara’s temples and park'],
    planningNotes: ['Some Gion streets and sacred sites restrict photography; follow posted signs.', 'Temple and neighborhood etiquette matters—keep voices low and stay out of private lanes.', 'Popular sites are calmer early in the day; check opening and transit schedules before you go.'],
  },
  {
    id: 'amalfi',
    city: 'Amalfi Coast',
    country: 'Italy',
    region: 'Southern Europe',
    category: 'Coast',
    image: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=1200&q=85',
    note: 'Cliffside villages & sea air',
    from: '5 days feels right',
    moments: ['A slow ferry between the little towns', 'Swim below the cliffs after lunch', 'Dinner on a terrace as the light fades'],
    location: 'Amalfi, Campania, Italy',
    coordinates: { lat: 40.634, lon: 14.6027 },
    overview: 'A coastline of steep lanes, lemon groves, sea-facing villages, and long lunches. Pick a small base and let ferries and footpaths shape the days.',
    bestTime: 'Late spring · early autumn',
    language: 'Italian',
    currency: 'Euro (EUR)',
    gallery: ['photo-1533587851505-d119e13fa0d7', 'photo-1515859005217-8a1f08870f59', 'photo-1500375592092-40eb2168fd21'].map(destinationPhoto),
    highlights: [
      { name: 'Amalfi Cathedral', area: 'Amalfi town', kind: 'Historic landmark', description: 'Step into the cathedral complex above the lively Piazza Duomo and take in its layered history.', time: '1–2 hours' },
      { name: 'Valle delle Ferriere', area: 'Above Amalfi', kind: 'Nature trail', description: 'A green valley reached by walking paths, with waterfalls and a quieter side of the coast.', time: 'Half day' },
      { name: 'The coastal villages', area: 'Amalfi Coast', kind: 'Seaside wandering', description: 'Join towns by local ferry when available, then leave time for a swim, a viewpoint, or a long meal.', time: 'A full day' },
    ],
    localTip: 'The roads are narrow and steep. Use ferries or local buses where practical, and check seasonal services before setting off.',
    officialGuide: 'https://www.visitamalfi.info/en/',
    gettingAround: 'The historic center is largely pedestrian. Ferries connect coast towns in season; local buses and walking paths cover many inland routes.',
    whereToStay: 'Amalfi works well for central connections; Positano is scenic and steep, while Ravello sits above the coast. Choose one base to reduce luggage transfers.',
    localFlavours: ['Scialatielli with seafood', 'Delizia al limone', 'Limoncello', 'Sfogliatella Santa Rosa'],
    nearbyEscapes: ['Ravello gardens and viewpoints', 'Valle delle Ferriere trail', 'Coastal villages by ferry'],
    planningNotes: ['Check ferry and bus schedules close to travel dates; routes and frequency vary by season.', 'Expect stairs, steep lanes, and uneven surfaces in many towns.', 'For hikes, bring grippy shoes and water; confirm trail conditions locally.'],
  },
  {
    id: 'lisbon',
    city: 'Lisbon',
    country: 'Portugal',
    region: 'Southern Europe',
    category: 'Slow living',
    image: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=1200&q=85',
    note: 'Old trams & late dinners',
    from: '4 days feels right',
    moments: ['Coffee and a warm pastel de nata', 'Browse the small shops in Alfama', 'Catch the last light from a hilltop miradouro'],
    location: 'Lisbon, Portugal',
    coordinates: { lat: 38.7223, lon: -9.1393 },
    overview: 'Portugal’s capital rewards slow uphill walks: tiled facades, old neighborhoods, viewpoints above the river, and an easy evening café culture.',
    bestTime: 'Spring · early autumn',
    language: 'Portuguese',
    currency: 'Euro (EUR)',
    gallery: ['photo-1555881400-89b8dc2bf8f4', 'photo-1506377585622-bedcbb027afc', 'photo-1555881400-74d7acaacd8b'].map(destinationPhoto),
    highlights: [
      { name: 'Alfama', area: 'Old Lisbon', kind: 'Historic neighborhood', description: 'Follow a maze of lanes and stairways, pausing at small squares and river-facing viewpoints.', time: 'Half day' },
      { name: 'Belém Tower', area: 'Belém', kind: 'Riverside landmark', description: 'Visit the historic tower beside the Tagus and enjoy the open waterfront paths nearby.', time: '1–2 hours' },
      { name: 'Jerónimos Monastery', area: 'Belém', kind: 'Architecture & history', description: 'Make time for the monumental monastery and the surrounding gardens and museums.', time: '2–3 hours' },
    ],
    localTip: 'Lisbon is hilly and its historic pavements can be uneven. Wear comfortable shoes and leave extra time between neighborhoods.',
    officialGuide: 'https://www.visitportugal.com/en/content/discovering-lisbon',
    gettingAround: 'Combine walking with historic trams, metro, and the city’s hillside lifts. Use transit for the riverside trip to Belém and leave time for queues.',
    whereToStay: 'Baixa and Chiado are central for first visits; Alfama is atmospheric but steep, and Bairro Alto is lively at night.',
    localFlavours: ['Pastéis de Belém', 'Grilled sardines', 'Bacalhau dishes', 'Ginjinha cherry liqueur'],
    nearbyEscapes: ['Sintra palaces and gardens', 'Cascais and the Atlantic coast'],
    planningNotes: ['Bring shoes with grip for steep, tiled pavements.', 'Trams can be crowded; keep valuables close and check routes before boarding.', 'Reserve extra time for Belém and other popular sights, especially on weekends.'],
  },
  {
    id: 'bali',
    city: 'Ubud',
    country: 'Bali, Indonesia',
    region: 'Southeast Asia',
    category: 'Nature',
    image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=85',
    note: 'Green mornings & open skies',
    from: '6 days feels right',
    moments: ['An early walk through the rice terraces', 'Lunch under the palms in town', 'An unhurried afternoon by the water'],
    location: 'Ubud, Gianyar Regency, Bali, Indonesia',
    coordinates: { lat: -8.5069, lon: 115.2625 },
    overview: 'An inland Bali base for green rice terraces, craft studios, temples, and restorative time. Explore early, then slow down through the warm afternoon.',
    bestTime: 'Dry season · early mornings',
    language: 'Indonesian · Balinese',
    currency: 'Indonesian rupiah (IDR)',
    gallery: ['photo-1518548419970-58e3b4079ab2', 'photo-1516483638261-f4dbaf036963', 'photo-1537996194471-e657df975ab4'].map(destinationPhoto),
    highlights: [
      { name: 'Tegallalang Rice Terraces', area: 'North of Ubud', kind: 'Landscape & walking', description: 'Walk among the layered green fields and learn about the traditional subak irrigation landscape.', time: '2–3 hours' },
      { name: 'Sacred Monkey Forest Sanctuary', area: 'Central Ubud', kind: 'Forest & temple', description: 'Explore a shaded forest sanctuary with temple structures and winding paths.', time: '1–2 hours' },
      { name: 'Ubud town', area: 'Central Ubud', kind: 'Markets & craft', description: 'Browse local art, small shops, and cafés between visits to nearby villages and temples.', time: 'An easy afternoon' },
    ],
    localTip: 'Be respectful at temples and follow posted guidance around wildlife. Arrange a driver or local transport for outlying spots.',
    officialGuide: 'https://www.indonesia.travel/id/en/destination/bali-nusa-tenggara/bali/ubud/',
    gettingAround: 'Central Ubud is walkable in short stretches; rice terraces, waterfalls, and other outlying sites are easier with a local driver or arranged transfer.',
    whereToStay: 'Stay near central Ubud for cafés and markets, or choose a quieter village edge for rice-field views and arrange transport in advance.',
    localFlavours: ['Nasi campur Bali', 'Sate lilit', 'Babi guling', 'Balinese coffee'],
    nearbyEscapes: ['Campuhan walking path', 'Kanto Lampo Waterfall', 'Nearby artisan villages'],
    planningNotes: ['Carry small valuables securely around the monkeys and do not feed or touch wildlife.', 'Wear a sarong or follow local dress guidance at temples.', 'Tropical showers can change plans quickly; carry a light rain layer.'],
  },
  {
    id: 'marrakech',
    city: 'Marrakech',
    country: 'Morocco',
    region: 'North Africa',
    category: 'Culture',
    image: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?auto=format&fit=crop&w=1200&q=85',
    note: 'Courtyards & spice souks',
    from: '4 days feels right',
    moments: ['Start with mint tea in a courtyard', 'Follow the color through the souks', 'Find a rooftop for the evening call to prayer'],
    location: 'Marrakech, Marrakech-Safi, Morocco',
    coordinates: { lat: 31.6295, lon: -7.9811 },
    overview: 'A vivid city of gardens, tiled courtyards, market lanes, and rooftop views. Make space for a guided history walk and calm breaks between the bustle.',
    bestTime: 'Spring · autumn',
    language: 'Arabic · Amazigh · French',
    currency: 'Moroccan dirham (MAD)',
    gallery: ['photo-1489749798305-4fea3ae63d43', 'photo-1539020140153-e479b8c22e70', 'photo-1518005020951-eccb494ad742'].map(destinationPhoto),
    highlights: [
      { name: 'Jemaa el-Fna', area: 'Medina', kind: 'Square & culture', description: 'Experience the central square as it changes through the day, with food stalls and cultural performances.', time: 'Late afternoon into evening' },
      { name: 'Koutoubia Mosque gardens', area: 'Medina edge', kind: 'Landmark & gardens', description: 'See Marrakech’s best-known minaret from the surrounding public gardens and paths.', time: '45–60 minutes' },
      { name: 'The souks', area: 'Old Medina', kind: 'Markets & crafts', description: 'Browse the covered market lanes for textiles, metalwork, spices, and everyday local life.', time: '2–3 hours' },
    ],
    localTip: 'Agree on prices before services or guided tours, and ask before photographing people in the market.',
    officialGuide: 'https://www.visitmorocco.com/en/travel/marrakech/medina',
    gettingAround: 'Explore the medina on foot and use taxis for longer cross-town trips. Confirm the fare or meter before you set off.',
    whereToStay: 'A riad inside or beside the medina keeps you near historic sights; Guéliz offers a more modern city base.',
    localFlavours: ['Tanjia marrakchia', 'Tagine', 'Couscous', 'Mint tea'],
    nearbyEscapes: ['Atlas Mountain foothills', 'Ourika Valley', 'Ouzoud Waterfalls'],
    planningNotes: ['Medina lanes can be confusing; save your lodging location and arrange a first arrival pickup.', 'Ask before photographing people, and agree on prices before shopping or hiring a guide.', 'For mountain or waterfall excursions, use a reputable operator and check conditions for the day.'],
  },
  {
    id: 'dolomites',
    city: 'The Dolomites',
    country: 'Italy',
    region: 'Northern Europe',
    category: 'Nature',
    image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=85',
    note: 'Alpine trails & quiet cabins',
    from: '5 days feels right',
    moments: ['A gentle trail before the day warms up', 'Polenta and mountain cheese at a rifugio', 'Watch the peaks turn pink at dusk'],
    location: 'Val Gardena, South Tyrol, Italian Dolomites',
    coordinates: { lat: 46.5975, lon: 11.7306 },
    overview: 'A mountain landscape of pale limestone peaks, flower-filled meadows, and well-marked trails. Choose routes to match the weather and your walking experience.',
    bestTime: 'Summer · early autumn',
    language: 'Italian · German · Ladin',
    currency: 'Euro (EUR)',
    gallery: ['photo-1472396961693-142e6e269027', 'photo-1519681393784-d120267933ba', 'photo-1464822759023-fed622ff2c3b'].map(destinationPhoto),
    highlights: [
      { name: 'Seceda ridgeline', area: 'Val Gardena', kind: 'Mountain panorama', description: 'Take in the dramatic ridge and alpine meadows, with walking routes across the high plateau.', time: 'Half day or more' },
      { name: 'Ortisei', area: 'Val Gardena', kind: 'Mountain village', description: 'Use the village as a base for cafés, local woodcarving, and lifts into the surrounding mountains.', time: 'A relaxed afternoon' },
      { name: 'Alpine rifugios', area: 'High trails', kind: 'Mountain hut', description: 'Pause for a warm meal at a mountain hut along your chosen route; check access and opening dates first.', time: 'Plan into your hike' },
    ],
    localTip: 'Lift schedules, trail access, and mountain weather change by season. Check the local trail report before each hike.',
    officialGuide: 'https://www.valgardena.it/en/summer-holidays-dolomites/trekking/seceda/',
    gettingAround: 'Val Gardena has a local bus network between Ortisei, Santa Cristina, and Selva; lifts and routes vary by season. Check the current timetable.',
    whereToStay: 'Ortisei is handy for Seceda and village services; Santa Cristina and Selva put you closer to other valley trails and lifts.',
    localFlavours: ['Canederli dumplings', 'Speck and local cheeses', 'Ladin farm dishes', 'Strudel and homemade cakes'],
    nearbyEscapes: ['Alpe di Siusi', 'Santa Cristina village', 'Sella Pass viewpoints'],
    planningNotes: ['Mountain weather can change quickly; check forecasts and trail reports on the day.', 'Pack layers, water, and sturdy shoes with grip, even for a short walk.', 'Lifts, buses, trails, and mountain huts have seasonal schedules—confirm before setting out.'],
  },
]

const foreignAdditions: Destination[] = [
  curatedPlace({
    id: 'tokyo', city: 'Tokyo', country: 'Japan', region: 'East Asia · Kantō', category: 'Culture', imageId: 'photo-1540959733332-eab4deabeeaf',
    galleryIds: ['photo-1513407030348-c983a97b98d8', 'photo-1519608487953-e999c86e7455', 'photo-1536098561742-ca998e48cbcc'],
    note: 'Neighborhoods, night lights & tiny kitchens', from: '4–6 days feels right',
    moments: ['Start with a quiet shrine garden', 'Pick one neighborhood to explore slowly', 'Ride the train to a small local dinner spot'],
    location: 'Tokyo, Japan', coordinates: { lat: 35.6762, lon: 139.6503 },
    overview: 'A huge, easy-to-navigate city made of distinct neighborhoods: old temple streets, design districts, food alleys, and peaceful gardens. Plan by area and let the rail network do the rest.',
    bestTime: 'Spring · autumn', language: 'Japanese', currency: 'Japanese yen (JPY)',
    highlights: [
      { name: 'Asakusa & Sensō-ji', area: 'Taitō', kind: 'Temple & old-town walk', description: 'Explore the temple grounds and nearby lanes early, before the busiest hours.', time: '2–3 hours' },
      { name: 'Meiji Shrine & Yoyogi Park', area: 'Shibuya', kind: 'Forest shrine & park', description: 'Take a calm walk beneath the trees, following signs and local shrine etiquette.', time: '2 hours' },
      { name: 'Shinjuku evening streets', area: 'Shinjuku', kind: 'Food & city lights', description: 'Choose a small restaurant or guided food walk and check last-train times before staying out late.', time: 'An evening' },
    ],
    localTip: 'Use an IC transit card, keep voices low on trains, and check restaurant booking and cash policies before you go.',
    gettingAround: 'Trains and subway lines are extensive. Group visits by neighborhood and check the final train time for your route.',
    whereToStay: 'Tokyo Station and Ginza are central; Shinjuku is well connected and lively; Ueno is convenient for museums and rail.',
    localFlavours: ['Sushi', 'Ramen', 'Tempura', 'Onigiri'], nearbyEscapes: ['Kamakura', 'Nikkō', 'Yokohama'],
    planningNotes: ['Large stations can be confusing; save your hotel address in Japanese.', 'Popular restaurants may need advance bookings.', 'Cherry-blossom and autumn-color dates vary each year.'],
  }),
  curatedPlace({
    id: 'paris', city: 'Paris', country: 'France', region: 'Western Europe · Île-de-France', category: 'Culture', imageId: 'photo-1502602898657-3e91760cbb34',
    galleryIds: ['photo-1499856871958-5b9627545d1a', 'photo-1505761671935-60b3a7427bad', 'photo-1499856871958-5b9627545d1a'],
    note: 'Museum mornings & long café afternoons', from: '4–6 days feels right',
    moments: ['Walk beside the Seine at first light', 'Choose one museum and linger', 'Find a neighborhood bakery for breakfast'],
    location: 'Paris, Île-de-France, France', coordinates: { lat: 48.8566, lon: 2.3522 },
    overview: 'A walkable city of grand museums, river paths, neighborhood markets, and intimate cafés. Leave generous time between sights and explore one district at a time.',
    bestTime: 'Spring · early autumn', language: 'French', currency: 'Euro (EUR)',
    highlights: [
      { name: 'The Louvre & Tuileries', area: '1st arrondissement', kind: 'Museum & garden', description: 'Reserve museum entry in advance and choose a few galleries rather than trying to see everything.', time: 'Half day' },
      { name: 'Île de la Cité', area: 'Seine', kind: 'Historic island walk', description: 'Walk the river edges and check official notices for cathedral and monument access.', time: '2–3 hours' },
      { name: 'Montmartre lanes', area: '18th arrondissement', kind: 'Hilltop neighborhood', description: 'Explore the quieter side streets, taking care around steep steps and busy viewpoints.', time: 'Half day' },
    ],
    localTip: 'Many museums close one day a week. Check each venue’s current hours and use the official transit app for disruptions.',
    gettingAround: 'Use the Metro for longer hops, then walk. Validate tickets and check current fare rules before boarding.',
    whereToStay: 'Choose a base near a Metro line; the Marais, Latin Quarter, and Saint-Germain are popular for first visits.',
    localFlavours: ['Croissant', 'Baguette sandwich', 'Crêpes', 'Seasonal bistro dishes'], nearbyEscapes: ['Versailles', 'Giverny', 'Fontainebleau'],
    planningNotes: ['Reserve timed entries for major museums and monuments.', 'Keep belongings secure in crowded transit and tourist areas.', 'Walkways and station access can include stairs; check step-free options if needed.'],
  }),
  curatedPlace({
    id: 'rome', city: 'Rome', country: 'Italy', region: 'Southern Europe · Lazio', category: 'Culture', imageId: 'photo-1552832230-c0197dd311b5',
    galleryIds: ['photo-1525874684015-58379d421a52', 'photo-1515542622106-78bda8ba0e5b', 'photo-1531572753322-ad063cecc140'],
    note: 'Ancient streets, piazzas & slow suppers', from: '3–5 days feels right',
    moments: ['Walk the Forum before the midday heat', 'Pause for an espresso at the counter', 'Choose a small trattoria away from the busiest square'],
    location: 'Rome, Lazio, Italy', coordinates: { lat: 41.9028, lon: 12.4964 },
    overview: 'An open-air history walk through layered ruins, neighborhood piazzas, churches, and food traditions. The best days leave space for shade, water, and unplanned stops.',
    bestTime: 'Spring · autumn', language: 'Italian', currency: 'Euro (EUR)',
    highlights: [
      { name: 'Colosseum & Roman Forum', area: 'Monti', kind: 'Archaeology & history', description: 'Book official timed tickets and wear shoes with grip for uneven ancient paving.', time: 'Half day' },
      { name: 'Pantheon & Piazza Navona', area: 'Historic center', kind: 'Landmarks & piazzas', description: 'Visit the monument respectfully, then wander the surrounding lanes and public squares.', time: '2–3 hours' },
      { name: 'Trastevere evening', area: 'Across the Tiber', kind: 'Neighborhood & food', description: 'Walk the narrow streets and reserve a table if you have a particular restaurant in mind.', time: 'An evening' },
    ],
    localTip: 'Carry water and plan indoor breaks in hot weather; check entry rules and dress guidance for churches.',
    gettingAround: 'The center is best explored on foot. Metro, buses, and trams help with longer connections; verify tickets before travel.',
    whereToStay: 'Monti is practical for ancient sites; Centro Storico is central; Trastevere is lively after dark.',
    localFlavours: ['Cacio e pepe', 'Carbonara', 'Supplì', 'Artichokes in season'], nearbyEscapes: ['Ostia Antica', 'Tivoli villas', 'Castelli Romani'],
    planningNotes: ['Major sights require timed entry in busy seasons.', 'Cobblestones are uneven; wear supportive footwear.', 'Churches may have dress requirements and photography restrictions.'],
  }),
  curatedPlace({
    id: 'new-york', city: 'New York City', country: 'United States', region: 'North America · New York', category: 'Culture', imageId: 'photo-1496442226666-8d4d0e62e6e9',
    galleryIds: ['photo-1518391846015-55a9cc003b25', 'photo-1534430480872-3498386e7856', 'photo-1500916434205-0c77489c6cf7'],
    note: 'City blocks, museums & neighborhood food', from: '4–7 days feels right',
    moments: ['Walk one stretch of the High Line', 'Pick a museum for an unhurried morning', 'Explore a neighborhood beyond Manhattan'],
    location: 'New York City, New York, United States', coordinates: { lat: 40.7128, lon: -74.006 },
    overview: 'A collection of neighborhoods linked by a fast transit network, with major museums, waterfront walks, food from everywhere, and a constantly changing street life.',
    bestTime: 'Spring · autumn', language: 'English', currency: 'US dollar (USD)',
    highlights: [
      { name: 'Central Park', area: 'Manhattan', kind: 'Urban park walk', description: 'Choose a short loop, check park notices, and bring water for longer walks.', time: '2–4 hours' },
      { name: 'The Metropolitan Museum of Art', area: 'Upper East Side', kind: 'Art museum', description: 'Plan a few galleries and check current ticket and opening information directly with the museum.', time: 'Half day' },
      { name: 'Brooklyn waterfront', area: 'Brooklyn', kind: 'Neighborhood & skyline views', description: 'Walk between DUMBO and Brooklyn Bridge Park, then use transit rather than rushing back across town.', time: 'An afternoon' },
    ],
    localTip: 'Use contactless payment or a transit card, check subway service changes, and allow extra time for security lines.',
    gettingAround: 'Subway and buses are practical for most trips. Walking distances between attractions can be longer than they look on a map.',
    whereToStay: 'Choose a base near a subway station; Midtown is central, while Brooklyn and Queens offer different neighborhood rhythms.',
    localFlavours: ['Bagels', 'Pizza by the slice', 'Deli sandwiches', 'Neighborhood cuisines'], nearbyEscapes: ['Coney Island', 'Governors Island', 'Hudson Valley'],
    planningNotes: ['Check official museum hours and ticket policies.', 'Keep valuables secure in crowded stations.', 'Taxis and rideshares can be slow in traffic; use transit for cross-city trips.'],
  }),
  curatedPlace({
    id: 'cape-town', city: 'Cape Town', country: 'South Africa', region: 'Southern Africa · Western Cape', category: 'Nature', imageId: 'photo-1580060839134-75a5edca2e99',
    galleryIds: ['photo-1508184964240-ee96bb9677a7', 'photo-1532581291347-9c39cf10a73c', 'photo-1501594907352-04cda38ebc29'],
    note: 'Mountain paths, ocean air & coastal roads', from: '5–7 days feels right',
    moments: ['Check the mountain forecast before a hike', 'Take a slow drive along the peninsula', 'Save sunset for a public viewpoint'],
    location: 'Cape Town, Western Cape, South Africa', coordinates: { lat: -33.9249, lon: 18.4241 },
    overview: 'A dramatic meeting of mountain and sea, with city neighborhoods, beaches, botanical gardens, and day drives. Weather and access can change quickly around the mountain.',
    bestTime: 'Late spring · early autumn', language: 'English · Afrikaans · isiXhosa', currency: 'South African rand (ZAR)',
    highlights: [
      { name: 'Table Mountain', area: 'Table Mountain National Park', kind: 'Hike or cableway', description: 'Check the official park and cableway status, weather, and route difficulty before going up.', time: 'Half day' },
      { name: 'Kirstenbosch Garden', area: 'Newlands', kind: 'Botanical garden', description: 'Explore the garden paths and mountain-facing lawns; check seasonal event schedules.', time: '2–4 hours' },
      { name: 'Cape Peninsula route', area: 'South of the city', kind: 'Coastal road trip', description: 'Plan a full day with safe, authorized stops and confirm park entry and road conditions.', time: 'Full day' },
    ],
    localTip: 'Do not hike alone or after dark; check local safety advice, weather, and park access on the day.',
    gettingAround: 'Use a reputable rental or arranged transfer for the peninsula; city buses and rideshares serve many central areas.',
    whereToStay: 'The City Bowl is central; Sea Point is coastal and walkable; choose lodging with secure transport arrangements.',
    localFlavours: ['Cape Malay curry', 'Braai', 'Fresh seafood', 'Koeksisters'], nearbyEscapes: ['Stellenbosch', 'Boulders Beach', 'Cape Point'],
    planningNotes: ['Mountain weather can turn quickly; carry layers and water.', 'Follow local safety guidance and avoid isolated areas after dark.', 'Check park and beach notices before travel.'],
  }),
  curatedPlace({
    id: 'reykjavik', city: 'Reykjavík', country: 'Iceland', region: 'Northern Europe · Capital Region', category: 'Nature', imageId: 'photo-1504829857797-ddff29c27927',
    galleryIds: ['photo-1531366936337-7c912a4589a7', 'photo-1476610182048-b716b8518aae', 'photo-1464278533981-50106e6176b1'],
    note: 'Hot pools, harbor walks & wild day trips', from: '3–5 days feels right',
    moments: ['Start with the harbor and old town', 'Soak at a local geothermal pool', 'Keep a flexible day for changing weather'],
    location: 'Reykjavík, Capital Region, Iceland', coordinates: { lat: 64.1466, lon: -21.9426 },
    overview: 'A compact capital for design, food, geothermal bathing, and access to Iceland’s landscapes. Keep road plans flexible: wind, snow, and daylight affect journeys in every season.',
    bestTime: 'Summer for long days · winter for aurora chances', language: 'Icelandic · English', currency: 'Icelandic króna (ISK)',
    highlights: [
      { name: 'Old harbor & waterfront', area: 'Downtown', kind: 'Harbor walk', description: 'Follow the waterfront path between the harbor, Harpa, and the Sun Voyager sculpture.', time: '1–2 hours' },
      { name: 'Hallgrímskirkja', area: 'Skólavörðuholt', kind: 'Landmark & city view', description: 'Check visiting hours and lift access, and be considerate during services.', time: '1 hour' },
      { name: 'Geothermal bathing', area: 'City pools', kind: 'Local wellness', description: 'Choose a public pool and follow the posted shower and pool etiquette.', time: '2 hours' },
    ],
    localTip: 'Check Icelandic road and weather alerts before every drive. Do not stop on road shoulders for photos.',
    gettingAround: 'The center is walkable; use local buses in town and reputable tours or a properly equipped rental for day trips.',
    whereToStay: 'Stay downtown for dining and walking, or near a bus corridor for easier airport and excursion connections.',
    localFlavours: ['Skyr', 'Lamb soup', 'Fresh fish', 'Rye bread'], nearbyEscapes: ['Golden Circle', 'Reykjanes Peninsula', 'South Coast'],
    planningNotes: ['Daylight hours vary widely by season.', 'Road and trail conditions can change in hours.', 'Book popular geothermal baths and tours ahead when needed.'],
  }),
  curatedPlace({
    id: 'cusco', city: 'Cusco & Sacred Valley', country: 'Peru', region: 'South America · Andes', category: 'Trek & trails', imageId: 'photo-1526392060635-9d6019884377',
    galleryIds: ['photo-1587595431973-160d0d94add1', 'photo-1526392060635-9d6019884377', 'photo-1516026672322-bc52d61a55d5'],
    note: 'Andean history, market towns & mountain trails', from: '5–8 days feels right',
    moments: ['Arrive slowly and allow time to adjust to altitude', 'Explore one Sacred Valley town at a time', 'Reserve official entry before visiting Machu Picchu'],
    location: 'Cusco, Cusco Region, Peru', coordinates: { lat: -13.5319, lon: -71.9675 },
    overview: 'A high-altitude city and gateway to Inca sites, Andean markets, and the Sacred Valley. Build in acclimatization time and plan permits and transport before committing to a trek.',
    bestTime: 'Drier months · check local trail conditions', language: 'Spanish · Quechua', currency: 'Peruvian sol (PEN)',
    highlights: [
      { name: 'Cusco historic center', area: 'Cusco', kind: 'Architecture & walking', description: 'Explore plazas and stone lanes at an easy pace while adjusting to the altitude.', time: 'Half day' },
      { name: 'Sacred Valley towns', area: 'Urubamba Valley', kind: 'Culture & day trip', description: 'Choose a small number of villages and archaeological sites, and arrange reliable transport.', time: 'Full day' },
      { name: 'Machu Picchu', area: 'Aguas Calientes', kind: 'Archaeological site', description: 'Buy official timed entry and train tickets in advance; follow the assigned circuit and site rules.', time: 'Full day' },
    ],
    localTip: 'Altitude can affect health. Acclimatize, hydrate, and seek medical guidance if symptoms are severe or worsening.',
    gettingAround: 'Walk the historic center; use registered taxis and planned train or shuttle connections for valley and Machu Picchu trips.',
    whereToStay: 'Stay centrally in Cusco first, then consider a Sacred Valley base to reduce travel time and altitude exposure.',
    localFlavours: ['Cuy (guinea pig)', 'Lomo saltado', 'Choclo with cheese', 'Quinoa soup'], nearbyEscapes: ['Ollantaytambo', 'Pisac', 'Maras salt ponds'],
    planningNotes: ['Allow acclimatization days before strenuous activity.', 'Check entry permits, train schedules, and current site rules.', 'Use a registered guide for remote treks and check weather locally.'],
  }),
  curatedPlace({
    id: 'petra', city: 'Petra & Wadi Musa', country: 'Jordan', region: 'West Asia · Ma’an Governorate', category: 'Culture', imageId: 'photo-1548786817-dd6e453ccca7',
    galleryIds: ['photo-1580837119756-563d608dd119', 'photo-1603565816030-6b389eeb23cb', 'photo-1548786817-dd6e453ccca7'],
    note: 'Rose-colored stone, desert trails & ancient routes', from: '2–3 days feels right',
    moments: ['Enter early and walk the Siq at an unhurried pace', 'Carry water for the long archaeological paths', 'Leave a second day for quieter monuments'],
    location: 'Petra, Ma’an Governorate, Jordan', coordinates: { lat: 30.3285, lon: 35.4444 },
    overview: 'A vast archaeological landscape reached through a narrow sandstone passage, with tombs, temples, and trails across the surrounding hills. It is a full-day walk over uneven terrain.',
    bestTime: 'Spring · autumn', language: 'Arabic · English', currency: 'Jordanian dinar (JOD)',
    highlights: [
      { name: 'The Siq & Treasury', area: 'Petra Archaeological Park', kind: 'Monument & walk', description: 'Arrive early, stay on marked paths, and allow time for the long approach from the visitor center.', time: '2–3 hours' },
      { name: 'The Monastery trail', area: 'Petra hills', kind: 'Stone stairway & viewpoint', description: 'The climb is steep and exposed; take breaks, carry water, and turn back if conditions feel unsafe.', time: 'Half day' },
      { name: 'Little Petra', area: 'Beidha', kind: 'Archaeological site', description: 'Visit the smaller site with a local guide and check access and transport arrangements.', time: '1–2 hours' },
    ],
    localTip: 'Use official tickets and guides, respect site boundaries, and do not ride animals if their welfare appears poor.',
    gettingAround: 'Petra is explored on foot; use licensed local transport between Wadi Musa, Petra, and nearby sites.',
    whereToStay: 'Wadi Musa has the widest choice of stays and is close to the visitor entrance.',
    localFlavours: ['Mansaf', 'Maqluba', 'Bedouin tea', 'Fresh flatbread'], nearbyEscapes: ['Wadi Rum', 'Dana Biosphere Reserve', 'Aqaba'],
    planningNotes: ['Expect many kilometers of walking on uneven ground.', 'Carry sun protection and water; shade is limited.', 'Check current park hours and local travel advisories.'],
  }),
]

const foreignPhotoAdditions: Record<string, string[]> = {
  kyoto: ['photo-1493976040374-85c8e12f0c0e', 'photo-1492571350019-22de08371fd3'],
  amalfi: ['photo-1516483638261-f4dbaf036963', 'photo-1533105079780-92b9be482077'],
  lisbon: ['photo-1555881400-89b8dc2bf8f4', 'photo-1555881400-74d7acaacd8b'],
  bali: ['photo-1530789253388-582c481c54b0', 'photo-1518548419970-58e3b4079ab2'],
  marrakech: ['photo-1489749798305-4fea3ae63d43', 'photo-1518005020951-eccb494ad742'],
  dolomites: ['photo-1464822759023-fed622ff2c3b', 'photo-1472396961693-142e6e269027'],
}

const foreignSeed: Destination[] = [
  ...foreignSeedBase.map((destination) => ({
    ...destination,
    gallery: [...new Set([...(destination.gallery ?? [destination.image]), ...(foreignPhotoAdditions[destination.id] ?? []).map(destinationPhoto)])],
  })),
  ...foreignAdditions,
]

const indiaSeedBase: Destination[] = [
  {
    id: 'darjeeling', city: 'Darjeeling', country: 'India', region: 'West Bengal · Eastern Himalaya', category: 'Drive & rail',
    image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=85', note: 'Toy trains, tea gardens & mountain air', from: '3–5 days feels right',
    moments: ['Ride the Darjeeling Himalayan Railway', 'Walk through a tea garden', 'Watch the light change over the Kanchenjunga range'], location: 'Darjeeling, West Bengal, India', coordinates: { lat: 27.041, lon: 88.2663 },
    overview: 'A hill town of tea estates, Himalayan views, old lanes, and a narrow-gauge railway. Build in slow mornings; cloud and mountain weather shape the views.', bestTime: 'Clearer skies often follow the monsoon', language: 'Bengali · Nepali · Hindi', currency: 'Indian rupee (INR)',
    highlights: [
      { name: 'Darjeeling Himalayan Railway', area: 'Darjeeling–Ghum', kind: 'Heritage train ride', description: 'Take a short joy ride or plan a longer rail outing through tea slopes and hill neighborhoods. Check current operations and tickets.', time: 'Half day' },
      { name: 'Batasia Loop', area: 'Ghum', kind: 'Railway viewpoint', description: 'See the railway loop, memorial, and broad views across the hills when the weather is clear.', time: '1 hour' },
      { name: 'Tea estate walk', area: 'Around town', kind: 'Local landscape', description: 'Visit a working tea garden with a local guide and learn how the region’s tea is grown and made.', time: '2–3 hours' },
    ],
    localTip: 'Mountain views depend on the weather. Keep a flexible morning for viewpoints and check toy-train schedules before booking.', officialGuide: 'https://www.incredibleindia.gov.in/en/west-bengal/darjeeling/darjeeling-himalayan-railway',
    gettingAround: 'Walk central lanes, use local taxis for steep or longer connections, and check the railway timetable for the toy train.', whereToStay: 'Choose a central base near Chowrasta for walks and cafés, or stay near Ghum for a quieter hill setting.', localFlavours: ['Momos', 'Thukpa', 'Darjeeling tea', 'Local bakery snacks'], nearbyEscapes: ['Kurseong', 'Mirik', 'Ghoom monastery'],
    planningNotes: ['The hill road can be slow; leave buffer time for transfers.', 'Bring warm layers and rain protection in every season.', 'The toy train is popular and schedules can change; confirm with the official railway before travel.'],
  },
  {
    id: 'shimla', city: 'Shimla', country: 'India', region: 'Himachal Pradesh · Western Himalaya', category: 'Drive & rail',
    image: 'https://images.unsplash.com/photo-1597074866923-dc0589150358?auto=format&fit=crop&w=1200&q=85', note: 'Mountain railways & pine walks', from: '3–4 days feels right',
    moments: ['Take the Kalka–Shimla toy train', 'Walk the Ridge and Mall Road', 'Find a quiet pine trail above town'], location: 'Shimla, Himachal Pradesh, India', coordinates: { lat: 31.1048, lon: 77.1734 },
    overview: 'A Himalayan hill town with a heritage rail approach, wooded walks, and a lively central ridge. Pair the town with nearby villages for an easier pace.', bestTime: 'Spring · autumn', language: 'Hindi · Pahari · English', currency: 'Indian rupee (INR)',
    highlights: [
      { name: 'Kalka–Shimla Railway', area: 'Kalka to Shimla', kind: 'Mountain train ride', description: 'Ride the narrow-gauge railway through tunnels, bridges, and hillside stations; check the latest timetable and seat availability.', time: 'A scenic rail day' },
      { name: 'The Ridge', area: 'Central Shimla', kind: 'Town walk', description: 'Explore the open promenade, historic landmarks, cafés, and views across the surrounding hills.', time: 'A relaxed afternoon' },
      { name: 'Jakhu Hill', area: 'Above the Ridge', kind: 'Forest walk & viewpoint', description: 'Take a walk or local transport uphill; check access and weather before setting out.', time: '2–3 hours' },
    ], localTip: 'The center is steep and often busy. Use comfortable shoes, and plan the toy train well ahead during holidays.',
    officialGuide: 'https://www.incredibleindia.gov.in/en/himachal-pradesh/shimla/shimla-a-quick-and-handy-travel-guide',
    gettingAround: 'Walk the pedestrian center, use local taxis for outer neighborhoods, and use the railway for the classic approach from Kalka.', whereToStay: 'Stay near the Ridge for walkability, or choose a quieter hillside hotel and arrange local transport.', localFlavours: ['Siddu', 'Chana madra', 'Dham thali', 'Apple desserts'], nearbyEscapes: ['Kufri', 'Mashobra', 'Naldehra'],
    planningNotes: ['Hill roads can be affected by weather and traffic.', 'Book train tickets through official channels and verify schedule changes.', 'Avoid relying on a tight connection between rail and road transfers.'],
  },
  {
    id: 'ladakh', city: 'Leh & Ladakh', country: 'India', region: 'Ladakh · High Himalaya', category: 'Trek & trails',
    image: 'https://images.unsplash.com/photo-1581793745862-99fde7fa73d2?auto=format&fit=crop&w=1200&q=85', note: 'High passes, monasteries & open roads', from: '7–10 days feels right',
    moments: ['Take time to acclimatize in Leh', 'Visit a monastery with local guidance', 'Plan a careful day drive to a high-altitude lake'], location: 'Leh, Ladakh, India', coordinates: { lat: 34.1526, lon: 77.5771 },
    overview: 'A high-altitude region of stark mountains, monasteries, villages, and long road journeys. Plan for altitude, acclimatization, and changing road conditions before adding strenuous activity.', bestTime: 'Summer road season · check current access', language: 'Ladakhi · Hindi · English', currency: 'Indian rupee (INR)',
    highlights: [
      { name: 'Leh old town & palace', area: 'Leh', kind: 'Heritage walk', description: 'Explore the old lanes and palace area at an easy pace while adjusting to the altitude.', time: 'Half day' },
      { name: 'Monastery circuit', area: 'Indus Valley', kind: 'Culture & day drive', description: 'Choose a small number of monasteries with a local driver or guide and check visitor etiquette at each site.', time: 'A full day' },
      { name: 'High-altitude trekking', area: 'Ladakh', kind: 'Guided trek', description: 'Use a licensed local operator, allow acclimatization days, and select a route for your fitness and current conditions.', time: 'Several days' },
    ], localTip: 'Altitude is a serious planning factor. Acclimatize before exertion, seek medical advice if needed, and follow local advisories and permit rules.',
    officialGuide: 'https://www.incredibleindia.gov.in/en/ladakh/leh', gettingAround: 'Distances are long. Arrange a reputable local driver, check road status daily, and do not assume a route is open year-round.', whereToStay: 'Spend your first nights in Leh to acclimatize; choose registered stays in other villages for longer circuits.', localFlavours: ['Skyu', 'Thukpa', 'Momos', 'Butter tea'], nearbyEscapes: ['Alchi', 'Nubra Valley', 'Pangong Tso'],
    planningNotes: ['Do not trek or drive to high passes immediately after arrival.', 'Check permits, road status, weather, and local advisories before every excursion.', 'Carry water, sun protection, and warm layers; services can be far apart.'],
  },
  {
    id: 'manali', city: 'Manali', country: 'India', region: 'Himachal Pradesh · Kullu Valley', category: 'Trek & trails',
    image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1200&q=85', note: 'River valleys, forest trails & mountain drives', from: '4–6 days feels right',
    moments: ['Walk the old Manali lanes', 'Take a guided forest or valley trail', 'Leave a full day for a weather-aware mountain drive'], location: 'Manali, Himachal Pradesh, India', coordinates: { lat: 32.2396, lon: 77.1887 },
    overview: 'A popular base in the Kullu Valley for riverside walks, nearby villages, and high mountain excursions. Treat pass drives and hikes as weather-dependent plans.', bestTime: 'Spring · autumn · verify seasonal routes', language: 'Hindi · Kulluvi · English', currency: 'Indian rupee (INR)',
    highlights: [
      { name: 'Old Manali', area: 'Manali', kind: 'Neighborhood walk', description: 'Wander lanes, cafés, and riverside corners at a slower pace.', time: 'An easy afternoon' },
      { name: 'Solang Valley', area: 'North of Manali', kind: 'Mountain outing', description: 'Choose seasonal activities from reputable local operators and check weather and road access first.', time: 'Half or full day' },
      { name: 'Guided valley trek', area: 'Kullu Himalaya', kind: 'Trek', description: 'Use a local guide, check permits and trail conditions, and choose a route suited to your experience.', time: 'One or more days' },
    ], localTip: 'Do not treat high passes as guaranteed day trips. Check road openings, forecast, and traffic advisories before departure.',
    gettingAround: 'Local taxis and buses link the valley; book a reliable driver for longer trips and confirm return timing.', whereToStay: 'Old Manali is lively and walkable; central Manali is practical for bus and taxi connections.', localFlavours: ['Siddu', 'Trout', 'Dham', 'Himachali chai'], nearbyEscapes: ['Naggar', 'Vashisht', 'Kasol'], planningNotes: ['Mountain weather can change quickly.', 'Choose only operators with suitable equipment and safety practices.', 'Keep buffer time for road delays, especially in peak holiday periods.'],
  },
  {
    id: 'rishikesh', city: 'Rishikesh', country: 'India', region: 'Uttarakhand · Garhwal', category: 'Trek & trails',
    image: 'https://images.unsplash.com/photo-1609947017136-9dabd2c6f4b8?auto=format&fit=crop&w=1200&q=85', note: 'River walks, forest paths & foothill trails', from: '3–5 days feels right',
    moments: ['Walk between the river bridges', 'Join a guided foothill hike', 'Spend an evening by the Ganga respectfully'], location: 'Rishikesh, Uttarakhand, India', coordinates: { lat: 30.0869, lon: 78.2676 },
    overview: 'A Ganga-side town known for yoga, ashrams, river scenery, and access to the Himalayan foothills. Treat river activities as operator- and season-dependent.', bestTime: 'October · April, with seasonal checks', language: 'Hindi · Garhwali · English', currency: 'Indian rupee (INR)',
    highlights: [
      { name: 'Ram Jhula & riverfront', area: 'Rishikesh', kind: 'River walk', description: 'Explore the riverside lanes and bridges on foot, respecting ashram, temple, and bathing-area customs.', time: 'Half day' },
      { name: 'Neer Garh waterfall trail', area: 'Near Rishikesh', kind: 'Short hike', description: 'Check access, water conditions, and local guidance before taking the hillside path.', time: '2–3 hours' },
      { name: 'Ganga rafting', area: 'Seasonal river stretch', kind: 'Guided river activity', description: 'Only book with a permitted operator, use the required safety equipment, and confirm official seasonal closures.', time: 'Half day' },
    ], localTip: 'Use authorized operators for adventure activities and respect local rules around the river and religious sites.',
    gettingAround: 'Walk central areas and use local taxis or shared transport for trailheads and nearby villages.', whereToStay: 'Tapovan is convenient for cafés and yoga; quieter riverside areas suit a slower retreat.', localFlavours: ['Aloo ke gutke', 'Kafuli', 'Local thalis', 'Fresh fruit'], nearbyEscapes: ['Shivpuri', 'Devprayag', 'Rajaji National Park'], planningNotes: ['River activities have seasonal conditions and age or health requirements.', 'Dress modestly at temples and ask before taking photos.', 'Carry water and sun protection on exposed hillside walks.'],
  },
  {
    id: 'munnar', city: 'Munnar', country: 'India', region: 'Kerala · Western Ghats', category: 'Nature',
    image: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1200&q=85', note: 'Tea hills, cool air & winding drives', from: '3–4 days feels right',
    moments: ['Take the winding drive through tea country', 'Visit a tea museum or estate', 'Choose a guided walk in the hills'], location: 'Munnar, Kerala, India', coordinates: { lat: 10.0889, lon: 77.0595 },
    overview: 'A highland town surrounded by tea estates, forest reserves, and winding mountain roads. Slow down for the scenic drive and check local rules before entering protected areas.', bestTime: 'Cooler months · verify monsoon conditions', language: 'Malayalam · Tamil · English', currency: 'Indian rupee (INR)',
    highlights: [
      { name: 'Tea estate landscape', area: 'Munnar', kind: 'Scenic drive & walk', description: 'Pause at permitted viewpoints and learn about tea-making through an estate visit.', time: 'Half day' },
      { name: 'Eravikulam National Park', area: 'Near Munnar', kind: 'Protected nature area', description: 'Check park entry, access, and seasonal closures with the official park authority before visiting.', time: 'Half day' },
      { name: 'Local guided nature walk', area: 'Western Ghats', kind: 'Trek', description: 'Choose a permitted route with a local guide and check weather, leeches, and trail access.', time: '2–4 hours' },
    ], localTip: 'Mountain roads are slow and fog can reduce visibility. Keep drive days short and check park access before setting off.',
    officialGuide: 'https://www.incredibleindia.gov.in/en/kerala/munnar', gettingAround: 'Arrange a local taxi or driver for the spread-out sights; the roads are winding and public connections are limited.', whereToStay: 'Stay near Munnar town for services, or choose a licensed estate-area stay for a quieter landscape.', localFlavours: ['Appam & stew', 'Kerala meals', 'Tea', 'Spiced snacks'], nearbyEscapes: ['Mattupetty Dam', 'Top Station', 'Marayoor'], planningNotes: ['Check park rules and opening status before visiting.', 'Avoid entering tea fields without permission.', 'Carry a light rain layer and comfortable shoes.'],
  },
  {
    id: 'goa', city: 'Goa', country: 'India', region: 'Western coast · Konkan', category: 'Coast',
    image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=85', note: 'Coastal drives, old quarters & long beach days', from: '4–6 days feels right',
    moments: ['Take a slow coastal ride between beaches', 'Explore Panaji’s old quarters', 'Save an afternoon for a local seafood meal'], location: 'Goa, India', coordinates: { lat: 15.2993, lon: 74.124 },
    overview: 'A varied coastal state with beach villages, Portuguese-era quarters, markets, and inland nature. Pick one base and avoid trying to cover both coasts in a day.', bestTime: 'November · March', language: 'Konkani · Marathi · English', currency: 'Indian rupee (INR)',
    highlights: [
      { name: 'Fontainhas', area: 'Panaji', kind: 'Heritage neighborhood', description: 'Walk the colorful lanes at a respectful pace and look for local heritage tours.', time: '2–3 hours' },
      { name: 'Old Goa churches', area: 'Old Goa', kind: 'History & architecture', description: 'Visit the historic church complex and check current opening and visitor guidance.', time: 'Half day' },
      { name: 'Coastal village ride', area: 'North or South Goa', kind: 'Scenic ride', description: 'Choose a route suited to your transport and conditions; wear a helmet and avoid riding after drinking.', time: 'A relaxed day' },
    ], officialGuide: 'https://www.incredibleindia.gov.in/en/goa', localTip: 'Respect beach safety flags, local fishing areas, and wildlife protections. Confirm scooter rental terms and always wear a helmet.',
    gettingAround: 'Taxis, buses, and rentals are available; distances can be longer than they look. Use a designated driver if drinking.', whereToStay: 'North Goa is lively; South Goa is quieter. Panaji works well for heritage and central connections.', localFlavours: ['Goan fish curry', 'Xacuti', 'Bebinca', 'Local cashew sweets'], nearbyEscapes: ['Dudhsagar area', 'Divar Island', 'Spice farms'], planningNotes: ['Check sea conditions and swim only in permitted areas.', 'Ride only with a valid licence, helmet, and appropriate insurance.', 'Monsoon travel changes beach access and road conditions.'],
  },
  {
    id: 'jaipur', city: 'Jaipur', country: 'India', region: 'Rajasthan · Pink City', category: 'Culture',
    image: 'https://images.unsplash.com/photo-1599661046827-dacff0c0f09a?auto=format&fit=crop&w=1200&q=85', note: 'Fort roads, old-city walks & craft markets', from: '3–4 days feels right',
    moments: ['Walk the old city with a local guide', 'Drive up to Amber Fort early', 'Browse block-print and blue-pottery workshops'], location: 'Jaipur, Rajasthan, India', coordinates: { lat: 26.9124, lon: 75.7873 },
    overview: 'Rajasthan’s capital pairs a distinctive planned old city with hilltop forts, craft traditions, and busy bazaars. Leave space for traffic between neighborhoods.', bestTime: 'October · March', language: 'Hindi · Rajasthani · English', currency: 'Indian rupee (INR)',
    highlights: [
      { name: 'Amber Fort', area: 'North Jaipur', kind: 'Fort & hillside view', description: 'Visit early to avoid the strongest heat and check official entry and access information.', time: '2–3 hours' },
      { name: 'Hawa Mahal & old city', area: 'Pink City', kind: 'Architecture & market walk', description: 'Explore the streets and market lanes on foot with time for a local guide or craft stop.', time: 'Half day' },
      { name: 'Jantar Mantar', area: 'City Palace area', kind: 'UNESCO-listed observatory', description: 'See the historic astronomical instruments and allow time for an on-site explanation.', time: '1–2 hours' },
    ], localTip: 'Start outdoor visits early and agree on fares before taxi rides; Jaipur’s sights are spread across the city.',
    gettingAround: 'Use auto-rickshaws, app taxis, and hired drivers; group nearby sights to save time.', whereToStay: 'The old city suits short walks and markets; C-Scheme offers a quieter modern base.', localFlavours: ['Dal baati churma', 'Pyaaz kachori', 'Ghewar', 'Laal maas'], nearbyEscapes: ['Amer town', 'Sanganer crafts', 'Sambhar Lake'], planningNotes: ['Carry water and sun protection, especially in warmer months.', 'Use official ticket counters or trusted booking sources.', 'Ask before photographing artisans or residents.'],
  },
  {
    id: 'hampi', city: 'Hampi', country: 'India', region: 'Karnataka · Deccan plateau', category: 'Culture',
    image: 'https://images.unsplash.com/photo-1606293926075-4c5b1ce8ef2d?auto=format&fit=crop&w=1200&q=85', note: 'Ancient ruins, boulder trails & sunrise rides', from: '2–3 days feels right',
    moments: ['Cycle between the temple ruins', 'Walk the riverside paths with a guide', 'Catch the evening light over the boulder landscape'], location: 'Hampi, Karnataka, India', coordinates: { lat: 15.335, lon: 76.46 },
    overview: 'A remarkable archaeological landscape of temple complexes, river crossings, and granite boulder hills. Respect protected areas and use local guides to understand the site.', bestTime: 'Cooler months · avoid the hottest hours', language: 'Kannada · Telugu · Hindi · English', currency: 'Indian rupee (INR)',
    highlights: [
      { name: 'Vijaya Vittala Temple', area: 'Hampi heritage area', kind: 'Historic temple complex', description: 'Explore the celebrated temple grounds and check current entry rules and visitor routes.', time: '2–3 hours' },
      { name: 'Virupaksha Temple', area: 'Hampi Bazaar', kind: 'Living heritage site', description: 'Visit with respect for worshippers and follow photography and clothing guidance.', time: '1–2 hours' },
      { name: 'Boulder landscape walk', area: 'Across the river', kind: 'Sunrise hike', description: 'Use a local guide, carry water, and stay on safe, permitted routes across exposed rock.', time: '2–3 hours' },
    ], officialGuide: 'https://www.incredibleindia.gov.in/en/trips/trip-listing/excursion-to-rustic-hampi', localTip: 'There is little shade around the ruins. Start early, carry water, and do not climb restricted monuments.',
    gettingAround: 'Walk, cycle, or use local auto-rickshaws; check the current river crossing and site access.', whereToStay: 'Hampi village is close to monuments; nearby Hospet has more transport and lodging options.', localFlavours: ['North Karnataka thali', 'Jolada rotti', 'Local banana dishes', 'Filter coffee'], nearbyEscapes: ['Tungabhadra Dam', 'Anegundi', 'Hospet'], planningNotes: ['Respect archaeological boundaries and temple customs.', 'Carry sun protection and sturdy footwear.', 'Confirm river crossings and local transport availability each day.'],
  },
  {
    id: 'alleppey', city: 'Alappuzha backwaters', country: 'India', region: 'Kerala · Malabar coast', category: 'Slow living',
    image: 'https://images.unsplash.com/photo-1602307324854-0d6d8e6d0e0a?auto=format&fit=crop&w=1200&q=85', note: 'Canal journeys, village life & gentle boat rides', from: '2–4 days feels right',
    moments: ['Take a licensed backwater boat ride', 'Walk a village lane beside the canals', 'Try a slow lunch served on a banana leaf'], location: 'Alappuzha, Kerala, India', coordinates: { lat: 9.4981, lon: 76.3388 },
    overview: 'A low-lying network of canals, lakes, villages, and paddy fields. Choose an operator that follows local waterway and environmental rules, and keep the itinerary unhurried.', bestTime: 'December · March · check monsoon conditions', language: 'Malayalam · English', currency: 'Indian rupee (INR)',
    highlights: [
      { name: 'Backwater cruise', area: 'Alappuzha canals', kind: 'Boat journey', description: 'Compare licensed operators and choose a route and duration that suits your group and the current conditions.', time: 'Several hours or overnight' },
      { name: 'Alappuzha beach & pier', area: 'Alappuzha town', kind: 'Coastal walk', description: 'Take an evening walk and follow local guidance about swimming and sea conditions.', time: 'An easy evening' },
      { name: 'Village canoe outing', area: 'Kuttanad region', kind: 'Small boat ride', description: 'A quieter way to see daily life on the canals; book locally and respect residents’ privacy.', time: '2–3 hours' },
    ], localTip: 'Choose responsible boat operators, avoid littering, and ask permission before photographing people or homes.',
    gettingAround: 'Use local taxis, ferries, and arranged boat transfers; check departure points before booking.', whereToStay: 'The town is practical for transport; lakeside stays give a quieter view of the canals.', localFlavours: ['Karimeen pollichathu', 'Kerala sadya', 'Appam & stew', 'Toddy-shop dishes'], nearbyEscapes: ['Kumarakom', 'Marari Beach', 'Kuttanad'], planningNotes: ['Check boat safety equipment and licensing.', 'Weather and water levels affect routes.', 'Mosquito protection and light rain gear are useful.'],
  },
  {
    id: 'meghalaya', city: 'Shillong & Meghalaya', country: 'India', region: 'Northeast India · Khasi Hills', category: 'Trek & trails',
    image: 'https://images.unsplash.com/photo-1581793745862-99fde7fa73d2?auto=format&fit=crop&w=1200&q=85', note: 'Waterfall roads, living root bridges & green trails', from: '5–7 days feels right',
    moments: ['Drive the hill roads between villages', 'Walk with a local guide to a living root bridge', 'Leave time for waterfalls and rain'], location: 'Shillong, Meghalaya, India', coordinates: { lat: 25.5788, lon: 91.8933 },
    overview: 'Meghalaya’s Khasi and Jaintia hills reward a slower road trip, village stays, waterfalls, and guided forest walks. Heavy rain can change access and trail conditions.', bestTime: 'Drier months for easier trail access', language: 'Khasi · English · Hindi', currency: 'Indian rupee (INR)',
    highlights: [
      { name: 'Living root bridge walk', area: 'Cherrapunji region', kind: 'Guided trek', description: 'Plan with a local guide, expect many steps, and ask about community access and current trail conditions.', time: 'Half or full day' },
      { name: 'Shillong heritage & music', area: 'Shillong', kind: 'City day', description: 'Explore cafés, viewpoints, markets, and local music culture at an easy pace.', time: 'A relaxed day' },
      { name: 'Waterfall route', area: 'Khasi Hills', kind: 'Scenic drive & walk', description: 'Choose accessible falls according to weather and local advice; avoid unsafe edges during heavy rain.', time: 'Full day' },
    ], localTip: 'Rain can arrive quickly and make stone steps slippery. Travel with a local guide and follow community access rules.',
    gettingAround: 'Hire a reputable local driver for longer distances; road journeys between sights take time.', whereToStay: 'Use Shillong for services and add village homestays for quieter trail access.', localFlavours: ['Jadoh', 'Dohneiiong', 'Tungrymbai', 'Local citrus'], nearbyEscapes: ['Mawlynnong', 'Dawki', 'Laitlum Canyon'], planningNotes: ['Confirm local permissions and trail conditions.', 'Carry grippy footwear and rain protection.', 'Respect village customs and ask before photographing residents.'],
  },
  {
    id: 'sikkim', city: 'Gangtok & Sikkim', country: 'India', region: 'Eastern Himalaya', category: 'Drive & rail',
    image: 'https://images.unsplash.com/photo-1619845227428-7b6e3bd4b5e7?auto=format&fit=crop&w=1200&q=85', note: 'Monastery roads, Himalayan views & quiet hikes', from: '5–7 days feels right',
    moments: ['Explore Gangtok on foot', 'Take a careful day drive to a monastery', 'Choose a guided forest or mountain walk'], location: 'Gangtok, Sikkim, India', coordinates: { lat: 27.3389, lon: 88.6065 },
    overview: 'A hill-state journey through monasteries, mountain viewpoints, and small towns. Road access, permits, and weather can affect routes, especially near border areas.', bestTime: 'Spring · autumn · check current access', language: 'Nepali · Sikkimese · Hindi · English', currency: 'Indian rupee (INR)',
    highlights: [
      { name: 'Gangtok town walk', area: 'Gangtok', kind: 'Market & viewpoint', description: 'Explore the pedestrian center, cafés, and viewpoints while allowing for steep streets.', time: 'Half day' },
      { name: 'Rumtek Monastery', area: 'Near Gangtok', kind: 'Monastery visit', description: 'Check access and visitor guidance, dress respectfully, and follow photography restrictions.', time: 'Half day' },
      { name: 'Mountain day drive', area: 'Sikkim', kind: 'Scenic road trip', description: 'Use an authorized local driver and verify route permits, weather, and current road status.', time: 'Full day' },
    ], localTip: 'Sikkim road conditions and permit requirements vary by area. Verify locally before planning a day trip or trek.',
    gettingAround: 'Use registered local taxis and drivers; check permit requirements for restricted areas.', whereToStay: 'Gangtok is the most practical base for first-time visits; add a village stay if you have extra time.', localFlavours: ['Momos', 'Thukpa', 'Gundruk', 'Chhurpi'], nearbyEscapes: ['Rumtek', 'Tsomgo Lake', 'Pelling'], planningNotes: ['Check permits and local travel advisories before booking.', 'Allow buffer time for mountain road delays.', 'Bring layers and rain protection.'],
  },
]

const indiaAdditions: Destination[] = [
  curatedPlace({
    id: 'varanasi', city: 'Varanasi', country: 'India', region: 'Uttar Pradesh · Ganga plain', category: 'Culture', imageId: 'photo-1561361513-2d000a50f0dc',
    galleryIds: ['photo-1572782252655-4bc7d92fb4b3', 'photo-1548013146-72479768bada', 'photo-1564507592333-c60657eea523'],
    note: 'River mornings, old lanes & living traditions', from: '2–4 days feels right', moments: ['Watch dawn from a public riverfront ghat', 'Walk the old lanes with a local guide', 'Make a quiet visit to Sarnath'],
    location: 'Varanasi, Uttar Pradesh, India', coordinates: { lat: 25.3176, lon: 82.9739 }, overview: 'One of the world’s oldest living cities, Varanasi is a place of pilgrimage, craft, food, and daily life beside the Ganga. Approach sacred spaces with care and leave room for a slower pace.',
    bestTime: 'October · March', language: 'Hindi · Bhojpuri · English', currency: 'Indian rupee (INR)',
    highlights: [
      { name: 'Dashashwamedh & river ghats', area: 'Old city', kind: 'Riverfront & culture', description: 'Visit respectfully, use public access points, and ask before photographing people or ceremonies.', time: 'Early morning or evening' },
      { name: 'Sarnath', area: 'North of Varanasi', kind: 'Buddhist heritage', description: 'Explore the archaeological park and museum; check current opening information before travel.', time: 'Half day' },
      { name: 'Old-city food walk', area: 'Chowk & lanes', kind: 'Food & neighborhood', description: 'Join a reputable local guide and choose busy, freshly prepared food stalls.', time: '2–3 hours' },
    ],
    localTip: 'The riverfront is a living sacred place. Follow local guidance, avoid blocking ceremonies, and ask permission before taking photographs.',
    gettingAround: 'Walk the old city with a guide or use cycle rickshaws for short links; traffic and narrow lanes make cars impractical.', whereToStay: 'Choose a registered stay near the old city or Cantonment based on your mobility and noise preferences.',
    localFlavours: ['Kachori sabzi', 'Tamatar chaat', 'Banarasi paan', 'Lassi'], nearbyEscapes: ['Sarnath', 'Ramnagar Fort', 'Chunar'], planningNotes: ['Keep footwear and modest clothing practical for temple visits.', 'Use a licensed boat operator and agree on price before boarding.', 'Crowds, heat, and river conditions change by season.'],
  }),
  curatedPlace({
    id: 'agra', city: 'Agra', country: 'India', region: 'Uttar Pradesh · Yamuna river', category: 'Culture', imageId: 'photo-1564507592333-c60657eea523',
    galleryIds: ['photo-1548013146-72479768bada', 'photo-1592639296346-560c37a0f711', 'photo-1524492412937-b28074a5d7da'],
    note: 'Mughal architecture & river-side sunsets', from: '1–2 days feels right', moments: ['See the Taj Mahal early in the day', 'Explore the red sandstone fort', 'Find a public view across the Yamuna at dusk'],
    location: 'Agra, Uttar Pradesh, India', coordinates: { lat: 27.1767, lon: 78.0081 }, overview: 'Agra’s monumental Mughal sites tell a layered story in marble, sandstone, gardens, and river views. Pair the famous landmarks with time for local food and craft.',
    bestTime: 'October · March', language: 'Hindi · Urdu · English', currency: 'Indian rupee (INR)',
    highlights: [
      { name: 'Taj Mahal', area: 'Taj Ganj', kind: 'UNESCO World Heritage site', description: 'Check official ticketing, opening days, entry rules, and sunrise conditions before you go.', time: '2–3 hours' },
      { name: 'Agra Fort', area: 'Old Agra', kind: 'Fort & history', description: 'Explore the courtyards and historic halls with a guide who can explain the site’s Mughal history.', time: '2 hours' },
      { name: 'Mehtab Bagh', area: 'Across the Yamuna', kind: 'Garden & viewpoint', description: 'Visit the riverfront garden for a different view of the Taj; check local access and sunset timing.', time: '1–2 hours' },
    ],
    localTip: 'Use official ticket counters or websites and be cautious of unsolicited guides near major gates.',
    gettingAround: 'Use registered taxis, auto-rickshaws, or app-based rides between sites; traffic can add time.', whereToStay: 'Taj Ganj is convenient for an early visit; central Agra has more rail and dining connections.',
    localFlavours: ['Petha', 'Bedai kachori', 'Mughlai dishes', 'Dalmoth'], nearbyEscapes: ['Fatehpur Sikri', 'Bharatpur bird sanctuary', 'Mathura'], planningNotes: ['The Taj Mahal is closed on Fridays; verify current entry details.', 'Sun and heat are strong around open monuments.', 'Protect valuables in crowded markets and transport hubs.'],
  }),
  curatedPlace({
    id: 'jaisalmer', city: 'Jaisalmer', country: 'India', region: 'Rajasthan · Thar Desert', category: 'Culture', imageId: 'photo-1599661046827-dacff0c0f09a',
    galleryIds: ['photo-1602643163983-ed0babc39797', 'photo-1509316785289-025f5b846b35', 'photo-1590089415225-401ed6f9db8e'],
    note: 'Golden lanes, desert skies & carved havelis', from: '2–4 days feels right', moments: ['Walk the living fort with a local guide', 'Visit a haveli before the midday heat', 'Choose a responsible desert camp outside the dunes'],
    location: 'Jaisalmer, Rajasthan, India', coordinates: { lat: 26.9157, lon: 70.9083 }, overview: 'A sandstone desert city whose fort is still home to residents, shops, and shrines. The old lanes reward gentle exploration, while desert outings need thoughtful operators and water planning.',
    bestTime: 'November · February', language: 'Hindi · Rajasthani · English', currency: 'Indian rupee (INR)',
    highlights: [
      { name: 'Jaisalmer Fort', area: 'Old city', kind: 'Living heritage site', description: 'Respect residents, reduce water use, and follow local rules while exploring the fort lanes.', time: '2–3 hours' },
      { name: 'Patwon ki Haveli', area: 'Old city', kind: 'Architecture & craft', description: 'See intricate stone carving and learn about merchant life through the museum and local guides.', time: '1–2 hours' },
      { name: 'Thar desert outing', area: 'Sam or Khuri', kind: 'Desert landscape', description: 'Choose a responsible operator, avoid overcrowded animal rides, and confirm return transport.', time: 'Half or full day' },
    ],
    localTip: 'The fort is a living neighborhood with limited water. Conserve water, keep noise low, and avoid walking on restricted ramparts.',
    gettingAround: 'Walk the compact old city; use a registered taxi for outlying havelis and desert excursions.', whereToStay: 'Choose a locally run guesthouse in the old city or a licensed stay outside the fort to reduce pressure on its water system.',
    localFlavours: ['Ker sangri', 'Dal baati churma', 'Ghotua laddoo', 'Bajra roti'], nearbyEscapes: ['Kuldhara village', 'Khuri dunes', 'Desert National Park'], planningNotes: ['Desert temperatures swing sharply between day and night.', 'Carry water and sun protection on every outing.', 'Check permits and wildlife guidance for protected desert areas.'],
  }),
  curatedPlace({
    id: 'srinagar', city: 'Srinagar', country: 'India', region: 'Jammu & Kashmir · Kashmir Valley', category: 'Nature', imageId: 'photo-1595815771614-ade9d652a65d',
    galleryIds: ['photo-1626621331517-bbf3d9990a23', 'photo-1501785888041-af3ef285b470', 'photo-1544735716-392fe2489ffa'],
    note: 'Lake mornings, garden walks & mountain air', from: '3–5 days feels right', moments: ['Take a licensed shikara ride on Dal Lake', 'Walk the Mughal gardens', 'Leave a flexible day for a nearby valley'],
    location: 'Srinagar, Jammu & Kashmir, India', coordinates: { lat: 34.0837, lon: 74.7973 }, overview: 'A lake city framed by the Himalaya, with garden walks, old neighborhoods, craft traditions, and seasonal mountain scenery. Check current local travel advisories and road access before planning excursions.',
    bestTime: 'Spring · autumn', language: 'Kashmiri · Urdu · Hindi · English', currency: 'Indian rupee (INR)',
    highlights: [
      { name: 'Dal Lake', area: 'Srinagar', kind: 'Lake & boat ride', description: 'Use a licensed shikara operator, agree on the route and price, and follow lake conservation guidance.', time: '1–2 hours' },
      { name: 'Mughal gardens', area: 'Dal Lake foothills', kind: 'Historic gardens', description: 'Visit Nishat or Shalimar Bagh and check seasonal opening and current visitor information.', time: '2–3 hours' },
      { name: 'Old Srinagar', area: 'Downtown', kind: 'Heritage & craft walk', description: 'Explore with a knowledgeable local guide and ask before photographing residents or religious spaces.', time: 'Half day' },
    ],
    localTip: 'Check official advisories, weather, and road status before any day trip. Keep plans flexible and follow local guidance.',
    gettingAround: 'Use registered taxis for longer connections; walking and licensed lake boats suit nearby sights.', whereToStay: 'Choose a registered hotel or houseboat with clear transport arrangements and current guest information.',
    localFlavours: ['Rogan josh', 'Yakhni', 'Kahwa', 'Kashmiri breads'], nearbyEscapes: ['Gulmarg', 'Pahalgam', 'Sonamarg'], planningNotes: ['Mountain roads and access can change with weather and local conditions.', 'Confirm any required permissions before travel.', 'Bring layers even in warmer months.'],
  }),
  curatedPlace({
    id: 'ooty', city: 'Ooty & the Nilgiris', country: 'India', region: 'Tamil Nadu · Nilgiri Hills', category: 'Drive & rail', imageId: 'photo-1595815771614-ade9d652a65d',
    galleryIds: ['photo-1602216056096-3b40cc0c9944', 'photo-1500534623283-312aade485b7', 'photo-1578662996442-48f60103fc96'],
    note: 'Toy trains, tea gardens & cool hill walks', from: '3–4 days feels right', moments: ['Ride the Nilgiri Mountain Railway', 'Take a tea-estate walk with permission', 'Pause at a viewpoint when the clouds lift'],
    location: 'Ooty, Tamil Nadu, India', coordinates: { lat: 11.4102, lon: 76.695 }, overview: 'A cool-climate hill town in the Nilgiris, known for its mountain railway, gardens, tea country, and winding roads. Travel slowly through the hills and respect local community and forest rules.',
    bestTime: 'October · June · check monsoon conditions', language: 'Tamil · Badaga · English', currency: 'Indian rupee (INR)',
    highlights: [
      { name: 'Nilgiri Mountain Railway', area: 'Mettupalayam–Ooty', kind: 'Heritage train ride', description: 'Check the official railway schedule and reserve seats early for the mountain route.', time: 'A scenic rail day' },
      { name: 'Government Botanical Garden', area: 'Ooty', kind: 'Garden walk', description: 'Wander the lawns and plant collections; check current hours and seasonal events.', time: '2 hours' },
      { name: 'Tea country drive', area: 'Coonoor & Nilgiris', kind: 'Scenic road trip', description: 'Use public viewpoints and visit estates only with permission; drive carefully on misty roads.', time: 'Half day' },
    ],
    localTip: 'Avoid littering and loud music in the hills; follow forest and wildlife rules, especially near protected areas.',
    gettingAround: 'Walk central Ooty, use local taxis for spread-out sights, and use the heritage train for the longer mountain rail experience.', whereToStay: 'Stay in central Ooty for rail and bus connections, or choose Coonoor for a quieter tea-country base.',
    localFlavours: ['Ooty chocolates', 'Nilgiri tea', 'Toda-style dishes', 'Fresh vegetable soups'], nearbyEscapes: ['Coonoor', 'Kotagiri', 'Mudumalai'], planningNotes: ['Mountain train seats and schedules can be limited.', 'Fog and rain affect road visibility.', 'Check park entry rules and avoid feeding wildlife.'],
  }),
  curatedPlace({
    id: 'spiti', city: 'Spiti Valley', country: 'India', region: 'Himachal Pradesh · Trans-Himalaya', category: 'Trek & trails', imageId: 'photo-1581793745862-99fde7fa73d2',
    galleryIds: ['photo-1519681393784-d120267933ba', 'photo-1472396961693-142e6e269027', 'photo-1501785888041-af3ef285b470'],
    note: 'High desert villages, monasteries & big skies', from: '6–9 days feels right', moments: ['Build in acclimatization days', 'Visit a monastery with local guidance', 'Keep road plans flexible for weather'],
    location: 'Kaza, Spiti Valley, Himachal Pradesh, India', coordinates: { lat: 32.227, lon: 78.071 }, overview: 'A remote high-altitude valley of Buddhist monasteries, small villages, stark peaks, and long mountain drives. The journey is as important as the sights; plan for altitude, limited services, and road changes.',
    bestTime: 'Summer road season · verify current access', language: 'Spitian · Hindi · English', currency: 'Indian rupee (INR)',
    highlights: [
      { name: 'Key Monastery', area: 'Ki village', kind: 'Monastery & valley view', description: 'Check visitor access, dress respectfully, and ask before photographing inside or during prayer.', time: '1–2 hours' },
      { name: 'Langza & fossil village', area: 'Kaza region', kind: 'Village & landscape', description: 'Travel with respect for residents and protected fossils; do not remove objects from the landscape.', time: 'Half day' },
      { name: 'Pin Valley', area: 'Spiti', kind: 'High-altitude nature area', description: 'Check park guidance, weather, and road status; use a local guide for longer walks.', time: 'Full day or more' },
    ],
    localTip: 'This is high-altitude travel with limited medical services. Acclimatize carefully, carry essentials, and follow local road advisories.',
    gettingAround: 'Distances are long; use a reliable local driver and confirm fuel, road, and weather conditions each day.', whereToStay: 'Use Kaza for services, then registered homestays in villages for a slower visit and local benefit.',
    localFlavours: ['Thukpa', 'Momos', 'Butter tea', 'Tsampa'], nearbyEscapes: ['Tabo', 'Pin Valley', 'Dhankar'], planningNotes: ['Do not rush to high villages immediately after arriving.', 'Road access varies by season and weather.', 'Carry warm layers, sun protection, water, and any needed medication.'],
  }),
  curatedPlace({
    id: 'andaman', city: 'Andaman Islands', country: 'India', region: 'Bay of Bengal · Andaman Sea', category: 'Coast', imageId: 'photo-1519046904884-53103b34b206',
    galleryIds: ['photo-1500375592092-40eb2168fd21', 'photo-1512343879784-a960bf40e7f2', 'photo-1507525428034-b723cf961d3e'],
    note: 'Quiet beaches, coral reefs & island crossings', from: '5–7 days feels right', moments: ['Reserve ferries before you move between islands', 'Choose a permitted reef guide', 'Leave a weather buffer before your flight'],
    location: 'Sri Vijaya Puram (Port Blair), Andaman and Nicobar Islands, India', coordinates: { lat: 11.6234, lon: 92.7265 }, overview: 'A tropical island group for beach days, marine life, and history. Ferry schedules, weather, permits, and protected-area rules shape what is possible, so build flexibility into every island transfer.',
    bestTime: 'November · April · check monsoon seas', language: 'Hindi · Bengali · Tamil · English', currency: 'Indian rupee (INR)',
    highlights: [
      { name: 'Swaraj Dweep beaches', area: 'Havelock Island', kind: 'Beach & marine life', description: 'Check lifeguard flags and marine rules; never stand on or touch coral.', time: 'A relaxed day' },
      { name: 'Cellular Jail', area: 'Sri Vijaya Puram', kind: 'History museum', description: 'Visit the historic site respectfully and check the current museum and evening program schedule.', time: '2–3 hours' },
      { name: 'Snorkeling with a permitted guide', area: 'Designated reef areas', kind: 'Marine activity', description: 'Choose a licensed operator, use reef-safe practices, and follow local sea and weather advisories.', time: 'Half day' },
    ],
    localTip: 'Respect protected and Indigenous communities and all restricted-area boundaries. Do not fly drones or enter restricted islands without permission.',
    gettingAround: 'Use official ferries between islands and licensed local taxis or transfers on each island; confirm luggage and check-in rules.', whereToStay: 'Choose a base near your ferry point, and allow an overnight buffer before flights where possible.',
    localFlavours: ['Fresh fish curry', 'Coconut dishes', 'Tropical fruit', 'Local seafood thalis'], nearbyEscapes: ['Baratang', 'Neil Island', 'Mahatma Gandhi Marine National Park'], planningNotes: ['Ferries and flights can be disrupted by weather.', 'Book official ferry seats and entry permits in advance where required.', 'Use reef-safe behavior and take all waste back with you.'],
  }),
  curatedPlace({
    id: 'rann-of-kutch', city: 'Rann of Kutch', country: 'India', region: 'Gujarat · Kutch district', category: 'Nature', imageId: 'photo-1509316785289-025f5b846b35',
    galleryIds: ['photo-1500530855697-b586d89ba3ee', 'photo-1590089415225-401ed6f9db8e', 'photo-1500534623283-312aade485b7'],
    note: 'White salt flats, craft villages & open desert', from: '3–5 days feels right', moments: ['Check the Rann permit before departure', 'Visit a craft village with a local host', 'Plan for a wide temperature swing after sunset'],
    location: 'Dhordo, Kutch, Gujarat, India', coordinates: { lat: 23.7337, lon: 69.8597 }, overview: 'A vast salt-marsh landscape and craft-rich region with long distances between villages. The seasonal Rann festival and border-area rules affect access; plan transport and permissions in advance.',
    bestTime: 'Cool season · check festival dates and access', language: 'Gujarati · Kutchi · Hindi', currency: 'Indian rupee (INR)',
    highlights: [
      { name: 'Great Rann salt flats', area: 'Dhordo', kind: 'Salt desert landscape', description: 'Check current permit requirements and sunset entry windows; stay within marked public areas.', time: 'Late afternoon' },
      { name: 'Bhuj heritage walk', area: 'Bhuj', kind: 'City & craft history', description: 'Explore local museums and markets, checking which heritage sites are open on your dates.', time: 'Half day' },
      { name: 'Kutch craft villages', area: 'Kutch district', kind: 'Community craft visit', description: 'Arrange visits through local cooperatives or hosts and buy directly when possible.', time: 'Half or full day' },
    ],
    localTip: 'Respect border-area rules and local community photography preferences; always ask before photographing artisans or residents.',
    gettingAround: 'Hire a reliable local driver for the large distances; confirm fuel and return plans before leaving town.', whereToStay: 'Bhuj is a useful base for services; licensed village stays near Dhordo suit a festival visit.',
    localFlavours: ['Kutchi dabeli', 'Bajra rotla', 'Khichdi', 'Local sweets'], nearbyEscapes: ['Bhuj', 'Mandvi coast', 'Dholavira'], planningNotes: ['Carry identity documents for any required permits.', 'The salt flats are exposed; bring water, sun protection, and warm night layers.', 'Festival dates, access, and road conditions change each season.'],
  }),
]

const indiaPhotoAdditions: Record<string, string[]> = {
  darjeeling: ['photo-1578662996442-48f60103fc96', 'photo-1500534623283-312aade485b7'],
  shimla: ['photo-1500530855697-b586d89ba3ee', 'photo-1470770841072-f978cf4d019e'],
  ladakh: ['photo-1501785888041-af3ef285b470', 'photo-1509316785289-025f5b846b35'],
  manali: ['photo-1472396961693-142e6e269027', 'photo-1464822759023-fed622ff2c3b'],
  rishikesh: ['photo-1500534623283-312aade485b7', 'photo-1544735716-392fe2489ffa'],
  munnar: ['photo-1595815771614-ade9d652a65d', 'photo-1500534623283-312aade485b7'],
  goa: ['photo-1500375592092-40eb2168fd21', 'photo-1519046904884-53103b34b206'],
  jaipur: ['photo-1564507592333-c60657eea523', 'photo-1524492412937-b28074a5d7da'],
  hampi: ['photo-1606293926075-69a00dbfde81', 'photo-1548013146-72479768bada'],
  alleppey: ['photo-1593693397690-362cb9666fc2', 'photo-1602216056096-3b40cc0c9944'],
  meghalaya: ['photo-1598091383021-15ddea10925d', 'photo-1470770841072-f978cf4d019e'],
  sikkim: ['photo-1501785888041-af3ef285b470', 'photo-1578662996442-48f60103fc96'],
}

const indiaSeed: Destination[] = [...indiaSeedBase, ...indiaAdditions].map((destination) => ({
  ...destination,
  gallery: destination.gallery?.length
    ? destination.gallery
    : [destination.image, ...(indiaPhotoAdditions[destination.id] ?? []).map(destinationPhoto)],
}))

const destinationSeed: Destination[] = [...indiaSeed, ...foreignSeed]

const categories: Category[] = ['All', 'Drive & rail', 'Trek & trails', 'Coast', 'Culture', 'Nature', 'Slow living']
const heroImage = 'https://images.unsplash.com/photo-1605649487212-47bdab064df7?auto=format&fit=crop&w=2200&q=90'

type StoredState = { pickedIds: string[]; savedTrip: SavedTrip | null; customDestinations: Destination[] }
type BackendStatus = 'connecting' | 'connected' | 'offline'
type CurrentTripResponse = { trip: SavedTrip | null; selectedIds: string[] }
type WorldPlace = {
  id: string
  city: string
  country: string
  region: string
  location: string
  coordinates: { lat: number; lon: number }
  timezone: string
  population: number | null
  elevation: number | null
  featureCode: string
  photos?: WorldPhoto[]
  photosLoading?: boolean
}
type AccountUser = { id: string; email: string }
type AppRoute = { page: string; detailId?: string; token?: string; email?: string }
type WorldPhoto = { src: string; label: string; url: string }

function readStoredState(): StoredState {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return { pickedIds: [], savedTrip: null, customDestinations: [] }
    const parsed = JSON.parse(raw) as { pickedIds?: unknown; savedTrip?: unknown; customDestinations?: unknown }
    const customDestinations = Array.isArray(parsed.customDestinations)
      ? parsed.customDestinations.filter((item): item is Destination => {
          if (!item || typeof item !== 'object') return false
          const destination = item as Partial<Destination>
          return typeof destination.id === 'string'
            && typeof destination.city === 'string'
            && typeof destination.country === 'string'
            && typeof destination.region === 'string'
            && typeof destination.image === 'string'
            && typeof destination.note === 'string'
            && typeof destination.from === 'string'
            && Array.isArray(destination.moments)
            && destination.moments.every((moment) => typeof moment === 'string')
            && categories.includes(destination.category as Category)
        })
      : []
    return {
      pickedIds: Array.isArray(parsed.pickedIds) ? parsed.pickedIds.filter((id): id is string => typeof id === 'string') : [],
      savedTrip: parsed.savedTrip && typeof parsed.savedTrip === 'object' ? parsed.savedTrip as SavedTrip : null,
      customDestinations,
    }
  } catch {
    return { pickedIds: [], savedTrip: null, customDestinations: [] }
  }
}

function getPlannerSessionId() {
  const sessionKey = 'roam-planner-session-v1'
  try {
    const current = window.localStorage.getItem(sessionKey)
    if (current) return current
    const created = window.crypto.randomUUID()
    window.localStorage.setItem(sessionKey, created)
    return created
  } catch {
    return window.crypto.randomUUID()
  }
}

function createPlannerSessionId() {
  const sessionKey = 'roam-planner-session-v1'
  const created = window.crypto.randomUUID()
  try { window.localStorage.setItem(sessionKey, created) } catch { /* the in-memory session still works */ }
  return created
}

function routeFromHash(): AppRoute {
  const hash = window.location.hash.slice(1)
  const queryIndex = hash.indexOf('?')
  const path = queryIndex < 0 ? hash : hash.slice(0, queryIndex)
  const params = new URLSearchParams(queryIndex < 0 ? '' : hash.slice(queryIndex + 1))
  if (path.startsWith('/place/')) {
    try { return { page: 'place', detailId: decodeURIComponent(path.slice('/place/'.length)) } } catch { return { page: 'not-found' } }
  }
  const pages: Record<string, string> = {
    '/': 'home', '/places': 'places', '/world': 'world', '/planner': 'planner', '/about': 'about', '/welcome': 'onboarding',
    '/login': 'login', '/register': 'register', '/account': 'account', '/signed-out': 'signed-out', '/account-deleted': 'account-deleted',
    '/verify-email': 'verify-email', '/forgot-password': 'forgot-password', '/reset-password': 'reset-password',
    '/privacy': 'privacy', '/terms': 'terms',
    '#destinations': 'places', '#planner': 'planner', '#about': 'about',
  }
  const page = pages[path] ?? pages[`#${path}`] ?? (path ? 'not-found' : 'home')
  return { page, token: params.get('token') ?? undefined, email: params.get('email') ?? undefined }
}

async function accountApiRequest<T>(sessionId: string, path: string, method: 'GET' | 'POST' | 'DELETE' = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api/auth${path}`, {
    method,
    credentials: 'same-origin',
    headers: {
      'x-roam-session': sessionId,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const result = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(result.error || `Account request returned ${response.status}`)
  return result
}

async function plannerApiRequest<T>(sessionId: string, method: 'GET' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  const response = await fetch('/api/trips/current', {
    method,
    headers: {
      'x-roam-session': sessionId,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) throw new Error(`Planner API returned ${response.status}`)
  return await response.json() as T
}

function formatDay(startDate: string, dayIndex: number) {
  if (!startDate) return `Day ${dayIndex + 1}`
  const date = new Date(`${startDate}T12:00:00`)
  date.setDate(date.getDate() + dayIndex)
  return new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' }).format(date)
}

function formatDate(value: string) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${value}T12:00:00`))
}

function App() {
  const initialState = useMemo(readStoredState, [])
  const [sessionId, setSessionId] = useState(getPlannerSessionId)
  const [route, setRoute] = useState<AppRoute>(routeFromHash)
  const [destinations, setDestinations] = useState(() => [...destinationSeed, ...initialState.customDestinations])
  const [pickedIds, setPickedIds] = useState(initialState.pickedIds)
  const [savedTrip, setSavedTrip] = useState<SavedTrip | null>(initialState.savedTrip)
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('connecting')
  const [category, setCategory] = useState<Category>('All')
  const [query, setQuery] = useState('')
  const [worldQuery, setWorldQuery] = useState('')
  const [worldPlaces, setWorldPlaces] = useState<WorldPlace[]>([])
  const [worldSearchBusy, setWorldSearchBusy] = useState(false)
  const [worldSearchError, setWorldSearchError] = useState('')
  const [addingPlaceId, setAddingPlaceId] = useState('')
  const [authUser, setAuthUser] = useState<AccountUser | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [captchaConfig, setCaptchaConfig] = useState({ siteKey: '', required: false, loading: true })
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [days, setDays] = useState(5)
  const [travelers, setTravelers] = useState(2)
  const [budget, setBudget] = useState('Comfortable')
  const [transport, setTransport] = useState('Train & local transit')
  const [stayStyle, setStayStyle] = useState('Guesthouse or homestay')
  const [travelNote, setTravelNote] = useState('')
  const [notice, setNotice] = useState('')
  const skipLocalMigration = useRef(false)

  useEffect(() => {
    let active = true
    fetch('/api/public-config')
      .then(async (response) => {
        if (!response.ok) throw new Error('Security configuration is unavailable.')
        return await response.json() as { captchaSiteKey?: unknown; captchaRequired?: unknown }
      })
      .then((config) => {
        if (active) setCaptchaConfig({
          siteKey: typeof config.captchaSiteKey === 'string' ? config.captchaSiteKey : '',
          required: config.captchaRequired === true,
          loading: false,
        })
      })
      .catch(() => { if (active) setCaptchaConfig({ siteKey: '', required: false, loading: false }) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const syncRoute = () => {
      setRoute(routeFromHash())
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    window.addEventListener('hashchange', syncRoute)
    if (!window.location.hash) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/`)
    else syncRoute()
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  const navigate = useCallback((path: string) => {
    if (window.location.hash === path) {
      setRoute(routeFromHash())
      window.scrollTo({ top: 0, behavior: 'instant' })
    } else window.location.hash = path
  }, [])

  const picked = useMemo(
    () => pickedIds.map((id) => destinations.find((destination) => destination.id === id)).filter((destination): destination is Destination => Boolean(destination)),
    [destinations, pickedIds],
  )
  const placeDetail = route.detailId ? destinations.find((destination) => destination.id === route.detailId) : undefined
  const detailReturnPath = placeDetail?.country.toLowerCase().includes('india') ? '#/places' : '#/world'
  const closePlaceGuide = useCallback(() => navigate(detailReturnPath), [detailReturnPath, navigate])

  const filteredDestinations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return destinations.filter((destination) => {
      const isIndia = destination.country.toLowerCase().includes('india')
      if (route.page === 'world' && isIndia) return false
      if (route.page !== 'world' && route.page !== 'place' && !isIndia) return false
      const matchesCategory = category === 'All' || destination.category === category
      const guideSearchText = [destination.location, ...(destination.highlights ?? []).flatMap((highlight) => [highlight.name, highlight.area])].join(' ')
      const matchesQuery = !normalizedQuery || `${destination.city} ${destination.country} ${destination.region} ${destination.note} ${guideSearchText}`.toLowerCase().includes(normalizedQuery)
      return matchesCategory && matchesQuery
    })
  }, [category, destinations, query, route.page])

  useEffect(() => {
    try {
      const seedIds = new Set(destinationSeed.map((destination) => destination.id))
      const customDestinations = destinations.filter((destination) => !seedIds.has(destination.id))
      window.localStorage.setItem(storageKey, JSON.stringify({ pickedIds, savedTrip, customDestinations }))
    } catch {
      setNotice('Your browser could not save this trip locally.')
    }
  }, [destinations, pickedIds, savedTrip])

  useEffect(() => {
    setCategory('All')
    setQuery('')
    setAuthError('')
    setWorldQuery('')
    setWorldPlaces([])
    setWorldSearchError('')
  }, [route.page])

  useEffect(() => {
    if (route.token) {
      setAuthError('')
      setAuthNotice('')
    }
  }, [route.page, route.token])

  useEffect(() => {
    const pageRoute = route.page === 'home' ? '/' : route.page === 'place' ? '/place' : `/${route.page}`
    void fetch('/api/analytics/pageview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ route: pageRoute }),
      keepalive: true,
    }).catch(() => undefined)
  }, [route.detailId, route.page])

  useEffect(() => {
    const pageTitles: Record<string, string> = {
      home: 'Himvoya — Thoughtful travel planning',
      places: 'Explore India — Himvoya',
      world: 'Explore the World — Himvoya',
      planner: 'Trip Planner — Himvoya',
      about: 'About Himvoya',
      privacy: 'Privacy & database — Himvoya',
      terms: 'Terms of use — Himvoya',
      onboarding: 'Welcome to Himvoya',
      'verify-email': 'Verify your email — Himvoya',
      'forgot-password': 'Reset your password — Himvoya',
      'reset-password': 'Choose a new password — Himvoya',
      'account-deleted': 'Account deleted — Himvoya',
      'not-found': 'Page not found — Himvoya',
      login: 'Sign in — Himvoya',
      register: 'Create an account — Himvoya',
      account: authUser ? 'My account — Himvoya' : 'Sign in — Himvoya',
      'signed-out': 'Signed out — Himvoya',
      place: placeDetail ? `${placeDetail.city} — Himvoya` : 'Place guide — Himvoya',
    }
    document.title = pageTitles[route.page] ?? 'Himvoya — Travel planner'
  }, [authUser, placeDetail, route.page])

  useEffect(() => {
    let active = true
    async function restoreTrip() {
      try {
        const profile = await accountApiRequest<{ user: AccountUser | null }>(sessionId, '/me')
        if (!active) return
        setAuthUser(profile.user)
        let stored: CurrentTripResponse | null = null
        for (let attempt = 0; attempt < 5 && !stored; attempt += 1) {
          try {
            stored = await plannerApiRequest<CurrentTripResponse>(sessionId, 'GET')
          } catch (error) {
            if (attempt === 4) throw error
            await new Promise((resolve) => window.setTimeout(resolve, 250 * (attempt + 1)))
          }
        }
        if (!stored) throw new Error('Planner backend did not respond.')
        if (!active) return
        setBackendStatus('connected')
        if (stored.trip) {
          setSavedTrip(stored.trip)
          setPickedIds(stored.selectedIds)
          setStartDate(stored.trip.startDate || '')
          setEndDate(stored.trip.endDate || '')
          setDays(stored.trip.days)
          setTravelers(stored.trip.travelers)
          setBudget(stored.trip.budget)
          setTransport(stored.trip.transport || 'Train & local transit')
          setStayStyle(stored.trip.stayStyle || 'Guesthouse or homestay')
          setTravelNote(stored.trip.travelNote || '')
          const routeDestinations = stored.trip.routeDestinations ?? []
          if (routeDestinations.length) {
            setDestinations((current) => {
              const currentIds = new Set(current.map((destination) => destination.id))
              return [...routeDestinations.filter((destination) => !currentIds.has(destination.id)), ...current]
            })
          }
        } else if (initialState.savedTrip && !profile.user && !skipLocalMigration.current) {
          await plannerApiRequest(sessionId, 'PUT', { trip: initialState.savedTrip, selectedIds: initialState.pickedIds })
        } else if (profile.user) {
          setSavedTrip(null)
          setPickedIds([])
        }
      } catch {
        if (active) setBackendStatus('offline')
      }
    }
    void restoreTrip()
    return () => { active = false }
  }, [initialState, sessionId])

  async function searchWorldPlaces(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    const searchTerm = worldQuery.trim()
    if (searchTerm.length < 2) {
      setWorldPlaces([])
      setWorldSearchError('Enter at least two letters to search cities around the world.')
      return
    }
    setWorldSearchBusy(true)
    setWorldSearchError('')
    setWorldPlaces([])
    try {
      const response = await fetch(`/api/places/search?q=${encodeURIComponent(searchTerm)}`)
      const result = await response.json() as { results?: WorldPlace[]; error?: string }
      if (!response.ok) throw new Error(result.error || 'Place search is unavailable right now.')
      const results = result.results ?? []
      setWorldPlaces(results.map((place) => ({ ...place, photosLoading: true })))
      void Promise.all(results.map(async (place) => {
        try {
          const photoResponse = await fetch(`/api/places/photos?q=${encodeURIComponent(`${place.city} ${place.country}`)}`)
          if (!photoResponse.ok) return { id: place.id, photos: [] as WorldPhoto[] }
          const photoResult = await photoResponse.json() as { photos?: WorldPhoto[] }
          return { id: place.id, photos: photoResult.photos ?? [] }
        } catch {
          return { id: place.id, photos: [] as WorldPhoto[] }
        }
      })).then((photoResults) => {
        const byId = new Map(photoResults.map((item) => [item.id, item.photos]))
        setWorldPlaces((current) => current.map((place) => byId.has(place.id)
          ? { ...place, photos: byId.get(place.id) ?? [], photosLoading: false }
          : place))
      })
      const relevant = results.filter((place) => route.page === 'places' ? place.country === 'India' : place.country !== 'India')
      if (!relevant.length) setWorldSearchError(route.page === 'places' ? 'No Indian cities or towns matched. Try another spelling or nearby city.' : 'No cities or towns found. Try another spelling or a nearby city name.')
    } catch (error) {
      setWorldSearchError(error instanceof Error ? error.message : 'Place search is unavailable right now.')
    } finally {
      setWorldSearchBusy(false)
    }
  }

  async function addWorldPlace(place: WorldPlace) {
    setAddingPlaceId(place.id)
    setWorldSearchError('')
    let photos: WorldPhoto[] = place.photos ?? []
    if (!photos.length) {
      try {
        const response = await fetch(`/api/places/photos?q=${encodeURIComponent(`${place.city} ${place.country}`)}`)
        if (response.ok) {
          const result = await response.json() as { photos?: WorldPhoto[] }
          photos = result.photos ?? []
        }
      } catch {
        // A place can still be added when photo search is temporarily unavailable.
      }
    }
    const destination: Destination = {
      id: place.id,
      city: place.city,
      country: place.country || 'International destination',
      region: place.region || place.country || 'Around the world',
      category: 'Culture',
      image: photos[0]?.src || fallbackTravelImage,
      gallery: photos.length ? photos.map((photo) => photo.src) : [fallbackTravelImage],
      galleryAttributions: photos,
      note: 'A new place to discover',
      from: 'Choose your own pace',
      location: place.location,
      coordinates: place.coordinates,
      timezone: place.timezone,
      population: place.population,
      elevation: place.elevation,
      overview: `${place.city} is now on your map. This starter guide gives you its location and a few planning prompts; use local visitor sources to choose specific sights and current transport.`,
      bestTime: 'Check local seasons and weather',
      language: 'Languages vary by region',
      currency: 'Check local currency before travel',
      moments: ['Find the historic or central neighborhood', 'Try a local dish and market', 'Look for a nearby walk or nature area'],
      highlights: [
        { name: 'Historic or city center', area: place.city, kind: 'Neighborhood walk', description: 'Use a local map or visitor guide to find the main public square, historic quarter, or waterfront.', time: 'A relaxed afternoon' },
        { name: 'Local food and markets', area: place.city, kind: 'Food & culture', description: 'Look for a well-reviewed local market or food walk, and check current opening days.', time: '2–3 hours' },
        { name: 'Nearby nature', area: place.region || place.country, kind: 'Day trip idea', description: 'Check local park and trail guidance for a nature walk that suits your time and ability.', time: 'Half day or more' },
      ],
      gettingAround: 'Compare local public transit, licensed taxis, and walking routes. Confirm current schedules and payment options after choosing travel dates.',
      whereToStay: 'Choose a well-connected neighborhood near the activities you care about, and confirm transport options for your arrival time.',
      localFlavours: ['Look for a regional specialty', 'Visit a local market', 'Ask your host for a neighborhood favorite'],
      nearbyEscapes: ['Search local maps for parks, viewpoints, and day trips'],
      localTip: 'This is a geographic starter guide, not a verified local itinerary. Confirm opening times, safety guidance, and transport with official local sources.',
      planningNotes: ['Place details and photos are sourced from public geographic and Wikimedia Commons data.', 'Use official local visitor information for attractions, entry rules, and current conditions.', 'Check visa, health, safety, and transport requirements for your destination before booking.'],
    }
    setDestinations((current) => [destination, ...current.filter((item) => item.id !== destination.id)])
    setPickedIds((current) => current.includes(destination.id) ? current : [...current, destination.id])
    setAddingPlaceId('')
    navigate(`#/place/${encodeURIComponent(destination.id)}`)
  }

  async function restoreAccountTrip() {
    try {
      const stored = await plannerApiRequest<CurrentTripResponse>(sessionId, 'GET')
      if (stored.trip) {
        setSavedTrip(stored.trip)
        setPickedIds(stored.selectedIds)
        setStartDate(stored.trip.startDate || '')
        setEndDate(stored.trip.endDate || '')
        setDays(stored.trip.days)
        setTravelers(stored.trip.travelers)
        setBudget(stored.trip.budget)
        setTransport(stored.trip.transport || 'Train & local transit')
        setStayStyle(stored.trip.stayStyle || 'Guesthouse or homestay')
        setTravelNote(stored.trip.travelNote || '')
        const routeDestinations = stored.trip.routeDestinations ?? []
        setDestinations((current) => {
          const currentIds = new Set(current.map((destination) => destination.id))
          return [...routeDestinations.filter((destination) => !currentIds.has(destination.id)), ...current]
        })
      }
      setBackendStatus('connected')
    } catch {
      setBackendStatus('offline')
    }
  }

  async function authenticate(mode: 'login' | 'register', email: string, password: string, captchaToken: string) {
    setAuthBusy(true)
    setAuthError('')
    setAuthNotice('')
    try {
      if (mode === 'register') {
        const result = await accountApiRequest<{ verificationRequired: boolean; emailSent: boolean }>(sessionId, '/register', 'POST', { email, password, captchaToken })
        if (result.verificationRequired) {
          setAuthNotice(result.emailSent
            ? 'Your account is ready. Check your inbox for the verification link.'
            : 'Your account is ready. Email delivery did not complete; request another link. In local development, the link is printed in the API terminal.')
          navigate(`#/verify-email?email=${encodeURIComponent(email)}`)
          return
        }
      }
      const result = await accountApiRequest<{ user: AccountUser }>(sessionId, '/login', 'POST', { email, password, captchaToken })
      setAuthUser(result.user)
      await restoreAccountTrip()
      navigate('#/account')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'We could not complete that request. Check your details and try again.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function requestVerification(email: string, captchaToken: string) {
    setAuthBusy(true)
    setAuthError('')
    setAuthNotice('')
    try {
      const result = await accountApiRequest<{ message: string }>(sessionId, '/verification/send', 'POST', { email, captchaToken })
      setAuthNotice(`${result.message} In local development, check the API terminal for a test link.`)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'We could not send a verification link. Try again shortly.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function verifyEmail(token: string) {
    setAuthBusy(true)
    setAuthError('')
    setAuthNotice('')
    try {
      const result = await accountApiRequest<{ user: AccountUser }>(sessionId, '/verification/confirm', 'POST', { token })
      setAuthUser(result.user)
      await restoreAccountTrip()
      navigate('#/welcome')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'That verification link could not be used. Request a new one.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function requestPasswordReset(email: string, captchaToken: string) {
    setAuthBusy(true)
    setAuthError('')
    setAuthNotice('')
    try {
      const result = await accountApiRequest<{ message: string }>(sessionId, '/password-reset/request', 'POST', { email, captchaToken })
      setAuthNotice(`${result.message} In local development, check the API terminal for a test link.`)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'We could not request a password reset. Try again shortly.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function resetPassword(token: string, password: string) {
    setAuthBusy(true)
    setAuthError('')
    setAuthNotice('')
    try {
      await accountApiRequest<{ reset: boolean }>(sessionId, '/password-reset/confirm', 'POST', { token, password })
      setAuthNotice('Your password has been changed. Sign in with the new password.')
      navigate('#/login')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'We could not reset your password. Request a fresh link and try again.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function deleteAccount(password: string) {
    setAuthBusy(true)
    setAuthError('')
    try {
      await accountApiRequest<{ deleted: boolean }>(sessionId, '/me', 'DELETE', { password })
      skipLocalMigration.current = true
      setAuthUser(null)
      setPickedIds([])
      setSavedTrip(null)
      setDestinations([...destinationSeed])
      setStartDate('')
      setEndDate('')
      setTravelNote('')
      setSessionId(createPlannerSessionId())
      navigate('#/account-deleted')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'We could not delete the account. Your data has not been removed.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function logout() {
    setAuthBusy(true)
    setAuthError('')
    try {
      await accountApiRequest<{ loggedOut: boolean }>(sessionId, '/logout', 'POST')
      skipLocalMigration.current = true
      setAuthUser(null)
      setPickedIds([])
      setSavedTrip(null)
      setDestinations([...destinationSeed])
      setStartDate('')
      setEndDate('')
      setDays(5)
      setTravelers(2)
      setBudget('Comfortable')
      setTransport('Train & local transit')
      setStayStyle('Guesthouse or homestay')
      setTravelNote('')
      setSessionId(createPlannerSessionId())
      navigate('#/signed-out')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'We could not sign you out. Try again.')
    } finally {
      setAuthBusy(false)
    }
  }

  function toggleDestination(id: string) {
    setPickedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
    setNotice('')
  }

  function addCustomDestination() {
    const name = query.trim()
    if (!name) return
    const existing = destinations.find((destination) => `${destination.city}, ${destination.country}`.toLowerCase() === name.toLowerCase() || destination.city.toLowerCase() === name.toLowerCase())
    if (existing) {
      toggleDestination(existing.id)
      setQuery('')
      return
    }
    const id = `custom-${Date.now()}`
    const newDestination: Destination = {
      id,
      city: name,
      country: route.page === 'places' ? 'India' : 'Your own discovery',
      region: route.page === 'places' ? 'India · Your own stop' : 'Somewhere new',
      category: route.page === 'places' ? 'Culture' : 'Slow living',
      image: fallbackTravelImage,
      note: 'Make this one yours',
      from: 'Choose your own pace',
      location: route.page === 'places' ? `${name}, India` : name,
      moments: ['Arrive and find your bearings', 'Follow a local recommendation', 'Leave room for a happy detour'],
    }
    setDestinations((current) => [newDestination, ...current])
    setPickedIds((current) => [...current, id])
    setQuery('')
    setNotice(`${name} added to your route.`)
  }

  async function buildItinerary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!picked.length) {
      setNotice('Choose a place first, then your itinerary will come together here.')
      navigate('#/places')
      return
    }
    const itinerary = Array.from({ length: days }, (_, index) => {
      const place = picked[index % picked.length]
      const momentIndex = Math.floor(index / picked.length) % place.moments.length
      const date = formatDay(startDate, index)
      return {
        day: index + 1,
        date,
        place: `${place.city}, ${place.country}`,
        morning: index === 0 ? `Arrive slowly in ${place.city}` : place.moments[momentIndex],
        afternoon: place.moments[(momentIndex + 1) % place.moments.length],
        evening: place.moments[(momentIndex + 2) % place.moments.length],
      }
    })
    const nextTrip: SavedTrip = {
      destinationNames: picked.map((destination) => destination.city),
      routeDestinations: picked,
      days,
      travelers,
      budget,
      transport,
      stayStyle,
      travelNote,
      startDate,
      endDate,
      itinerary,
      savedAt: new Date().toISOString(),
    }
    setSavedTrip(nextTrip)
    setNotice('Saving your first-draft itinerary…')
    try {
      await plannerApiRequest(sessionId, 'PUT', { trip: nextTrip, selectedIds: picked.map((destination) => destination.id) })
      setBackendStatus('connected')
      setNotice('Your itinerary is saved to the trip database and this device.')
    } catch {
      setBackendStatus('offline')
      setNotice('The backend is unavailable. Your itinerary is still saved on this device.')
    }
  }

  async function clearTrip() {
    setPickedIds([])
    setSavedTrip(null)
    setNotice('Your route is clear. Add a place when inspiration strikes.')
    if (backendStatus === 'connected') {
      try {
        await plannerApiRequest(sessionId, 'DELETE')
      } catch {
        setBackendStatus('offline')
        setNotice('Your route is cleared on this device, but the backend could not be reached.')
      }
    }
  }

  return (
    <div className="site-shell" id="top">
      <SiteHeader page={route.page} userEmail={authUser?.email ?? null} />
      {route.page === 'home' && <SculptureHero
        src={heroImage}
        darkSrc={heroImage}
        mobileSrc={heroImage}
        mobileDarkSrc={heroImage}
        imageAlt="A mountain valley in India"
        brand="Himvoya /"
        navLinks={[]}
        showNav={false}
        navCta={{ label: 'Start planning', href: '#/planner' }}
        eyebrow="A little more you, a little less itinerary"
        headline={'India is\nwaiting for you.'}
        headlineAccent="waiting"
        body="Take the mountain road, catch a little train, find a trail, or stay by the sea. Plan India your way, one good stop at a time."
        primaryCta={{ label: 'Plan your India trip', href: '#/planner' }}
        secondaryCta={{ label: 'Explore India', href: '#/places' }}
        background="#f7f5ee"
        darkBackground="#183b3b"
        textColor="#203b3b"
        accentColor="#c58a43"
        height="min(860px, 100svh)"
        sculptureScale={0.92}
        mobileSculptureScale={1.15}
        sculptureY={-4}
        particleDensity={0.72}
        strength={0.9}
        radius={250}
        liquid={0.75}
        turbulence={0.7}
        intro
        backdropText="SOMEWHERE"
      />}

      <main>
        {(route.page === 'home' || route.page === 'about') && <section className="intro-strip" id="about">
          <div className="intro-copy">
            <span className="eyebrow"><span className="eyebrow-mark" />A good way to see India</span>
            <h2>Take the long way.<br /><em>Keep the good bits.</em></h2>
          </div>
          <p className="intro-description">From Himalayan drives and heritage trains to coastal days, local food, temples, city walks, and quiet backwaters, bring your whole trip into one thoughtful plan.</p>
          <a className="round-link" href="#/planner" aria-label="Go to trip planner"><ArrowDown size={19} strokeWidth={1.6} /></a>
        </section>}

        {route.page === 'about' && <section className="about-content">
          <div><span className="eyebrow"><span className="eyebrow-mark" />One place to bring it together</span><h2>Plan the journey.<br /><em>Leave room to wander.</em></h2></div>
          <div className="about-feature-grid">
            <article><CarFront size={20} /><span>01 · GETTING THERE</span><h3>Roads & rides</h3><p>Build a route around hill drives, local transfers, and the scenic stretches between places. Check live road and weather conditions before you leave.</p></article>
            <article><TrainFront size={20} /><span>02 · THE JOURNEY</span><h3>Trains & connections</h3><p>Keep heritage train rides and rail connections in the plan, then verify schedules and tickets with the official railway before travel.</p></article>
            <article><Footprints size={20} /><span>03 · OUT THERE</span><h3>Trails & small discoveries</h3><p>Find trekking ideas, local food, markets, landmarks, and day trips. Use local guides and current visitor advice for conditions and access.</p></article>
          </div>
          <div className="about-explore-links"><a href="#/places">Explore India <ArrowRight size={15} /></a><a href="#/world">Explore the world <ArrowRight size={15} /></a><a href="#/planner">Open trip planner <ArrowRight size={15} /></a></div>
        </section>}

        {(route.page === 'places' || route.page === 'world') && <section className={`discover-section ${route.page === 'world' ? 'world-discover-section' : ''}`} id={route.page === 'world' ? 'world-destinations' : 'destinations'}>
          <div className="section-head">
            <div>
              <div className="section-kicker"><span>{route.page === 'world' ? '02' : '01'}</span><span className="section-rule" />{route.page === 'world' ? 'Beyond India' : 'India, at your pace'}</div>
              <h2>{route.page === 'world' ? <>The wider <em>world.</em></> : <>Find your <em>India.</em></>}</h2>
              <p className="section-subtitle">{route.page === 'world' ? 'Search cities around the world, or browse a few faraway favorites.' : 'Hill roads, heritage railways, trails, coastlines, and places worth slowing down for.'}</p>
            </div>
            <label className="search-box">
              <Search size={17} strokeWidth={1.7} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search places or feelings" aria-label="Search destinations" />
              {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button>}
            </label>
          </div>

          {(route.page === 'world' || route.page === 'places') && <div className={`world-search-panel ${route.page === 'places' ? 'india-search-panel' : ''}`}>
            <div className="world-search-copy"><span className="section-kicker"><span>SEARCH</span><span className="section-rule" />{route.page === 'world' ? 'Places across the globe' : 'Places across India'}</span><h3>{route.page === 'world' ? 'Where would you like to go?' : 'Find a place anywhere in India.'}</h3><p>{route.page === 'world' ? 'Search worldwide cities and towns to see photo previews, then open a guide and add a place to your trip.' : 'Search Indian cities and towns beyond the featured guide collection to see photo previews and open a place guide.'}</p></div>
            <form className="world-search-form" onSubmit={(event) => { void searchWorldPlaces(event) }}>
              <label className="world-query"><Search size={18} /><input value={worldQuery} onChange={(event) => setWorldQuery(event.target.value)} placeholder={route.page === 'world' ? 'Try Kyoto, Nairobi, Lima…' : 'Try Varanasi, Coorg, Jaisalmer…'} aria-label={route.page === 'world' ? 'Search worldwide cities and towns' : 'Search Indian cities and towns'} /></label>
              <button type="submit" disabled={worldSearchBusy}><span>{worldSearchBusy ? 'Searching…' : route.page === 'world' ? 'Search the world' : 'Search India'}</span><ArrowRight size={16} /></button>
            </form>
            <p className="world-attribution">Location data from <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>, based on <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a>.</p>
            {worldSearchError && <p className="world-search-error" role="status">{worldSearchError}</p>}
            {worldPlaces.filter((place) => route.page === 'places' ? place.country === 'India' : place.country !== 'India').length > 0 && <div className="world-results-grid">
              {worldPlaces.filter((place) => route.page === 'places' ? place.country === 'India' : place.country !== 'India').map((place) => <article className="world-result-card" key={place.id}>
                <button className="world-result-photo" type="button" onClick={() => { void addWorldPlace(place) }} disabled={addingPlaceId === place.id} aria-label={`Open the ${place.city} place guide`}>
                  <img src={place.photos?.[0]?.src || fallbackTravelImage} alt={`${place.city} destination`} loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = fallbackTravelImage }} />
                  <span>{addingPlaceId === place.id ? 'Opening guide…' : place.photosLoading ? 'Finding a place photo…' : 'Open place guide'} <ArrowUpRight size={13} /></span>
                </button>
                <div className="world-result-mark"><MapPin size={16} /><span>{place.country}</span></div>
                <div className="world-result-content"><span>{place.region || place.country}</span><h4>{place.city}</h4><p>{place.location}</p><small>{place.timezone ? `Local time zone · ${place.timezone}` : 'Location found worldwide'}</small>{place.photos?.[0] && <a className="world-photo-credit" href={place.photos[0].url} target="_blank" rel="noreferrer">Photo: {place.photos[0].label}</a>}</div>
                <button type="button" onClick={() => { void addWorldPlace(place) }} disabled={addingPlaceId === place.id}>
                  {addingPlaceId === place.id ? 'Loading place…' : pickedIds.includes(place.id) ? 'View trip place' : 'Add place & photos'} <ArrowRight size={14} />
                </button>
              </article>)}
              {worldPlaces.every((place) => route.page === 'places' ? place.country !== 'India' : place.country === 'India') && <p className="world-search-error">No {route.page === 'places' ? 'Indian' : 'foreign'} matches in these results. Try another nearby city.</p>}
            </div>}
          </div>}

          <div className="category-row" role="group" aria-label="Filter destinations by feeling">
            {categories.map((item) => (
              <button key={item} type="button" className={`category-pill ${category === item ? 'active' : ''}`} onClick={() => setCategory(item)} aria-pressed={category === item}>
                {item}
              </button>
            ))}
            <span className="destination-count">{filteredDestinations.length} {route.page === 'world' ? 'international places' : 'India places'}</span>
          </div>

          {filteredDestinations.length > 0 ? (
            <div className="destination-grid">
              {filteredDestinations.map((destination, index) => {
                const isPicked = pickedIds.includes(destination.id)
                return (
                  <article className={`destination-card destination-card-${index % 3}`} key={destination.id}>
                    <div className="destination-visual">
                      <a className="destination-photo" href={`#/place/${encodeURIComponent(destination.id)}`} style={{ backgroundImage: `url("${destination.image}"), url("${fallbackTravelImage}")` }} aria-label={`Open the ${destination.city}, ${destination.country} travel guide`}>
                        <div className="photo-shade" />
                        <span className="destination-category">{destination.category}</span>
                        <div className="destination-photo-copy">
                          <span>{destination.region}</span>
                          <h3>{destination.city}</h3>
                          <p>{destination.country}</p>
                        </div>
                        <span className="destination-open-cue"><ArrowUpRight size={14} /> View place guide</span>
                      </a>
                      <button className={`add-place ${isPicked ? 'is-picked' : ''}`} type="button" onClick={() => toggleDestination(destination.id)} aria-label={isPicked ? `Remove ${destination.city} from trip` : `Add ${destination.city} to trip`} aria-pressed={isPicked}>
                        {isPicked ? <Check size={17} /> : <Plus size={18} />}
                      </button>
                    </div>
                    <div className="destination-meta">
                      <span>{destination.note}</span>
                      <span className="meta-days">{destination.from}</span>
                    </div>
                    <button className="destination-guide-link" type="button" onClick={() => navigate(`#/place/${encodeURIComponent(destination.id)}`)}>
                      <span><MapPin size={13} />{destination.location || `${destination.city}, ${destination.country}`}</span>
                      <strong>Explore place guide <ArrowUpRight size={14} /></strong>
                    </button>
                  </article>
                )
              })}
              {route.page === 'places' && query.trim() && !destinations.some((destination) => destination.city.toLowerCase() === query.trim().toLowerCase()) && (
                <button className="custom-place-card" type="button" onClick={addCustomDestination}>
                  <span className="custom-icon"><Plus size={18} /></span>
                  <span className="custom-label">Take the road less known</span>
                  <strong>Add “{query.trim()}”</strong>
                  <span className="custom-hint">Make your own stop</span>
                </button>
              )}
            </div>
          ) : (
            <div className="no-results"><Compass size={22} /><p>No places found for that search yet.</p><button type="button" onClick={addCustomDestination}>Add it to your route <ArrowRight size={15} /></button></div>
          )}
          <div className="discover-note"><span className="note-line" />Every place is a starting point, never a checklist.<span className="note-line" /></div>
          {route.page === 'places' && <div className="india-experience-strip"><span>Pick your kind of journey</span><a href="#/places">India</a><a href="#/world">Foreign places <ArrowUpRight size={14} /></a><a href="#/planner">Your shared trip planner <ArrowUpRight size={14} /></a></div>}
        </section>}

        {route.page === 'planner' && <section className="planner-section" id="planner">
          <div className="planner-heading">
            <div>
              <div className="section-kicker"><span>02</span><span className="section-rule" />Make it yours</div>
              <h2>Your trip, <em>your tempo.</em></h2>
              <p className="section-subtitle">Gather a few good places. We’ll sketch the days in between.</p>
            </div>
            <div className="planner-stamp"><Compass size={18} /><span>Made for wandering</span><span className={`backend-badge ${backendStatus}`}><span />{backendStatus === 'connected' ? 'Backend connected' : backendStatus === 'connecting' ? 'Connecting' : 'Local mode'}</span></div>
          </div>

          <div className="planner-layout">
            <form className="planner-form" onSubmit={buildItinerary}>
              <div className="form-topline"><span className="form-step">A</span><div><h3>Choose your pace</h3><p>Start with the shape of the trip.</p></div></div>
              <div className="form-grid">
                <label className="field field-date">
                  <span><CalendarDays size={15} /> Leaving</span>
                  <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} aria-label="Departure date" />
                </label>
                <label className="field field-date">
                  <span><CalendarDays size={15} /> Coming back</span>
                  <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} aria-label="Return date" min={startDate || undefined} />
                </label>
                <label className="field field-select">
                  <span><Sparkles size={15} /> Days away</span>
                  <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
                    {[3, 4, 5, 6, 7, 8, 9, 10, 12, 14].map((day) => <option key={day} value={day}>{day} days</option>)}
                  </select>
                </label>
                <label className="field field-select">
                  <span><Heart size={15} /> Trip budget</span>
                  <select value={budget} onChange={(event) => setBudget(event.target.value)}>
                    <option>Budget-friendly</option>
                    <option>Comfortable</option>
                    <option>A little treat</option>
                  </select>
                </label>
                <label className="field field-select">
                  <span><TrainFront size={15} /> Getting around</span>
                  <select value={transport} onChange={(event) => setTransport(event.target.value)}>
                    <option>Train & local transit</option>
                    <option>Road trip</option>
                    <option>Flights & transfers</option>
                    <option>Bus & shared rides</option>
                    <option>Walk & cycle</option>
                  </select>
                </label>
                <label className="field field-select">
                  <span><MapPin size={15} /> Stay style</span>
                  <select value={stayStyle} onChange={(event) => setStayStyle(event.target.value)}>
                    <option>Guesthouse or homestay</option>
                    <option>Hotel</option>
                    <option>Hostel</option>
                    <option>Resort</option>
                    <option>Mix of stays</option>
                  </select>
                </label>
              </div>
              <label className="trip-notes-field"><span>Little details to remember</span><textarea value={travelNote} onChange={(event) => setTravelNote(event.target.value)} maxLength={500} placeholder="A food stop, a must-see, a note for later…" rows={2} /></label>

              <div className="travelers-row">
                <div className="traveler-label"><Users size={16} /><span>Who’s coming</span><small>Little ones count too</small></div>
                <div className="stepper" aria-label="Number of travelers">
                  <button type="button" onClick={() => setTravelers((value) => Math.max(1, value - 1))} aria-label="Remove one traveler" disabled={travelers <= 1}><Minus size={14} /></button>
                  <strong>{travelers}</strong>
                  <button type="button" onClick={() => setTravelers((value) => Math.min(12, value + 1))} aria-label="Add one traveler" disabled={travelers >= 12}><Plus size={14} /></button>
                </div>
              </div>

              <div className="selected-stops">
                <div className="stops-heading"><div><span className="form-step">B</span><div><h3>Your places</h3><p>{picked.length ? `${picked.length} stop${picked.length === 1 ? '' : 's'} in the making` : 'A route with room to breathe'}</p></div></div><div className="planner-explore-links"><a href="#/places">Explore India <ArrowUpRight size={14} /></a><a href="#/world">Foreign places <ArrowUpRight size={14} /></a></div></div>
                {picked.length ? (
                  <ul className="stop-list">
                    {picked.map((destination, index) => (
                      <li key={destination.id}>
                        <span className="stop-number">{String(index + 1).padStart(2, '0')}</span>
                        <img src={destination.image} alt="" />
                        <a className="stop-name" href={`#/place/${encodeURIComponent(destination.id)}`}><strong>{destination.city}</strong><small>{destination.country}</small></a>
                        <button type="button" className="remove-stop" onClick={() => toggleDestination(destination.id)} aria-label={`Remove ${destination.city}`}><X size={15} /></button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <a className="empty-stops" href="#/places"><span className="empty-pin"><MapPin size={17} /></span><span>Pick the first dot on your map</span><ArrowRight size={15} /></a>
                )}
              </div>

              <button className="build-button" type="submit" disabled={backendStatus === 'connecting'}><span>{backendStatus === 'connecting' ? 'Connecting to planner…' : 'Sketch my itinerary'}</span><ArrowRight size={17} /></button>
              {notice && <p className="form-notice" role="status">{notice}</p>}
              <p className="form-footnote">{backendStatus === 'connected' ? 'Your first draft is stored in the trip database and on this device.' : 'Your first draft is saved on this device until the backend is available.'}</p>
            </form>

            <aside className="itinerary-card" aria-live="polite">
              <div className="itinerary-top">
                <div className="itinerary-topline"><span>YOUR TRAVEL NOTES</span><span className="spark-dot" /></div>
                {savedTrip ? (
                  <>
                    <h3>{savedTrip.destinationNames.map((name, index) => <span key={`${name}-${index}`}>{index > 0 && <i> → </i>}{name}</span>)}</h3>
                    <p>{[formatDate(savedTrip.startDate), formatDate(savedTrip.endDate)].filter(Boolean).join(' — ')}{savedTrip.startDate || savedTrip.endDate ? ' · ' : ''}{savedTrip.days} days <span>·</span> {savedTrip.travelers} traveler{savedTrip.travelers === 1 ? '' : 's'} <span>·</span> {savedTrip.budget}</p>
                    <p className="trip-logistics-summary">{savedTrip.transport || 'Choose transport'} <span>·</span> {savedTrip.stayStyle || 'Choose a stay style'}</p>
                    {savedTrip.travelNote && <p className="trip-saved-note">“{savedTrip.travelNote}”</p>}
                  </>
                ) : (
                  <>
                    <h3>The best plans<br />leave <em>room for wonder.</em></h3>
                    <p>Your first-draft itinerary will find a home here.</p>
                  </>
                )}
              </div>
              {savedTrip ? (
                <div className="itinerary-list">
                  {savedTrip.itinerary.slice(0, 4).map((day) => {
                    const dayPlace = savedTrip.routeDestinations?.find((destination) => day.place.toLowerCase().includes(destination.city.toLowerCase()))
                    return <article className="day-row" key={day.day}>
                      <div className="day-number"><span>DAY</span><strong>{String(day.day).padStart(2, '0')}</strong></div>
                      {dayPlace ? <a className="day-place-link" href={`#/place/${encodeURIComponent(dayPlace.id)}`}><img className="day-place-image" src={dayPlace.image} alt={`${dayPlace.city} trip`} loading="lazy" /></a> : <span className="day-place-placeholder"><MapPin size={14} /></span>}
                      <div className="day-copy"><div className="day-date"><strong>{day.date}</strong>{dayPlace ? <a href={`#/place/${encodeURIComponent(dayPlace.id)}`}><MapPin size={12} />{day.place}</a> : <span><MapPin size={12} />{day.place}</span>}</div><p>{day.morning}</p><small>{day.afternoon}</small></div>
                    </article>
                  })}
                  {savedTrip.days > 4 && <p className="more-days">+ {savedTrip.days - 4} more easy-going days</p>}
                  <div className="saved-actions"><span><Check size={14} /> {backendStatus === 'connected' ? 'Saved to your trip database' : 'Saved on this device'}</span><button type="button" onClick={clearTrip} disabled={backendStatus === 'connecting'}>Clear trip</button></div>
                </div>
              ) : (
                <div className="itinerary-empty">
                  <div className="route-art" aria-hidden="true"><span className="route-orbit orbit-one" /><span className="route-orbit orbit-two" /><span className="route-dot dot-one"><MapPin size={14} /></span><span className="route-dot dot-two"><MapPin size={14} /></span><span className="route-dot dot-three"><MapPin size={14} /></span><span className="route-plane">✳</span></div>
                  <div className="empty-card-note"><span>01 — 04</span><strong>Slow mornings, open afternoons.</strong><p>We’ll gather a few thoughtful ideas around the places you choose.</p></div>
                </div>
              )}
              <div className="card-footer"><span><MapPin size={13} /> Anywhere, at your pace</span><span>HIMVOYA / FIELD NOTES</span></div>
            </aside>
          </div>
        </section>}

        {route.page === 'home' && <section className="home-quick-links">
          <div className="quick-link-intro"><span className="eyebrow"><span className="eyebrow-mark" />Where to next?</span><h2>A journey with<br /><em>your name on it.</em></h2></div>
          <a href="#/places" className="quick-link-card india-card"><span>01 · START IN INDIA</span><strong>Find your route</strong><small>Drive · train · trek · coast</small><ArrowUpRight size={17} /></a>
          <a href="#/world" className="quick-link-card world-card"><span>02 · GO FURTHER</span><strong>See the world</strong><small>Search cities around the globe</small><ArrowUpRight size={17} /></a>
          <a href="#/planner" className="quick-link-card planner-card"><span>03 · MAKE IT YOURS</span><strong>Plan the details</strong><small>Dates · pace · places · notes</small><ArrowUpRight size={17} /></a>
        </section>}

        {route.page === 'home' && <section className="closing-note">
          <div className="closing-asterisk">✳</div>
          <p>Take the scenic route.<br /><em>It’s usually the point.</em></p>
          <a href="#/planner">Start planning <ArrowRight size={15} /></a>
        </section>}

        {route.page === 'place' && placeDetail && <DestinationGuide destination={placeDetail} isPicked={pickedIds.includes(placeDetail.id)} onClose={closePlaceGuide} onToggle={() => toggleDestination(placeDetail.id)} page />}
        {route.page === 'place' && !placeDetail && <section className="page-not-found"><Compass size={28} /><h2>That place is not on your map yet.</h2><a href="#/places">Explore India <ArrowRight size={14} /></a><a href="#/world">Search the world <ArrowRight size={14} /></a></section>}
        {route.page === 'not-found' && <section className="page-not-found"><Compass size={28} /><span className="section-kicker">404 · OFF THE MAP</span><h2>This page took a different turn.</h2><p>That address doesn’t lead to a Himvoya page. Choose a new direction.</p><a href="#/">Back to home <ArrowRight size={14} /></a><a href="#/places">Explore India <ArrowRight size={14} /></a><a href="#/world">See foreign places <ArrowRight size={14} /></a></section>}
        {route.page === 'onboarding' && <OnboardingPage email={authUser?.email ?? null} onNavigate={navigate} />}
        {route.page === 'privacy' && <PrivacyPage />}
        {route.page === 'terms' && <TermsPage />}
        {['verify-email', 'forgot-password', 'reset-password'].includes(route.page) && <AccountActionPage mode={route.page as AccountActionMode} token={route.token} initialEmail={route.email} captchaSiteKey={captchaConfig.siteKey} captchaRequired={captchaConfig.required} captchaLoading={captchaConfig.loading} busy={authBusy} error={authError} notice={authNotice} onVerify={(token) => { void verifyEmail(token) }} onResendVerification={(email, captchaToken) => { void requestVerification(email, captchaToken) }} onRequestReset={(email, captchaToken) => { void requestPasswordReset(email, captchaToken) }} onResetPassword={(token, password) => { void resetPassword(token, password) }} />}
        {['login', 'register', 'account', 'signed-out', 'account-deleted'].includes(route.page) && <AuthPage mode={route.page === 'account-deleted' ? 'signed-out' : route.page === 'account' && !authUser ? 'login' : route.page as AuthMode} email={authUser?.email ?? null} error={authError} notice={authNotice} captchaSiteKey={captchaConfig.siteKey} captchaRequired={captchaConfig.required} captchaLoading={captchaConfig.loading} accountDeleted={route.page === 'account-deleted'} busy={authBusy} onAuthenticate={(mode, email, password, captchaToken) => { void authenticate(mode, email, password, captchaToken) }} onLogout={() => { void logout() }} onDeleteAccount={(password) => { void deleteAccount(password) }} />}
      </main>

      {!['login', 'register', 'account', 'signed-out', 'account-deleted'].includes(route.page) && <footer className="site-footer"><a href="#/" className="footer-brand">Himvoya /</a><span>India, your way. The world, when you’re ready.</span><a href="#/privacy" className="footer-privacy">Privacy & database</a><a href="#/terms" className="footer-privacy">Terms</a><a href="#/planner">Make a plan <ArrowUpRight size={14} /></a></footer>}
    </div>
  )
}

export default App
