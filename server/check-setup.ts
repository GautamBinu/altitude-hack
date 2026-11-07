import { existsSync } from 'node:fs'
import { config } from './config'
import { looksLikeGoogleClientId } from './domain/google'
import { suggest } from './domain/mood'
import { buildPrompt, parseModelReply } from './domain/moodModel'
import { ensureSeeded } from './seed'
import { askModel, describeModel, modelAvailable } from './services/llm'
import { loadMoodItems } from './services/mood'

/*
 * npm run check:setup ["something to ask the mood suggester"]
 *
 * Reads .env the same way the server does and says what works. It makes one real call to the model if a key
 * is set, so a wrong key or model name shows up here and not in front of a customer. Keys are never printed.
 */

const line = (label: string, value: string) => console.log(`  ${label.padEnd(22)}${value}`)
const text = process.argv.slice(2).join(' ').trim() || 'rainy, tired, need something sweet but not heavy'

console.log('\nAltitude setup check\n')
line('.env file', existsSync('.env') ? 'found' : 'NOT FOUND. Copy .env.example to .env and fill it in.')

console.log('\nGoogle sign-in')
if (!config.googleClientId) {
  line('GOOGLE_CLIENT_ID', 'not set. The Google button will not show; demo sign-in still works if DEMO_MODE=true.')
} else if (!looksLikeGoogleClientId(config.googleClientId)) {
  line('GOOGLE_CLIENT_ID', 'set, but it does not look right. It should end in .apps.googleusercontent.com')
} else {
  line('GOOGLE_CLIENT_ID', `looks right (${config.googleClientId.slice(0, 12)}...${config.googleClientId.slice(-30)})`)
  line('', 'In Google Cloud Console, Credentials, open this client and list these under')
  line('', 'Authorised JavaScript origins (no path, no trailing slash):')
  line('', `  http://localhost:5173   (when you run npm run dev)`)
  line('', `  http://localhost:${config.port}   (when the built app is served by the server)`)
  line('', '  https://your-deployed-site   (when you deploy)')
}
line('Allowed email domains', config.allowedEmailDomains.length ? config.allowedEmailDomains.map((d) => '@' + d).join(', ') : 'any Google account')
line('Demo sign-in (DEMO_MODE)', config.demoMode ? 'on' : 'off')

console.log('\nMood suggester')
line('Answering with', describeModel())
ensureSeeded()
const items = loadMoodItems()
const local = suggest(text, items)
line('Test text', `"${text}"`)
line('Local scorer picks', local.picks.map((p) => items.find((i) => i.id === p.itemId)?.name).join(', '))

if (!modelAvailable()) {
  console.log('\n  No model key set, so only the local scorer is used. To turn the model on, add GEMINI_API_KEY to .env.\n')
  process.exit(0)
}

const started = Date.now()
try {
  const { system, user } = buildPrompt(items, text)
  const raw = await askModel(system, user)
  const picks = parseModelReply(raw, items)
  line('Model answered in', `${((Date.now() - started) / 1000).toFixed(1)} s`)
  if (picks.length === 0) {
    line('Result', 'the model replied, but nothing usable came back. The customer would get the local scorer.')
    line('Raw reply', raw.replace(/\s+/g, ' ').slice(0, 300))
    process.exit(1)
  }
  line('Model picks', '')
  for (const pick of picks) {
    const item = items.find((i) => i.id === pick.itemId)
    console.log(`    ${item?.name}${pick.temperature ? ` (${pick.temperature})` : ''}: ${pick.reason}`)
  }
  console.log('\n  The model is working.\n')
} catch (error) {
  line('Result', 'FAILED. Customers get the local scorer until this is fixed.')
  line('Reason', error instanceof Error ? error.message : String(error))
  console.log('')
  process.exit(1)
}
