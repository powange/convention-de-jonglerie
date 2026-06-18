import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, enableVolunteers, loadState } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Smoke fonctionnel du planning bénévoles (layers/volunteers), non couvert jusqu'ici :
 * création d'un créneau (time slot), ajout d'un bénévole (create-user-and-add → candidature
 * ACCEPTED) et affectation du bénévole au créneau, puis nettoyage.
 */
test.describe.serial('Bénévoles — planning et affectations', () => {
  let slotId: number | null = null
  let assignmentId: number | null = null
  let volunteerUserId: number | null = null
  let applicationId: number | null = null
  const volunteerEmail = `benevole-planning-e2e-${Date.now()}@example.com`

  test.beforeAll(async () => {
    const { editionId } = loadState()
    if (!editionId) throw new Error('editionId manquant dans state.json (setup global non joué)')
  })

  test("activer les bénévoles via l'API", async ({ page }) => {
    const { editionId } = loadState()
    await enableVolunteers(page, String(editionId))
  })

  test('créer un créneau via API et le voir dans GET time-slots', async ({ page }) => {
    const { editionId } = loadState()
    // Créneau dans la plage de l'édition (J+7.5 → +4h, entre J+7 et J+9)
    const start = new Date(Date.now() + 7.5 * 24 * 3600_000)
    const end = new Date(start.getTime() + 4 * 3600_000)

    const response = await apiPost(page, `${BASE}/api/editions/${editionId}/volunteer-time-slots`, {
      data: {
        title: 'Accueil E2E',
        description: "Tenue de l'accueil",
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
        maxVolunteers: 5,
      },
    })
    expect(response.ok(), `POST time-slots a échoué: ${await response.text()}`).toBe(true)
    const body = await response.json()
    slotId = (body?.data ?? body)?.id
    expect(slotId).toBeTruthy()

    const list = await page.request.get(`${BASE}/api/editions/${editionId}/volunteer-time-slots`)
    expect(list.ok()).toBe(true)
    const listBody = await list.json()
    const slots = Array.isArray(listBody) ? listBody : (listBody?.data ?? [])
    expect(slots.some((s: { id: number }) => s.id === slotId)).toBe(true)
  })

  test('la page planning est accessible', async ({ page, goto }) => {
    const { editionId } = loadState()
    // La page charge un calendrier lourd + un contrôle d'accès → re-navigation tolérante.
    await expect(async () => {
      await goto(`/editions/${editionId}/gestion/volunteers/planning`, { waitUntil: 'hydration' })
      await expect(
        page.getByRole('heading', { name: /planning des bénévoles/i }).first()
      ).toBeVisible({ timeout: 8000 })
    }).toPass({ timeout: 40000, intervals: [2000, 3000, 5000] })
  })

  test('ajouter un bénévole (create-user-and-add) → candidature ACCEPTED', async ({ page }) => {
    const { editionId } = loadState()
    const response = await apiPost(
      page,
      `${BASE}/api/editions/${editionId}/volunteers/create-user-and-add`,
      { data: { email: volunteerEmail, prenom: 'Bénévole', nom: 'PlanningE2E' } }
    )
    expect(response.ok(), `create-user-and-add a échoué: ${await response.text()}`).toBe(true)
    const body = await response.json()
    const data = body?.data ?? body
    volunteerUserId = data?.user?.id
    applicationId = data?.application?.id
    expect(volunteerUserId).toBeTruthy()
    expect(applicationId).toBeTruthy()
    expect(data?.application?.status).toBe('ACCEPTED')
  })

  test('affecter le bénévole au créneau et vérifier via GET assignments', async ({ page }) => {
    const { editionId } = loadState()
    if (!slotId || !volunteerUserId) throw new Error('slotId/volunteerUserId manquant')

    const response = await apiPost(
      page,
      `${BASE}/api/editions/${editionId}/volunteer-time-slots/${slotId}/assignments`,
      { data: { userId: volunteerUserId } }
    )
    expect(response.ok(), `assignment a échoué: ${await response.text()}`).toBe(true)
    const body = await response.json()
    assignmentId = (body?.data ?? body)?.id
    expect(assignmentId).toBeTruthy()

    const list = await page.request.get(
      `${BASE}/api/editions/${editionId}/volunteer-time-slots/${slotId}/assignments`
    )
    expect(list.ok()).toBe(true)
    const listBody = await list.json()
    const assignments = Array.isArray(listBody) ? listBody : (listBody?.data ?? [])
    expect(assignments.some((a: { userId?: number }) => a.userId === volunteerUserId)).toBe(true)
  })

  test('nettoyage : affectation, créneau, candidature, désactivation', async ({ page }) => {
    const { editionId } = loadState()
    if (assignmentId && slotId) {
      const del = await apiDelete(
        page,
        `${BASE}/api/editions/${editionId}/volunteer-time-slots/${slotId}/assignments/${assignmentId}`
      )
      expect(del.ok()).toBe(true)
    }
    if (slotId) {
      const del = await apiDelete(
        page,
        `${BASE}/api/editions/${editionId}/volunteer-time-slots/${slotId}`
      )
      expect(del.ok()).toBe(true)
    }
    if (applicationId) {
      await apiDelete(
        page,
        `${BASE}/api/editions/${editionId}/volunteers/applications/${applicationId}`
      )
    }
  })
})
