import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, enableVolunteers, loadState } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Smoke fonctionnel des notifications bénévoles (layers/volunteers), non couvert :
 * envoi d'une notification à tous les bénévoles acceptés et relecture dans l'historique.
 */
test.describe.serial('Bénévoles — notifications', () => {
  let applicationId: number | null = null
  const volunteerEmail = `benevole-notif-e2e-${Date.now()}@example.com`
  const message = `Annonce E2E ${Date.now()} : briefing à 9h`

  test.beforeAll(async () => {
    const { editionId } = loadState()
    if (!editionId) throw new Error('editionId manquant dans state.json (setup global non joué)')
  })

  test("activer les bénévoles via l'API", async ({ page }) => {
    const { editionId } = loadState()
    await enableVolunteers(page, String(editionId))
  })

  test('créer un bénévole accepté (destinataire)', async ({ page }) => {
    const { editionId } = loadState()
    const res = await apiPost(
      page,
      `${BASE}/api/editions/${editionId}/volunteers/create-user-and-add`,
      { data: { email: volunteerEmail, prenom: 'Bénévole', nom: 'NotifE2E' } }
    )
    expect(res.ok(), `create-user-and-add a échoué: ${await res.text()}`).toBe(true)
    applicationId = ((await res.json())?.data ?? {})?.application?.id
    expect(applicationId).toBeTruthy()
  })

  test('envoyer une notification à tous les bénévoles', async ({ page }) => {
    const { editionId } = loadState()
    const res = await apiPost(page, `${BASE}/api/editions/${editionId}/volunteers/notifications`, {
      data: { targetType: 'all', message },
    })
    expect(res.ok(), `notifications.post a échoué: ${await res.text()}`).toBe(true)
  })

  test("la notification apparaît dans l'historique (GET)", async ({ page }) => {
    const { editionId } = loadState()
    const res = await page.request.get(`${BASE}/api/editions/${editionId}/volunteers/notifications`)
    expect(res.ok()).toBe(true)
    const body = await res.json()
    const notifs = Array.isArray(body) ? body : (body?.data ?? [])
    expect(JSON.stringify(notifs)).toContain(message)
  })

  test('nettoyage : candidature', async ({ page }) => {
    const { editionId } = loadState()
    if (applicationId) {
      await apiDelete(
        page,
        `${BASE}/api/editions/${editionId}/volunteers/applications/${applicationId}`
      )
    }
  })
})
