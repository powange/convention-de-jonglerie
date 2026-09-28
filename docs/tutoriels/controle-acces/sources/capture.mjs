// Captures du tutoriel « contrôle d'accès ». Suppose le seed fraîchement joué ; lit seed.json.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(
  '/home/powange/projects/convention-de-jonglerie/apps/app1/package.json'
)
const { chromium } = require('playwright')

const BASE = 'http://localhost:3000'
const DIR = process.cwd()
const seed = JSON.parse(fs.readFileSync('seed.json', 'utf8'))

// Session de Léo, le bénévole en créneau : créée au premier passage, réutilisée ensuite.
if (!fs.existsSync('leo.json')) {
  const b = await chromium.launch()
  const ctx = await b.newContext()
  const p = await ctx.newPage()
  await p.goto(`${BASE}/login`, { waitUntil: 'load' })
  await p.locator('input[type="email"]').fill('leo@tuto-balles-perdues.test')
  await Promise.all([
    p.waitForResponse((r) => r.url().includes('/api/auth/check-email')),
    p.getByRole('button', { name: /confirmer/i }).click(),
  ])
  await p.locator('input[type="password"]').fill('TutoBalles2026!')
  await Promise.all([
    p.waitForResponse((r) => r.url().includes('/api/auth/login')),
    p.getByRole('button', { name: /se connecter/i }).click(),
  ])
  await ctx.storageState({ path: 'leo.json' })
  await b.close()
}
const E = seed.editionId
const AC = `${BASE}/editions/${E}/gestion/ticketing/access-control`
const ONLY = process.argv[2] // pour rejouer une seule étape en mise au point
const W = 390
const H = 844

const HIDE = `
  vite-devtools-dock-embedded, nuxt-devtools-inspect-panel, #vue-tracer-overlay { display: none !important; }
`

/** Une fausse caméra qui filme `code` en QR code — ou rien du tout quand `code` est null. */
function video(nom, code) {
  const f = `${DIR}/${nom}.mjpeg`
  execFileSync('python3', ['mkvid.py', code ?? '', f])
  return f
}

async function ouvrir(videoFile) {
  const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
  if (videoFile) args.push(`--use-file-for-fake-video-capture=${videoFile}`)
  const browser = await chromium.launch({ args })
  ouverts.push(browser)
  const ctx = await browser.newContext({
    storageState: 'leo.json',
    viewport: { width: W, height: H },
    deviceScaleFactor: 2,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    permissions: ['camera'],
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('  PAGEERROR', e.message))
  await page.addInitScript((css) => {
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style')
      s.textContent = css
      document.head.appendChild(s)
    })
  }, HIDE)
  return { browser, page }
}

const ouverts = []
const pause = (page, ms = 800) => page.waitForTimeout(ms)

async function shot(page, nom, opts = {}) {
  if (opts.height) await page.setViewportSize({ width: W, height: opts.height })
  await pause(page, opts.wait ?? 700)
  const path = `shots/${nom}.png`
  if (opts.locator) await opts.locator.screenshot({ path })
  else await page.screenshot({ path, fullPage: !!opts.full })
  if (opts.height) await page.setViewportSize({ width: W, height: H })
  console.log('  ✓', nom)
}

/** La fenêtre du dessus seule, dépliée en entier grâce à une fenêtre de navigateur très haute. */
async function shotDialog(page, nom, opts = {}) {
  await page.setViewportSize({ width: W, height: opts.height ?? 3000 })
  await pause(page, opts.wait ?? 900)
  await page
    .locator('[role="dialog"]')
    .last()
    .screenshot({ path: `shots/${nom}.png` })
  await page.setViewportSize({ width: W, height: H })
  console.log('  ✓', nom)
}

async function allerAuGuichet(page) {
  await page.goto(AC, { waitUntil: 'load' })
  await page.getByRole('button', { name: /Scanner un QR code/ }).waitFor()
  await pause(page, 2500)
}

async function fermerToasts(page) {
  await page.waitForTimeout(300)
  for (const b of await page.locator('[data-slot="close"]').all()) {
    if (await b.isVisible().catch(() => false)) {
      const inToast = await b.evaluate(
        (el) => !!el.closest('li[role="status"], [data-state][role="status"], ol li')
      )
      if (inToast) await b.click().catch(() => {})
    }
  }
}

async function chercher(page, terme) {
  const input = page.getByPlaceholder(/Nom, prénom ou email/)
  await input.fill(terme)
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/ticketing/search')),
    input.press('Enter'),
  ])
  await pause(page, 600)
}

/** Ouvre la fiche d'une personne par recherche, en cliquant le résultat qui porte SON nom. */
async function fiche(page, terme, nomComplet) {
  await chercher(page, terme)
  await page.locator('button', { hasText: nomComplet }).first().click()
  const dlg = page.getByRole('dialog')
  await dlg.waitFor()
  await pause(page, 900)
  return dlg
}

async function fermerFiche(page) {
  await page.keyboard.press('Escape')
  await pause(page, 500)
}

const etapes = {
  // ── Arriver sur l'écran ───────────────────────────────────────────────────
  async acces() {
    const { browser, page } = await ouvrir()
    await page.goto(`${BASE}/editions/${E}`, { waitUntil: 'load' })
    await page.getByText('Gestion', { exact: true }).first().waitFor({ timeout: 30000 })
    await pause(page, 5000)
    await fermerToasts(page)
    await shot(page, '01-edition', { wait: 1500 })
    // « Gestion » mène le bénévole droit au contrôle d'accès : pas d'écran intermédiaire.
    await allerAuGuichet(page)
    await shot(page, '03-guichet')
    const defiler = (texte) =>
      page
        .getByText(texte, { exact: true })
        .first()
        .evaluate((el) => {
          el.scrollIntoView({ block: 'start' })
          window.scrollBy(0, -80)
          for (let x = el.parentElement; x; x = x.parentElement)
            if (x.scrollHeight > x.clientHeight + 20) x.scrollTop -= 0
        })
    await defiler("Statistiques d'entrée")
    await shot(page, '04-statistiques', { height: 1500 })
    await defiler('Dernières validations')
    await shot(page, '05-dernieres-validations', { height: 1300 })
    await browser.close()
  },

  // ── Scanner ───────────────────────────────────────────────────────────────
  async scanner() {
    const { browser, page } = await ouvrir(video('blank', null))
    await allerAuGuichet(page)
    await page.getByRole('button', { name: /Scanner un QR code/ }).click()
    await shot(page, '10-scanner-ouvert', { wait: 2500 })
    await browser.close()
  },

  async scanInconnu() {
    const { browser, page } = await ouvrir(video('inconnu', 'TUTO-INCONNU-123'))
    await allerAuGuichet(page)
    await page.getByRole('button', { name: /Scanner un QR code/ }).click()
    await page.waitForResponse((r) => r.url().includes('/ticketing/verify'))
    await shot(page, '11-scan-inconnu', { wait: 900 })
    await browser.close()
  },

  // ── Cas nominal : Julie, par scan ─────────────────────────────────────────
  async julie() {
    const { browser, page } = await ouvrir(video('julie', 'TUTO-HA-JULIE'))
    await allerAuGuichet(page)
    await page.getByRole('button', { name: /Scanner un QR code/ }).click()
    const dlg = page.getByRole('dialog')
    await dlg.waitFor()
    await shot(page, '12-scan-trouve', { wait: 1200 })
    await fermerToasts(page)
    await shotDialog(page, '13-fiche-julie')
    await dlg.locator('input[type="checkbox"]').first().check()
    await shotDialog(page, '14-julie-cochee')
    await page.getByRole('button', { name: /Valider l'entrée \(1\)/ }).click()
    const conf = page.getByRole('dialog').last()
    await conf.getByText('Articles à remettre').waitFor()
    await shotDialog(page, '15-articles-a-remettre')
    for (const c of await conf.locator('input[type="checkbox"], button[role="checkbox"]').all())
      await c.click()
    await shotDialog(page, '16-articles-coches')
    await conf.getByRole('button', { name: /^Valider$/ }).click()
    await page.waitForResponse((r) => r.url().includes('/validate-entry'))
    await shot(page, '17-julie-validee', { wait: 1500 })
    await fermerToasts(page)
    await shotDialog(page, '18-julie-validee-fiche')
    await browser.close()
  },

  // ── Recherche par nom, homonymes ──────────────────────────────────────────
  async recherche() {
    const { browser, page } = await ouvrir()
    await allerAuGuichet(page)
    await chercher(page, 'martin')
    await shot(page, '20-recherche-martin')
    await browser.close()
  },

  // ── Déjà validé ───────────────────────────────────────────────────────────
  async dejaValide() {
    const { browser, page } = await ouvrir()
    await allerAuGuichet(page)
    await fiche(page, 'moreau', 'Chloé Moreau')
    await shotDialog(page, '21-chloe-deja-validee')
    await browser.close()
  },

  // ── Commande de groupe ────────────────────────────────────────────────────
  async famille() {
    const { browser, page } = await ouvrir()
    await allerAuGuichet(page)
    const dlg = await fiche(page, 'bernard', 'Sophie Bernard')
    await shotDialog(page, '22-famille')
    const carte = (nom) => dlg.locator('div.relative', { hasText: nom })
    await carte('Sophie Bernard').locator('input[type="checkbox"]').check()
    await carte('Lou Bernard').locator('input[type="checkbox"]').check()
    await shotDialog(page, '23-famille-deux-cochees')
    await browser.close()
  },

  // ── Billet annulé, commande HelloAsso de plusieurs billets ────────────────
  async remboursementHelloAsso() {
    const { browser, page } = await ouvrir()
    await allerAuGuichet(page)
    const dlg = await fiche(page, 'karim', 'Karim Dupont')
    await shot(page, '30-karim-a-rembourser', { wait: 1200 })
    await shotDialog(page, '31-karim-groupe')
    await dlg.getByRole('button', { name: /^Remboursé$/ }).click()
    const confirmation = page.getByRole('dialog').last()
    await confirmation.getByRole('button', { name: /^Remboursé$/ }).waitFor()
    await shotDialog(page, '31b-karim-confirmation')
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/refund')),
      confirmation.getByRole('button', { name: /^Remboursé$/ }).click(),
    ])
    await shot(page, '32-karim-rembourse', { wait: 1200 })
    await fermerFiche(page)
    await fiche(page, 'lucas', 'Lucas Petit')
    await shot(page, '33-lucas-deja-rembourse', { wait: 1200 })
    await browser.close()
  },

  // ── Billet annulé, vente sur place ────────────────────────────────────────
  async remboursementSurPlace() {
    const { browser, page } = await ouvrir()
    await allerAuGuichet(page)
    await fiche(page, 'julien', 'Julien Roux')
    await shot(page, '34-julien-a-rembourser', { wait: 1200 })
    await fermerFiche(page)
    await fiche(page, 'lefebvre', 'Marc Lefebvre')
    await shotDialog(page, '35-marc-commande-annulee')
    await browser.close()
  },

  // ── Paiement à l'entrée ───────────────────────────────────────────────────
  async paiement() {
    const { browser, page } = await ouvrir()
    await allerAuGuichet(page)
    const dlg = await fiche(page, 'girard', 'Paul Girard')
    await shotDialog(page, '40-paul-en-attente')
    await dlg.locator('input[type="checkbox"]').first().check()
    await page.getByRole('button', { name: /Valider l'entrée \(1\)/ }).click()
    const pay = page.getByRole('dialog', { name: /Confirmer le paiement/ })
    await pay.waitFor()
    await shotDialog(page, '41-paiement')
    await pay
      .getByText(/Liquide/)
      .first()
      .click()
    await shotDialog(page, '42-paiement-especes')
    await browser.close()
  },

  // ── Bénévole (scan) ───────────────────────────────────────────────────────
  async benevole() {
    const { browser, page } = await ouvrir(video('ines', seed.codes.benevoleInes))
    await allerAuGuichet(page)
    await page.getByRole('button', { name: /Scanner un QR code/ }).click()
    await page.getByRole('dialog').waitFor()
    await fermerToasts(page)
    await shotDialog(page, '50-benevole')
    await browser.close()
  },

  async artiste() {
    const { browser, page } = await ouvrir()
    await allerAuGuichet(page)
    await fiche(page, 'diabolo', 'Zoé Diabolo')
    await shotDialog(page, '51-artiste')
    await browser.close()
  },

  async organisateur() {
    const { browser, page } = await ouvrir()
    await allerAuGuichet(page)
    await fiche(page, 'camille', 'Camille Organisatrice')
    await shotDialog(page, '52-organisateur')
    await browser.close()
  },

  // ── Dévalider ─────────────────────────────────────────────────────────────
  async devalider() {
    const { browser, page } = await ouvrir()
    await allerAuGuichet(page)
    const dlg = await fiche(page, 'thomas', 'Thomas Dupont')
    await dlg
      .getByRole('button', { name: /Dévalider l'entrée/ })
      .first()
      .scrollIntoViewIfNeeded()
    await shot(page, '60-devalider-bouton')
    await dlg
      .getByRole('button', { name: /Dévalider l'entrée/ })
      .first()
      .click()
    await shotDialog(page, '61-devalider-confirmation')
    await browser.close()
  },

  // ── Listes et historique ──────────────────────────────────────────────────
  async listes() {
    const { browser, page } = await ouvrir()
    await allerAuGuichet(page)
    const carte = page
      .locator('button, [role="button"], div.cursor-pointer', { hasText: /^\s*Bénévoles/ })
      .first()
    await carte.scrollIntoViewIfNeeded()
    await carte.click()
    await shotDialog(page, '70-benevoles-non-valides')
    await fermerFiche(page)
    await page.getByRole('button', { name: /Voir tout l'historique/ }).click()
    await shot(page, '71-historique', { wait: 1500 })
    await browser.close()
  },

  // ── Vente sur place ───────────────────────────────────────────────────────
  async vente() {
    const { browser, page } = await ouvrir()
    await allerAuGuichet(page)
    await page.getByRole('button', { name: /Ajouter un participant/ }).click()
    const dlg = page.getByRole('dialog')
    await dlg.waitFor()
    await pause(page, 1000)
    const suivant = () => dlg.getByRole('button', { name: /^Suivant$/ }).click()
    await dlg.getByPlaceholder(/email@exemple/).fill('nouveau.venu@exemple.test')
    await dlg.getByRole('button', { name: /Vérifier/ }).click()
    await pause(page, 1500)
    await dlg.getByPlaceholder('Jean').fill('Nina')
    await dlg.getByPlaceholder('Dupont').fill('Nouvelle')
    await shotDialog(page, '80-vente-acheteur')
    await suivant()
    await pause(page, 1500)
    await shotDialog(page, '81-vente-tarifs')
    const plus = dlg
      .locator('div.rounded-lg, div.border', { hasText: 'Pass journée (sur place)' })
      .last()
      .getByRole('button')
      .last()
    await plus.click()
    await shotDialog(page, '82-vente-tarif-choisi')
    for (let i = 0; i < 4; i++) {
      await suivant().catch(() => {})
      await pause(page, 1200)
      await shotDialog(page, `83-vente-etape-${i + 3}`)
      if (!(await dlg.getByRole('button', { name: /^Suivant$/ }).count())) break
    }
    await dlg
      .getByText(/Liquide/)
      .first()
      .click()
      .catch(() => console.log('  (pas de Liquide)'))
    await dlg.getByPlaceholder(/22,00/).fill('30')
    await shotDialog(page, '84-vente-paiement')
    await dlg.getByRole('button', { name: /Créer la commande/ }).click()
    await page.waitForResponse((r) => r.url().includes('add-participant-manually'))
    await pause(page, 2500)
    await shotDialog(page, '85-vente-creee')
    await browser.close()
  },
}

for (const [nom, fn] of Object.entries(etapes)) {
  if (ONLY && !ONLY.split(',').includes(nom)) continue
  console.log('▶', nom)
  try {
    await fn()
  } catch (e) {
    console.log('  ✗', nom, e.message.split('\n')[0])
  }
  for (const b of ouverts.splice(0)) await b.close().catch(() => {})
}
process.exit(0)
