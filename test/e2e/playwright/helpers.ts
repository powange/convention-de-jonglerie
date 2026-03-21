import fs from 'node:fs'

import { expect } from '@nuxt/test-utils/playwright'

import { conventionStateFile } from '../../../playwright.config'

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
