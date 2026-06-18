import { execSync } from 'node:child_process'
import fs from 'node:fs'

import { expect } from '@nuxt/test-utils/playwright'

import { conventionStateFile, credentialsFile } from '../../../playwright.config'

const BASE_URL = 'http://localhost:3000'

// ──────────────────────────────────────────────
// CSRF helpers
// ──────────────────────────────────────────────

type Page = import('@playwright/test').Page
type RequestOptions = Parameters<Page['request']['post']>[1]

/**
 * Récupère le token CSRF depuis le cookie `csrf_token` du context. Si absent,
 * effectue un GET (sur `/`) pour que le serveur le pose puis le relit.
 *
 * Indispensable pour toutes les mutations API depuis Playwright : le serveur
 * applique le pattern Double Submit Cookie et exige `x-csrf-token` en header.
 */
async function getCsrfToken(page: Page): Promise<string> {
  const findToken = async () =>
    (await page.context().cookies()).find((c) => c.name === 'csrf_token')?.value

  let token = await findToken()
  if (!token) {
    // Toute requête non interne déclenche `ensureCsrfToken` côté serveur
    await page.request.get(BASE_URL).catch(() => {})
    token = await findToken()
  }
  if (!token) {
    throw new Error('CSRF token introuvable après GET — vérifier le middleware csrf')
  }
  return token
}

async function withCsrf(page: Page, options: RequestOptions = {}): Promise<RequestOptions> {
  const token = await getCsrfToken(page)
  return {
    ...options,
    headers: { ...options?.headers, 'x-csrf-token': token },
  }
}

/**
 * Wrappers `page.request.X` qui injectent automatiquement le header CSRF.
 * À utiliser pour toutes les mutations API depuis les tests E2E.
 */
export async function apiPost(page: Page, url: string, options?: RequestOptions) {
  return page.request.post(url, await withCsrf(page, options))
}

export async function apiPut(page: Page, url: string, options?: RequestOptions) {
  return page.request.put(url, await withCsrf(page, options))
}

export async function apiPatch(page: Page, url: string, options?: RequestOptions) {
  return page.request.patch(url, await withCsrf(page, options))
}

export async function apiDelete(page: Page, url: string, options?: RequestOptions) {
  return page.request.delete(url, await withCsrf(page, options))
}

// ──────────────────────────────────────────────
// Verification code helpers
// ──────────────────────────────────────────────

/**
 * Extrait le dernier code de vérification (6 chiffres) émis par le serveur.
 * - En CI : lit le fichier de log défini par NUXT_SERVER_LOG
 * - En local : lit les logs Docker du conteneur app
 *
 * Le serveur log "[DEV_VERIFICATION_CODE] XXXXXX" en mode dev / E2E_TEST=true.
 */
export function getVerificationCodeFromLogs(): string {
  let logs: string
  const serverLogFile = process.env.NUXT_SERVER_LOG
  if (serverLogFile) {
    logs = fs.readFileSync(serverLogFile, 'utf-8')
  } else {
    logs = execSync('docker compose -f docker-compose.dev.yml logs app --tail=200 2>&1', {
      encoding: 'utf-8',
      timeout: 10000,
    })
  }
  const matches = [...logs.matchAll(/\[DEV_VERIFICATION_CODE]\s*(\d{6})/g)]
  if (matches.length === 0) {
    throw new Error('Code de vérification non trouvé dans les logs')
  }
  return matches[matches.length - 1][1]
}

// ──────────────────────────────────────────────
// State
// ──────────────────────────────────────────────

export interface ConventionState {
  conventionId: string
  editionId: string
  name: string
}

export function loadState(): ConventionState {
  if (!fs.existsSync(conventionStateFile)) {
    throw new Error(`State file introuvable: ${conventionStateFile}. Lancer le data-setup d'abord.`)
  }
  return JSON.parse(fs.readFileSync(conventionStateFile, 'utf-8'))
}

/**
 * Sauvegarde une valeur dans le state file (ajoute/met à jour un champ).
 */
export function saveToState(key: string, value: unknown) {
  const state = fs.existsSync(conventionStateFile)
    ? JSON.parse(fs.readFileSync(conventionStateFile, 'utf-8'))
    : {}
  state[key] = value
  fs.writeFileSync(conventionStateFile, JSON.stringify(state))
}

/**
 * Charge une valeur depuis le state file.
 */
export function loadFromState<T = string>(key: string): T | undefined {
  if (!fs.existsSync(conventionStateFile)) return undefined
  const state = JSON.parse(fs.readFileSync(conventionStateFile, 'utf-8'))
  return state[key] as T | undefined
}

// ──────────────────────────────────────────────
// Auth helpers
// ──────────────────────────────────────────────

export interface E2ECredentials {
  email: string
  password: string
  pseudo: string
}

export function loadCredentials(): E2ECredentials {
  if (!fs.existsSync(credentialsFile)) {
    throw new Error(
      `Fichier de credentials introuvable: ${credentialsFile}. Lancer le setup d'abord.`
    )
  }
  return JSON.parse(fs.readFileSync(credentialsFile, 'utf-8'))
}

/**
 * Effectue un login complet (email + mot de passe) depuis la page /login
 */
export async function loginWith(
  page: import('@playwright/test').Page,
  email: string,
  password: string
) {
  await page.locator('input[type="email"]').fill(email)

  await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes('/api/auth/check-email') && res.status() === 200
    ),
    page.getByRole('button', { name: /confirmer/i }).click(),
  ])

  const passwordInput = page.locator('input[type="password"]')
  await expect(passwordInput).toBeVisible({ timeout: 5000 })
  await passwordInput.fill(password)

  await Promise.all([
    page.waitForResponse((res) => res.url().includes('/api/auth/login') && res.status() === 200),
    page.getByRole('button', { name: /se connecter/i }).click(),
  ])
}

// ──────────────────────────────────────────────
// Edition helpers
// ──────────────────────────────────────────────

/**
 * Met à jour les champs d'une édition via PUT /api/editions/{id}
 * Utile pour activer/désactiver les features (volunteersEnabled, ticketingEnabled, etc.)
 */
export async function updateEdition(page: Page, editionId: string, data: Record<string, unknown>) {
  const response = await apiPut(page, `${BASE_URL}/api/editions/${editionId}`, { data })
  expect(response.ok()).toBe(true)
  return response
}

/**
 * Change le statut d'une édition (OFFLINE, PUBLISHED, PLANNED, CANCELLED)
 */
export async function setEditionStatus(
  page: Page,
  editionId: string,
  status: 'OFFLINE' | 'PUBLISHED' | 'PLANNED' | 'CANCELLED'
) {
  const response = await apiPatch(page, `${BASE_URL}/api/editions/${editionId}/status`, {
    data: { status },
  })
  expect(response.ok()).toBe(true)
  return response
}

/**
 * Récupère le statut actuel d'une édition
 */
export async function getEditionStatus(page: Page, editionId: string): Promise<string | null> {
  const response = await page.request.get(`${BASE_URL}/api/editions/${editionId}`)
  if (!response.ok()) return null
  const body = await response.json()
  const edition = body.data || body
  return edition.status
}

// ──────────────────────────────────────────────
// Shows call helpers
// ──────────────────────────────────────────────

/**
 * Crée un appel à spectacles via l'API
 */
export async function createShowCall(
  page: Page,
  editionId: string,
  data: { name: string; description?: string }
) {
  const response = await apiPost(page, `${BASE_URL}/api/editions/${editionId}/shows-call`, {
    data,
  })
  expect(response.ok()).toBe(true)
  const body = await response.json()
  const showCall = body.data?.showCall || body.showCall || body.data || body
  return showCall
}

/**
 * Met à jour un appel à spectacles via l'API
 */
export async function updateShowCall(
  page: Page,
  editionId: string,
  showCallId: string,
  data: Record<string, unknown>
) {
  const response = await apiPut(
    page,
    `${BASE_URL}/api/editions/${editionId}/shows-call/${showCallId}`,
    { data }
  )
  expect(response.ok()).toBe(true)
  return response
}

/**
 * Supprime un appel à spectacles via l'API
 */
export async function deleteShowCall(page: Page, editionId: string, showCallId: string) {
  const response = await apiDelete(
    page,
    `${BASE_URL}/api/editions/${editionId}/shows-call/${showCallId}`
  )
  expect(response.ok()).toBe(true)
  return response
}

/**
 * Récupère les candidatures d'un appel à spectacles via l'API
 */
export async function getShowCallApplications(
  page: Page,
  editionId: string,
  showCallId: string,
  status?: string
) {
  const url = new URL(`${BASE_URL}/api/editions/${editionId}/shows-call/${showCallId}/applications`)
  if (status) url.searchParams.set('status', status)

  const response = await page.request.get(url.toString())
  expect(response.ok()).toBe(true)
  const body = await response.json()
  return body.data || body
}

/**
 * Met à jour le statut d'une candidature
 */
export async function updateShowCallApplicationStatus(
  page: Page,
  editionId: string,
  showCallId: string,
  applicationId: string,
  data: { status?: string; organizerNotes?: string }
) {
  const response = await apiPatch(
    page,
    `${BASE_URL}/api/editions/${editionId}/shows-call/${showCallId}/applications/${applicationId}`,
    { data }
  )
  expect(response.ok()).toBe(true)
  return response
}

/**
 * Active le profil artiste pour l'utilisateur courant
 */
export async function enableArtistProfile(page: Page) {
  const response = await apiPut(page, `${BASE_URL}/api/profile/categories`, {
    data: { isVolunteer: false, isArtist: true, isOrganizer: false },
  })
  expect(response.ok()).toBe(true)
  return response
}

/**
 * Construit un body de candidature valide pour `createShowApplicationSchema`.
 * Tous les champs minimaux requis sont remplis ; surchargeable via `overrides`.
 */
export function buildShowApplicationBody(overrides: Record<string, unknown> = {}) {
  const performer = {
    lastName: 'PerfNom',
    firstName: 'PerfPrenom',
    email: `e2e-perf-${Date.now()}@example.com`,
    phone: '+33612345678',
  }
  return {
    // Informations personnelles (mises à jour dans le profil)
    lastName: 'E2E-Candidat',
    firstName: 'E2E-Prenom',
    phone: '+33612345678',
    // Infos artiste
    artistName: 'E2E Artiste API',
    artistBio: 'Bio de test E2E',
    portfolioUrl: 'https://example.com/portfolio',
    videoUrl: 'https://example.com/video',
    // Infos spectacle
    showTitle: 'E2E Spectacle API',
    showDescription: 'Description du spectacle de test E2E suffisamment longue.',
    showDuration: 30,
    showCategory: 'jonglage',
    technicalNeeds: 'Scène 4x4m, sono, éclairage',
    // Artistes additionnels (au moins 1 requis par le schéma)
    additionalPerformersCount: 1,
    additionalPerformers: [performer],
    accommodationNeeded: false,
    ...overrides,
  }
}

/**
 * Soumet une candidature à un appel à spectacles via l'API (POST applications).
 * Retourne l'objet candidature créé.
 */
export async function submitShowApplicationViaApi(
  page: Page,
  editionId: string,
  showCallId: string,
  data: Record<string, unknown>
) {
  const response = await apiPost(
    page,
    `${BASE_URL}/api/editions/${editionId}/shows-call/${showCallId}/applications`,
    { data }
  )
  if (!response.ok()) {
    throw new Error(`POST application a échoué (${response.status()}): ${await response.text()}`)
  }
  const body = await response.json()
  return body.data?.application || body.data || body
}

/**
 * Modifie sa propre candidature (PUT my-application).
 */
export async function updateMyShowApplication(
  page: Page,
  editionId: string,
  showCallId: string,
  data: Record<string, unknown>
) {
  const response = await apiPut(
    page,
    `${BASE_URL}/api/editions/${editionId}/shows-call/${showCallId}/my-application`,
    { data }
  )
  if (!response.ok()) {
    throw new Error(`PUT my-application a échoué (${response.status()}): ${await response.text()}`)
  }
  const body = await response.json()
  return body.data?.application || body.data || body
}

/**
 * Récupère sa propre candidature (GET my-application).
 */
export async function getMyShowApplication(page: Page, editionId: string, showCallId: string) {
  const response = await page.request.get(
    `${BASE_URL}/api/editions/${editionId}/shows-call/${showCallId}/my-application`
  )
  expect(response.ok()).toBe(true)
  const body = await response.json()
  return body.data || body
}

/**
 * Crée le sondage technique (POST survey/token). Génère le token + ouvre le sondage.
 */
export async function createSurveyToken(page: Page, editionId: string, showCallId: string) {
  const response = await apiPost(
    page,
    `${BASE_URL}/api/editions/${editionId}/shows-call/${showCallId}/survey/token`
  )
  if (!response.ok()) {
    throw new Error(`POST survey/token a échoué (${response.status()}): ${await response.text()}`)
  }
  const body = await response.json()
  return body.data || body
}

/**
 * Ouvre/ferme le sondage technique (PATCH survey/status). Body attendu : { open: boolean }.
 */
export async function setSurveyStatus(
  page: Page,
  editionId: string,
  showCallId: string,
  open: boolean
) {
  const response = await apiPatch(
    page,
    `${BASE_URL}/api/editions/${editionId}/shows-call/${showCallId}/survey/status`,
    { data: { open } }
  )
  if (!response.ok()) {
    throw new Error(`PATCH survey/status a échoué (${response.status()}): ${await response.text()}`)
  }
  const body = await response.json()
  return body.data || body
}

/**
 * Récupère les résultats du sondage technique (GET survey/results).
 */
export async function getSurveyResults(page: Page, editionId: string, showCallId: string) {
  const response = await page.request.get(
    `${BASE_URL}/api/editions/${editionId}/shows-call/${showCallId}/survey/results`
  )
  expect(response.ok()).toBe(true)
  const body = await response.json()
  return body.data || body
}

/**
 * Récupère les besoins techniques agrégés (GET shows-call/technical-needs).
 */
export async function getShowCallTechnicalNeeds(page: Page, editionId: string) {
  const response = await page.request.get(
    `${BASE_URL}/api/editions/${editionId}/shows-call/technical-needs`
  )
  expect(response.ok()).toBe(true)
  const body = await response.json()
  return body.data || body
}

/**
 * Importe un performer d'une candidature ACCEPTÉE comme EditionArtist.
 */
export async function importPerformerFromApplication(
  page: Page,
  editionId: string,
  showCallId: string,
  applicationId: string,
  data: { performerIndex: number; applyApplicationData?: boolean }
) {
  const response = await apiPost(
    page,
    `${BASE_URL}/api/editions/${editionId}/shows-call/${showCallId}/applications/${applicationId}/import-performer`,
    { data }
  )
  if (!response.ok()) {
    throw new Error(
      `POST import-performer a échoué (${response.status()}): ${await response.text()}`
    )
  }
  const body = await response.json()
  return body.data || body
}

/**
 * Récupère la liste des artistes d'une édition (GET /artists).
 */
export async function getEditionArtists(page: Page, editionId: string) {
  const response = await page.request.get(`${BASE_URL}/api/editions/${editionId}/artists`)
  expect(response.ok()).toBe(true)
  const body = await response.json()
  const data = body.data || body
  return data.artists || data
}

// ──────────────────────────────────────────────
// Volunteers settings helpers
// ──────────────────────────────────────────────

/**
 * Active les bénévoles sur une édition
 */
export async function enableVolunteers(page: Page, editionId: string) {
  return updateEdition(page, editionId, { volunteersEnabled: true })
}

/**
 * Désactive les bénévoles sur une édition
 */
export async function disableVolunteers(page: Page, editionId: string) {
  return updateEdition(page, editionId, { volunteersEnabled: false })
}

/**
 * Met à jour les settings bénévoles (recrutement ouvert/fermé, mode, etc.)
 */
export async function updateVolunteerSettings(
  page: Page,
  editionId: string,
  data: Record<string, unknown>
) {
  const response = await apiPatch(
    page,
    `${BASE_URL}/api/editions/${editionId}/volunteers/settings`,
    { data }
  )
  expect(response.ok()).toBe(true)
  return response
}

/**
 * Récupère les settings bénévoles
 */
export async function getVolunteerSettings(page: Page, editionId: string) {
  const response = await page.request.get(
    `${BASE_URL}/api/editions/${editionId}/volunteers/settings`
  )
  expect(response.ok()).toBe(true)
  const body = await response.json()
  return body.data || body
}
