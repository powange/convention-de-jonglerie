/**
 * Capture les logs console du navigateur en étant connecté EN TANT QU'un
 * utilisateur cible, via l'impersonation admin (mécanisme existant du projet).
 *
 * ⚠️ Outil de debug pour environnements de DEV uniquement. Nécessite un compte
 * global-admin de l'environnement visé. Ne jamais utiliser/committer de secrets.
 *
 * Variables d'environnement :
 *   BASE_URL          URL de base (def: https://dev.juggling-convention.com)
 *   ADMIN_IDENTIFIER  email ou pseudo du compte global-admin
 *   ADMIN_PASSWORD    mot de passe du compte global-admin
 *   TARGET            ID numérique OU email de l'utilisateur à impersonner
 *   PATHS             pages à visiter, séparées par des virgules
 *                     (def: /editions/22/my-tasks)
 *   LOCALE            locale forcée via cookie i18n_redirected (def: en)
 *   CHROME_PATH       exécutable chromium (def: cache ms-playwright 1217)
 *
 * Exemple :
 *   BASE_URL=https://dev.juggling-convention.com \
 *   ADMIN_IDENTIFIER=admin@exemple.fr ADMIN_PASSWORD='...' \
 *   TARGET=jean@exemple.fr PATHS=/editions/22/my-tasks \
 *   node scripts/dev-impersonate-console.mjs
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'https://dev.juggling-convention.com'
const ADMIN_ID = process.env.ADMIN_IDENTIFIER
const ADMIN_PW = process.env.ADMIN_PASSWORD
const TARGET = process.env.TARGET
// Mode "login direct" : si fourni, on se connecte directement en tant que TARGET
// (utile quand la cible est elle-même global-admin, l'impersonation étant interdite).
const TARGET_PASSWORD = process.env.TARGET_PASSWORD
const PATHS = (process.env.PATHS || '/editions/22/my-tasks').split(',').map((s) => s.trim())
const LOCALE = process.env.LOCALE || 'en'
const CHROME =
  process.env.CHROME_PATH ||
  '/home/powange/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome'

function fail(msg) {
  console.error(`❌ ${msg}`)
  process.exit(1)
}
if (!TARGET) fail('TARGET requis (ID numérique ou email de l’utilisateur cible).')
if (!TARGET_PASSWORD && (!ADMIN_ID || !ADMIN_PW))
  fail('ADMIN_IDENTIFIER + ADMIN_PASSWORD requis (mode impersonation), OU TARGET_PASSWORD (mode login direct).')

const browser = await chromium.launch({ headless: true, executablePath: CHROME })
const context = await browser.newContext({ ignoreHTTPSErrors: true, locale: `${LOCALE}-US` })
await context.addCookies([{ name: 'i18n_redirected', value: LOCALE, url: BASE }])
const api = context.request

// 0) GET initial pour que le serveur pose le cookie CSRF (Double Submit Cookie),
//    puis lecture du token à renvoyer en header `x-csrf-token` sur les POST.
await api.get(`${BASE}/`)
const cookies = await context.cookies(BASE)
const csrf = cookies.find((c) => c.name === 'csrf_token')?.value
if (!csrf) fail('Cookie csrf_token introuvable après le GET initial.')
const csrfHeader = { 'x-csrf-token': csrf }

if (TARGET_PASSWORD) {
  // MODE LOGIN DIRECT : connexion authentique en tant que TARGET.
  console.log(`→ Login direct en tant que "${TARGET}" sur ${BASE} ...`)
  const login = await api.post(`${BASE}/api/auth/login`, {
    headers: csrfHeader,
    data: { identifier: TARGET, password: TARGET_PASSWORD, rememberMe: false },
  })
  if (!login.ok()) fail(`Login direct échoué (HTTP ${login.status()}): ${await login.text()}`)
  console.log('  ✓ session ouverte en tant que la cible')
} else {
  // MODE IMPERSONATION : login admin -> résolution -> impersonate.
  console.log(`→ Login admin (${ADMIN_ID}) sur ${BASE} ...`)
  const login = await api.post(`${BASE}/api/auth/login`, {
    headers: csrfHeader,
    data: { identifier: ADMIN_ID, password: ADMIN_PW, rememberMe: false },
  })
  if (!login.ok()) fail(`Login admin échoué (HTTP ${login.status()}): ${await login.text()}`)

  let targetId = /^\d+$/.test(String(TARGET)) ? Number(TARGET) : null
  if (targetId === null) {
    console.log(`→ Résolution de l'utilisateur "${TARGET}" ...`)
    const res = await api.get(`${BASE}/api/admin/users?search=${encodeURIComponent(TARGET)}&limit=10`)
    if (!res.ok())
      fail(`Recherche utilisateur échouée (HTTP ${res.status()}). Le compte admin est-il bien global-admin ?`)
    const json = await res.json()
    const users = json?.data?.users || json?.users || json?.data || (Array.isArray(json) ? json : [])
    const match =
      users.find((u) => u.email?.toLowerCase() === String(TARGET).toLowerCase()) || users[0]
    if (!match) fail(`Aucun utilisateur trouvé pour "${TARGET}".`)
    targetId = match.id
    console.log(`  trouvé: id=${match.id} pseudo=${match.pseudo} email=${match.email}`)
  }

  console.log(`→ Impersonation de l'utilisateur id=${targetId} ...`)
  const imp = await api.post(`${BASE}/api/admin/users/${targetId}/impersonate`, {
    headers: csrfHeader,
  })
  if (!imp.ok())
    fail(
      `Impersonation échouée (HTTP ${imp.status()}): ${await imp.text()}\n` +
        `Astuce: si la cible est elle-même global-admin, utilise TARGET_PASSWORD pour un login direct.`
    )
  console.log('  ✓ session bascule sur l’utilisateur cible')
}

// 4) Visiter les pages et capturer la console
// Options : VERBOSE=1 capture aussi log/info/debug ; WAIT_MS (def 3500) ;
// WAIT_UNTIL (def domcontentloaded, ex. networkidle) ; SCREENSHOT_DIR pour
// enregistrer une capture d'écran par page.
const VERBOSE = process.env.VERBOSE === '1'
const WAIT_MS = Number(process.env.WAIT_MS || 3500)
const WAIT_UNTIL = process.env.WAIT_UNTIL || 'domcontentloaded'
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR
const CAPTURED = new Set(['error', 'warning', ...(VERBOSE ? ['log', 'info', 'debug'] : [])])

for (const path of PATHS) {
  const page = await context.newPage()
  const logs = []
  page.on('console', (m) => {
    const t = m.type()
    if (CAPTURED.has(t)) logs.push({ type: t, text: m.text() })
  })
  page.on('pageerror', (e) => logs.push({ type: 'pageerror', text: e.message }))
  page.on('requestfailed', (r) =>
    logs.push({ type: 'requestfailed', text: `${r.url()} — ${r.failure()?.errorText || '?'}` })
  )

  let status = '?'
  let title = ''
  try {
    const r = await page.goto(`${BASE}${path}`, { waitUntil: WAIT_UNTIL, timeout: 30000 })
    status = r ? r.status() : '?'
    await page.waitForTimeout(WAIT_MS)
    title = (await page.title().catch(() => '')) || ''
    if (SCREENSHOT_DIR) {
      const file = `${SCREENSHOT_DIR}/${path.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')}.png`
      await page.screenshot({ path: file, fullPage: true }).catch(() => {})
      console.log(`  📸 ${file}`)
    }
  } catch (e) {
    logs.push({ type: 'navfail', text: e.message })
  }

  console.log(
    `\n========== ${path} [HTTP ${status}] (URL: ${page.url()})${title ? ` — « ${title} »` : ''} ==========`
  )
  if (!logs.length) console.log(`  ✓ aucun ${VERBOSE ? 'log' : 'warning/erreur'} capturé`)
  else {
    const seen = new Map()
    for (const l of logs) {
      const key = l.type + '|' + l.text
      seen.set(key, (seen.get(key) || 0) + 1)
    }
    for (const [key, count] of seen) {
      const i = key.indexOf('|')
      console.log(
        `  [${key.slice(0, i)}]${count > 1 ? ` (x${count})` : ''} ${key
          .slice(i + 1)
          .replace(/\s+/g, ' ')
          .slice(0, 300)}`
      )
    }
  }
  await page.close()
}

await browser.close()
console.log('\n✓ terminé')
