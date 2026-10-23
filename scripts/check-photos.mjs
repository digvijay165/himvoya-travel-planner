// Checks that every guide photo in src/data/place-photos.ts loads, and warms Wikimedia's thumbnail cache.
// Usage: node scripts/check-photos.mjs
// Wikimedia renders a thumbnail size the first time it is requested and may answer 429 meanwhile,
// so each URL is fetched slowly and retried. Run it after adding photos, before deploying.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = fs.readFileSync(path.join(ROOT, 'src', 'data', 'place-photos.ts'), 'utf8')
const headers = { 'User-Agent': 'HimvoyaPhotoCheck/1.0 (https://github.com/digvijay165/himvoya-travel-planner)' }
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

const commons = [...source.matchAll(/src: '([^']+)'/g)].map(match => match[1])
const unsplash = [...source.matchAll(/'(photo-\d+-[0-9a-f]+)'/g)].map(match => `https://images.unsplash.com/${match[1]}?auto=format&fit=crop&w=1400&q=85`)
const urls = [...new Set([...commons.flatMap(url => [url, url.replace('/1280px-', '/330px-')]), ...unsplash])]

async function check(url) {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const response = await fetch(url, { headers })
      await response.arrayBuffer()
      if (response.ok) return 'ok'
      if (response.status !== 429 && response.status < 500) return response.status
    } catch (error) {
      if (attempt === 5) return error.message
    }
    await wait(3000 * (attempt + 1))
  }
  return 'gave up'
}

let failed = 0
for (const [index, url] of urls.entries()) {
  const result = await check(url)
  if (result !== 'ok') {
    failed++
    console.log(`FAIL ${result} ${url}`)
  }
  if (index % 50 === 49) console.log(`checked ${index + 1} of ${urls.length}`)
  await wait(400)
}
console.log(`${urls.length - failed} of ${urls.length} photos load`)
process.exitCode = failed ? 1 : 0
