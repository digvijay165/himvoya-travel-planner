// Regenerates the README screenshots in docs/screenshots.
// Usage: npm run build && node scripts/screenshots.mjs [path-to-chrome-or-edge]
// Starts a throwaway server on a temporary database, drives headless Chrome over the DevTools protocol, then cleans up.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'docs', 'screenshots')
const PORT = 4186
const DEBUG_PORT = 9334
const BASE = `http://127.0.0.1:${PORT}`
const CHROME = process.argv[2] || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find(file => fs.existsSync(file))

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'himvoya-shots-'))

async function waitFor(url) {
  for (let i = 0; i < 100; i++) {
    try { const response = await fetch(url); if (response.ok) return response } catch (error) { if (i === 99) console.error(error.cause || error) }
    await wait(150)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

function connect(wsUrl) {
  const socket = new WebSocket(wsUrl)
  let id = 0
  const pending = new Map()
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id)
      pending.delete(message.id)
      message.error ? reject(new Error(message.error.message)) : resolve(message.result)
    }
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const messageId = ++id
    pending.set(messageId, { resolve, reject })
    socket.send(JSON.stringify({ id: messageId, method, params }))
  })
  return new Promise(resolve => socket.addEventListener('open', () => resolve({ send, close: () => socket.close() })))
}

async function main() {
  if (!CHROME) throw new Error('Chrome or Edge not found. Pass its path as the first argument.')
  if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) throw new Error('Run `npm run build` first.')
  fs.mkdirSync(OUT, { recursive: true })
  const server = spawn(process.execPath, ['server.mjs'], {
    cwd: ROOT, stdio: 'ignore',
    env: { ...process.env, PORT: String(PORT), ROAM_DB_PATH: path.join(temp, 'shots.sqlite'), ROAM_PUBLIC_URL: BASE },
  })
  const browser = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${path.join(temp, 'profile')}`, '--hide-scrollbars', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' })
  try {
    await waitFor(`${BASE}/api/health`)
    const targets = await (await waitFor(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json()
    const page = await connect(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
    await page.send('Page.enable')
    await page.send('Runtime.enable')

    const size = (width, height, mobile = false) => page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: mobile ? 2 : 1.5, mobile })
    const run = async expression => {
      const result = await page.send('Runtime.evaluate', { expression: `(async () => { ${expression} })()`, awaitPromise: true, returnByValue: true })
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
      return result.result.value
    }
    // Waits for the route to render and its images to finish loading.
    const go = async (hash, settle = 2500) => {
      await page.send('Page.navigate', { url: `${BASE}/${hash}` })
      await wait(1200)
      await run(`for (let i = 0; i < 60; i++) { if ([...document.images].every(img => img.complete)) break; await new Promise(r => setTimeout(r, 250)) }`)
      await wait(settle)
    }
    const scrollTo = selector => run(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({ block: 'start' }); window.scrollBy(0, -12); await new Promise(r => setTimeout(r, 1500))`)
    const shot = async name => {
      const { data } = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 84 })
      fs.writeFileSync(path.join(OUT, `${name}.jpg`), Buffer.from(data, 'base64'))
      console.log(`saved docs/screenshots/${name}.jpg`)
    }

    await size(1440, 900)
    await go('#/', 5000)
    await shot('home')
    await go('#/places')
    await scrollTo('.destination-grid')
    await run(`window.scrollBy(0, -150)`)
    await shot('india')
    await go('#/place/munnar', 4000)
    await shot('guide')
    await go('#/place/kashmir-great-lakes', 4000)
    await shot('trek')
    await go('#/places')
    await run(`document.querySelector('[data-category="Trek & trails"].category-pill')?.click()`)
    await run(`const row = document.querySelector('.category-row'); window.scrollTo({ top: row.getBoundingClientRect().top + window.scrollY - 110, behavior: 'instant' }); await new Promise(r => setTimeout(r, 3000))`)
    await shot('treks')
    await go('#/world')
    await shot('world')
    await go('#/planner')
    await shot('planner')
    await go('#/login')
    await shot('sign-in')

    await size(390, 844, true)
    await go('#/', 5000)
    await shot('mobile-home')
    await go('#/place/goa', 4000)
    await shot('mobile-guide')
    page.close()
  } finally {
    browser.kill()
    server.kill()
    await wait(500)
    fs.rmSync(temp, { recursive: true, force: true, maxRetries: 5 })
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
