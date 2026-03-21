import { expect, test } from '@nuxt/test-utils/playwright'

import {
  disableVolunteers,
  enableVolunteers,
  loadState,
  setEditionStatus,
  updateVolunteerSettings,
  getVolunteerSettings,
} from '../helpers'

test.describe.serial('Parcours complet bénévoles : configuration → candidature → gestion', () => {
  // ──────────────────────────────────────────────
  // Phase 1 : Configuration du bénévolat
  // ──────────────────────────────────────────────

  test('activer les bénévoles et ouvrir le recrutement via API', async ({ page }) => {
    const { editionId } = loadState()

    await enableVolunteers(page, editionId)
    await updateVolunteerSettings(page, editionId, { open: true })
    await setEditionStatus(page, editionId, 'PUBLISHED')
  })

  test('vérifier les settings via API', async ({ page }) => {
    const { editionId } = loadState()

    const settings = await getVolunteerSettings(page, editionId)
    expect(settings.mode).toBe('INTERNAL')
    expect(settings.open).toBe(true)
  })

  // ──────────────────────────────────────────────
  // Phase 2 : Candidature bénévole (page publique)
  // ──────────────────────────────────────────────

  test('la page publique affiche le bouton postuler', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/volunteers`, { waitUntil: 'hydration' })
    await page.waitForSelector('h3', { timeout: 15000 })

    await expect(page.getByRole('button', { name: /postuler/i })).toBeVisible({ timeout: 5000 })
  })

  test('ouvrir la modale de candidature', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/volunteers`, { waitUntil: 'hydration' })
    await page.waitForSelector('h3', { timeout: 15000 })

    await page.getByRole('button', { name: /postuler/i }).click()

    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible({ timeout: 5000 })

    // Champs obligatoires visibles
    await expect(modal.getByLabel(/prénom/i).first()).toBeVisible()
    await expect(modal.getByLabel(/nom/i).first()).toBeVisible()

    await page.keyboard.press('Escape')
  })

  test('soumettre une candidature via API', async ({ page }) => {
    const { editionId } = loadState()

    const response = await page.request.post(
      `http://localhost:3000/api/editions/${editionId}/volunteers/applications`,
      {
        data: {
          prenom: 'E2E-Prénom',
          nom: 'E2E-Nom',
          phone: '+33612345678',
          eventAvailability: true,
          motivation: 'Candidature de test E2E automatisée',
          // Format attendu : YYYY-MM-DD_granularity
          arrivalDateTime: `${new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]}_morning`,
          departureDateTime: `${new Date(Date.now() + 9 * 86400000).toISOString().split('T')[0]}_afternoon`,
        },
      }
    )

    if (!response.ok()) {
      const errorBody = await response.text().catch(() => 'impossible de lire le body')
      throw new Error(`Soumission candidature échouée (${response.status()}): ${errorBody}`)
    }
    const body = await response.json()
    // Réponse: { data: { application: { status, ... } } }
    const status = body.data?.application?.status || body.data?.status || body.status
    expect(status).toBe('PENDING')
  })

  test("la page publique affiche le statut 'en attente'", async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/volunteers`, { waitUntil: 'hydration' })
    await page.waitForSelector('h3', { timeout: 15000 })

    await expect(page.getByText(/en attente|pending/i).first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: /postuler/i })).not.toBeVisible({
      timeout: 2000,
    })
  })

  // ──────────────────────────────────────────────
  // Phase 3 : Gestion des candidatures (organisateur)
  // ──────────────────────────────────────────────

  test('la page des candidatures affiche la candidature soumise', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/volunteers/applications`, {
      waitUntil: 'hydration',
    })
    await page.waitForSelector('main', { timeout: 15000 })

    await expect(page.getByText(/E2E-Prénom|E2E-Nom/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('au moins une candidature en attente via API', async ({ page }) => {
    const { editionId } = loadState()

    const response = await page.request.get(
      `http://localhost:3000/api/editions/${editionId}/volunteers/applications?status=PENDING`
    )
    expect(response.ok()).toBe(true)

    const body = await response.json()
    const data = body.data || body
    const applications = data.items || data
    expect(Array.isArray(applications)).toBe(true)
    expect(applications.length).toBeGreaterThanOrEqual(1)
  })

  test('accepter la candidature', async ({ page }) => {
    const { editionId } = loadState()

    // Récupérer la candidature PENDING
    const listResponse = await page.request.get(
      `http://localhost:3000/api/editions/${editionId}/volunteers/applications?status=PENDING`
    )
    const listBody = await listResponse.json()
    const data = listBody.data || listBody
    const applications = data.items || data
    const applicationId = applications[0]?.id
    expect(applicationId).toBeTruthy()

    // Accepter
    const patchResponse = await page.request.patch(
      `http://localhost:3000/api/editions/${editionId}/volunteers/applications/${applicationId}`,
      { data: { status: 'ACCEPTED' } }
    )
    expect(patchResponse.ok()).toBe(true)
  })

  test("la candidature est 'acceptée' via API", async ({ page }) => {
    const { editionId } = loadState()

    const response = await page.request.get(
      `http://localhost:3000/api/editions/${editionId}/volunteers/applications?status=ACCEPTED`
    )
    expect(response.ok()).toBe(true)

    const body = await response.json()
    const data = body.data || body
    const applications = data.items || data
    // Vérifier qu'au moins une candidature est acceptée avec notre motivation
    const e2eApp = applications.find(
      (a: { motivation?: string }) => a.motivation === 'Candidature de test E2E automatisée'
    )
    expect(e2eApp).toBeTruthy()
    expect(e2eApp.status).toBe('ACCEPTED')
  })

  test("la page publique affiche le statut 'acceptée'", async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/volunteers`, { waitUntil: 'hydration' })
    await page.waitForSelector('h3', { timeout: 15000 })

    await expect(page.getByText(/acceptée|accepted/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('rejeter la candidature (ACCEPTED → PENDING → REJECTED)', async ({ page }) => {
    const { editionId } = loadState()

    const listResponse = await page.request.get(
      `http://localhost:3000/api/editions/${editionId}/volunteers/applications?status=ACCEPTED`
    )
    const listBody = await listResponse.json()
    const data = listBody.data || listBody
    const applications = data.items || data
    const applicationId = applications[0]?.id

    // ACCEPTED → PENDING
    const pendingResponse = await page.request.patch(
      `http://localhost:3000/api/editions/${editionId}/volunteers/applications/${applicationId}`,
      { data: { status: 'PENDING' } }
    )
    expect(pendingResponse.ok()).toBe(true)

    // PENDING → REJECTED
    const rejectResponse = await page.request.patch(
      `http://localhost:3000/api/editions/${editionId}/volunteers/applications/${applicationId}`,
      { data: { status: 'REJECTED' } }
    )
    expect(rejectResponse.ok()).toBe(true)
  })

  test("la page publique affiche le statut 'refusée'", async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/volunteers`, { waitUntil: 'hydration' })
    await page.waitForSelector('h3', { timeout: 15000 })

    await expect(page.getByText(/refusée|rejected/i).first()).toBeVisible({ timeout: 5000 })
  })

  // ──────────────────────────────────────────────
  // Nettoyage
  // ──────────────────────────────────────────────

  test('nettoyer : supprimer candidature, désactiver bénévoles, repasser OFFLINE', async ({
    page,
  }) => {
    const { editionId } = loadState()

    // Fermer le recrutement (les candidatures seront nettoyées par db:e2e:clean)
    await updateVolunteerSettings(page, editionId, { open: false })
    await disableVolunteers(page, editionId)
    await setEditionStatus(page, editionId, 'OFFLINE')
  })
})
