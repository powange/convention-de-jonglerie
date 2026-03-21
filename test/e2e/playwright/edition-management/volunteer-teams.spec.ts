import { expect, test } from '@nuxt/test-utils/playwright'

import {
  disableVolunteers,
  enableVolunteers,
  loadState,
  setEditionStatus,
  updateVolunteerSettings,
} from '../helpers'

const TEAM_NAME = 'Équipe Accueil E2E'
const TEAM_DESCRIPTION = 'Équipe de test créée par les tests E2E'
const TEAM_COLOR = '#3B82F6'
const TEAM_UPDATED_NAME = 'Équipe Technique E2E'

let createdTeamId: string

test.describe.serial('Gestion des équipes de bénévoles', () => {
  // ──────────────────────────────────────────────
  // Setup : activer les bénévoles
  // ──────────────────────────────────────────────

  test('activer les bénévoles via API', async ({ page }) => {
    const { editionId } = loadState()
    await enableVolunteers(page, editionId)
  })

  // ──────────────────────────────────────────────
  // Phase 1 : Création d'équipe
  // ──────────────────────────────────────────────

  test('la page des équipes est accessible et vide', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/volunteers/teams`, { waitUntil: 'hydration' })
    await page.waitForSelector('main', { timeout: 15000 })

    // Le titre "Gestion des équipes" doit être visible
    await expect(page.getByText(/gestion des équipes/i).first()).toBeVisible({ timeout: 10000 })

    // Le message "Aucune équipe créée" doit être visible
    await expect(page.getByText(/aucune équipe/i).first()).toBeVisible({ timeout: 5000 })

    // Le bouton "Créer une équipe" doit être visible
    await expect(page.getByRole('button', { name: /créer une équipe/i })).toBeVisible()
  })

  test("créer une équipe via l'UI", async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/volunteers/teams`, { waitUntil: 'hydration' })
    await page.waitForSelector('main', { timeout: 15000 })

    // Cliquer sur "Créer une équipe"
    await page.getByRole('button', { name: /créer une équipe/i }).click()

    // La modale doit s'ouvrir
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible({ timeout: 5000 })
    await expect(modal.getByText(/créer une équipe/i).first()).toBeVisible()

    // Remplir le nom
    const nameInput = modal.getByLabel(/nom de l'équipe/i)
    await nameInput.fill(TEAM_NAME)

    // Remplir la description
    const descInput = modal.locator('textarea').first()
    await descInput.fill(TEAM_DESCRIPTION)

    // Soumettre et attendre la réponse API
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/volunteer-teams') && res.request().method() === 'POST'
      ),
      modal.getByRole('button', { name: /créer/i }).click(),
    ])

    expect(response.ok()).toBe(true)
    const body = await response.json()
    createdTeamId = body.data?.id || body.id
  })

  test("l'équipe créée apparaît dans la liste", async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/volunteers/teams`, { waitUntil: 'hydration' })
    await page.waitForSelector('main', { timeout: 15000 })

    // Le nom de l'équipe doit être visible
    await expect(page.getByText(TEAM_NAME).first()).toBeVisible({ timeout: 10000 })

    // La description doit être visible
    await expect(page.getByText(TEAM_DESCRIPTION).first()).toBeVisible({ timeout: 5000 })

    // Le message "Aucune équipe" ne doit plus être visible
    await expect(page.getByText(/aucune équipe/i)).not.toBeVisible({ timeout: 2000 })
  })

  test("vérifier l'équipe créée via API", async ({ page }) => {
    const { editionId } = loadState()

    const response = await page.request.get(
      `http://localhost:3000/api/editions/${editionId}/volunteer-teams`
    )
    expect(response.ok()).toBe(true)

    const body = await response.json()
    const teams = body.data || body
    const e2eTeam = teams.find((t: { name: string }) => t.name === TEAM_NAME)
    expect(e2eTeam).toBeTruthy()
    expect(e2eTeam.description).toBe(TEAM_DESCRIPTION)
  })

  // ──────────────────────────────────────────────
  // Phase 2 : Modification d'équipe
  // ──────────────────────────────────────────────

  test("modifier l'équipe via API", async ({ page }) => {
    const { editionId } = loadState()

    expect(createdTeamId).toBeTruthy()

    const response = await page.request.put(
      `http://localhost:3000/api/editions/${editionId}/volunteer-teams/${createdTeamId}`,
      {
        data: {
          name: TEAM_UPDATED_NAME,
          color: '#EF4444',
          maxVolunteers: 5,
        },
      }
    )
    expect(response.ok()).toBe(true)
  })

  test("les modifications sont visibles dans l'UI", async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/volunteers/teams`, { waitUntil: 'hydration' })
    await page.waitForSelector('main', { timeout: 15000 })

    // Le nouveau nom doit être visible
    await expect(page.getByText(TEAM_UPDATED_NAME).first()).toBeVisible({ timeout: 10000 })

    // L'ancien nom ne doit plus être visible
    await expect(page.getByText(TEAM_NAME)).not.toBeVisible({ timeout: 2000 })
  })

  test('vérifier les modifications via API', async ({ page }) => {
    const { editionId } = loadState()

    const response = await page.request.get(
      `http://localhost:3000/api/editions/${editionId}/volunteer-teams`
    )
    expect(response.ok()).toBe(true)

    const body = await response.json()
    const teams = body.data || body
    const updatedTeam = teams.find((t: { id: string }) => t.id === createdTeamId)
    expect(updatedTeam).toBeTruthy()
    expect(updatedTeam.name).toBe(TEAM_UPDATED_NAME)
    expect(updatedTeam.color).toBe('#EF4444')
    expect(updatedTeam.maxVolunteers).toBe(5)
  })

  // ──────────────────────────────────────────────
  // Phase 3 : Options d'équipe (obligatoire, visibilité)
  // ──────────────────────────────────────────────

  test("rendre l'équipe obligatoire", async ({ page }) => {
    const { editionId } = loadState()

    const response = await page.request.put(
      `http://localhost:3000/api/editions/${editionId}/volunteer-teams/${createdTeamId}`,
      { data: { isRequired: true } }
    )
    expect(response.ok()).toBe(true)

    // Vérifier via API
    const listResponse = await page.request.get(
      `http://localhost:3000/api/editions/${editionId}/volunteer-teams`
    )
    const body = await listResponse.json()
    const teams = body.data || body
    const team = teams.find((t: { id: string }) => t.id === createdTeamId)
    expect(team.isRequired).toBe(true)
  })

  test("le badge 'Obligatoire' apparaît dans l'UI", async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/volunteers/teams`, { waitUntil: 'hydration' })
    await page.waitForSelector('main', { timeout: 15000 })

    await expect(page.getByText(/obligatoire/i).first()).toBeVisible({ timeout: 5000 })
  })

  test("l'équipe obligatoire est pré-sélectionnée et non décochable dans le formulaire de candidature", async ({
    page,
    goto,
  }) => {
    const { editionId } = loadState()

    // Retirer une éventuelle candidature existante (d'un test précédent)
    const existingApps = await page.request.get(
      `http://localhost:3000/api/editions/${editionId}/volunteers/applications`
    )
    if (existingApps.ok()) {
      const body = await existingApps.json()
      const apps = (body.data?.items || body.data || body.items || body) as {
        id: string
        status: string
      }[]
      if (Array.isArray(apps)) {
        for (const app of apps) {
          // Repasser en PENDING si nécessaire avant suppression
          if (app.status !== 'PENDING') {
            await page.request.patch(
              `http://localhost:3000/api/editions/${editionId}/volunteers/applications/${app.id}`,
              { data: { status: 'PENDING' } }
            )
          }
          // Retirer la candidature (endpoint utilisateur)
          await page.request.delete(
            `http://localhost:3000/api/editions/${editionId}/volunteers/applications`
          )
        }
      }
    }

    // Prérequis : activer askTeamPreferences, ouvrir le recrutement, publier
    await updateVolunteerSettings(page, editionId, {
      open: true,
      askTeamPreferences: true,
    })
    await setEditionStatus(page, editionId, 'PUBLISHED')

    // Aller sur la page publique bénévoles
    await goto(`/editions/${editionId}/volunteers`, { waitUntil: 'hydration' })
    await page.waitForSelector('h3', { timeout: 15000 })

    // Ouvrir la modale de candidature
    await page.getByRole('button', { name: /postuler/i }).click()
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible({ timeout: 5000 })

    // L'équipe obligatoire doit apparaître avec le label "(Obligatoire)"
    await expect(modal.getByText(/obligatoire/i).first()).toBeVisible({ timeout: 5000 })

    // La checkbox de l'équipe obligatoire doit être cochée
    const teamCheckbox = modal.getByRole('checkbox', { name: new RegExp(TEAM_UPDATED_NAME, 'i') })
    await expect(teamCheckbox).toBeChecked()

    // Elle doit être désactivée (non décochable)
    await expect(teamCheckbox).toBeDisabled()

    // Fermer la modale
    await page.keyboard.press('Escape')

    // Remettre l'état initial : fermer le recrutement, repasser OFFLINE
    await updateVolunteerSettings(page, editionId, {
      open: false,
      askTeamPreferences: false,
    })
    await setEditionStatus(page, editionId, 'OFFLINE')
  })

  test("masquer la visibilité désélectionne automatiquement l'option obligatoire", async ({
    page,
  }) => {
    const { editionId } = loadState()

    // L'équipe est encore obligatoire (isRequired: true du test précédent)
    // Masquer la visibilité doit forcer isRequired à false côté API
    const response = await page.request.put(
      `http://localhost:3000/api/editions/${editionId}/volunteer-teams/${createdTeamId}`,
      { data: { isVisibleToVolunteers: false } }
    )
    expect(response.ok()).toBe(true)

    // Vérifier que l'API a bien désactivé les deux options
    const listResponse = await page.request.get(
      `http://localhost:3000/api/editions/${editionId}/volunteer-teams`
    )
    const body = await listResponse.json()
    const teams = body.data || body
    const team = teams.find((t: { id: string }) => t.id === createdTeamId)
    expect(team.isVisibleToVolunteers).toBe(false)
    expect(team.isRequired).toBe(false)
  })

  test("l'équipe masquée n'apparaît pas dans le formulaire de candidature", async ({
    page,
    goto,
  }) => {
    const { editionId } = loadState()

    // Ouvrir le recrutement avec team preferences et publier
    await updateVolunteerSettings(page, editionId, {
      open: true,
      askTeamPreferences: true,
    })
    await setEditionStatus(page, editionId, 'PUBLISHED')

    // Aller sur la page publique bénévoles
    await goto(`/editions/${editionId}/volunteers`, { waitUntil: 'hydration' })
    await page.waitForSelector('h3', { timeout: 15000 })

    // Ouvrir la modale de candidature
    await page.getByRole('button', { name: /postuler/i }).click()
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible({ timeout: 5000 })

    // L'équipe masquée ne doit PAS apparaître dans le formulaire
    await expect(modal.getByText(TEAM_UPDATED_NAME)).not.toBeVisible({ timeout: 3000 })

    // Fermer la modale et remettre l'état initial
    await page.keyboard.press('Escape')
    await updateVolunteerSettings(page, editionId, {
      open: false,
      askTeamPreferences: false,
    })
    await setEditionStatus(page, editionId, 'OFFLINE')
  })

  test("rétablir la visibilité de l'équipe", async ({ page }) => {
    const { editionId } = loadState()

    const response = await page.request.put(
      `http://localhost:3000/api/editions/${editionId}/volunteer-teams/${createdTeamId}`,
      { data: { isVisibleToVolunteers: true } }
    )
    expect(response.ok()).toBe(true)
  })

  // ──────────────────────────────────────────────
  // Phase 4 : Suppression d'équipe
  // ──────────────────────────────────────────────

  test("supprimer l'équipe via API", async ({ page }) => {
    const { editionId } = loadState()

    expect(createdTeamId).toBeTruthy()

    const response = await page.request.delete(
      `http://localhost:3000/api/editions/${editionId}/volunteer-teams/${createdTeamId}`
    )
    expect(response.ok()).toBe(true)
  })

  test("l'équipe supprimée n'apparaît plus dans la liste", async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/volunteers/teams`, { waitUntil: 'hydration' })
    await page.waitForSelector('main', { timeout: 15000 })

    // Le nom de l'équipe ne doit plus être visible
    await expect(page.getByText(TEAM_UPDATED_NAME)).not.toBeVisible({ timeout: 5000 })

    // Le message "Aucune équipe" doit réapparaître
    await expect(page.getByText(/aucune équipe/i).first()).toBeVisible({ timeout: 5000 })
  })

  test('vérifier la suppression via API', async ({ page }) => {
    const { editionId } = loadState()

    const response = await page.request.get(
      `http://localhost:3000/api/editions/${editionId}/volunteer-teams`
    )
    expect(response.ok()).toBe(true)

    const body = await response.json()
    const teams = body.data || body
    const deletedTeam = teams.find((t: { id: string }) => t.id === createdTeamId)
    expect(deletedTeam).toBeUndefined()
  })

  // ──────────────────────────────────────────────
  // Nettoyage
  // ──────────────────────────────────────────────

  test('nettoyer : désactiver les bénévoles', async ({ page }) => {
    const { editionId } = loadState()
    await disableVolunteers(page, editionId)
  })
})
