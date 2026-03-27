import fs from 'node:fs'

import { expect } from '@nuxt/test-utils/playwright'

import { conventionStateFile, credentialsFile } from '../../../playwright.config'

const BASE_URL = 'http://localhost:3000'

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

type APIRequestContext = { request: import('@playwright/test').APIRequestContext }

/**
 * Met à jour les champs d'une édition via PUT /api/editions/{id}
 * Utile pour activer/désactiver les features (volunteersEnabled, ticketingEnabled, etc.)
 */
export async function updateEdition(
  page: APIRequestContext,
  editionId: string,
  data: Record<string, unknown>
) {
  const response = await page.request.put(`${BASE_URL}/api/editions/${editionId}`, { data })
  expect(response.ok()).toBe(true)
  return response
}

/**
 * Change le statut d'une édition (OFFLINE, PUBLISHED, PLANNED, CANCELLED)
 */
export async function setEditionStatus(
  page: APIRequestContext,
  editionId: string,
  status: 'OFFLINE' | 'PUBLISHED' | 'PLANNED' | 'CANCELLED'
) {
  const response = await page.request.patch(`${BASE_URL}/api/editions/${editionId}/status`, {
    data: { status },
  })
  expect(response.ok()).toBe(true)
  return response
}

/**
 * Récupère le statut actuel d'une édition
 */
export async function getEditionStatus(
  page: APIRequestContext,
  editionId: string
): Promise<string | null> {
  const response = await page.request.get(`${BASE_URL}/api/editions/${editionId}`)
  if (!response.ok()) return null
  const body = await response.json()
  const edition = body.data || body
  return edition.status
}

// ──────────────────────────────────────────────
// Volunteers settings helpers
// ──────────────────────────────────────────────

/**
 * Active les bénévoles sur une édition
 */
export async function enableVolunteers(page: APIRequestContext, editionId: string) {
  return updateEdition(page, editionId, { volunteersEnabled: true })
}

/**
 * Désactive les bénévoles sur une édition
 */
export async function disableVolunteers(page: APIRequestContext, editionId: string) {
  return updateEdition(page, editionId, { volunteersEnabled: false })
}

/**
 * Met à jour les settings bénévoles (recrutement ouvert/fermé, mode, etc.)
 */
export async function updateVolunteerSettings(
  page: APIRequestContext,
  editionId: string,
  data: Record<string, unknown>
) {
  const response = await page.request.patch(
    `${BASE_URL}/api/editions/${editionId}/volunteers/settings`,
    { data }
  )
  expect(response.ok()).toBe(true)
  return response
}

/**
 * Récupère les settings bénévoles
 */
export async function getVolunteerSettings(page: APIRequestContext, editionId: string) {
  const response = await page.request.get(
    `${BASE_URL}/api/editions/${editionId}/volunteers/settings`
  )
  expect(response.ok()).toBe(true)
  const body = await response.json()
  return body.data || body
}
