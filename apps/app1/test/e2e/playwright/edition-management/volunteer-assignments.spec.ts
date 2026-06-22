import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPatch, apiPost, enableVolunteers, loadState } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Smoke fonctionnel de l'affectation d'un bénévole à une équipe (layers/volunteers), non couvert :
 * création d'une équipe + d'un bénévole accepté, affectation à l'équipe, passage en responsable,
 * vérification via les membres de l'équipe, puis nettoyage.
 */
test.describe.serial('Bénévoles — affectation aux équipes', () => {
  let teamId: string | null = null
  let applicationId: number | null = null
  let volunteerUserId: number | null = null
  const volunteerEmail = `benevole-affect-e2e-${Date.now()}@example.com`

  test.beforeAll(async () => {
    const { editionId } = loadState()
    if (!editionId) throw new Error('editionId manquant dans state.json (setup global non joué)')
  })

  test("activer les bénévoles via l'API", async ({ page }) => {
    const { editionId } = loadState()
    await enableVolunteers(page, String(editionId))
  })

  test('créer une équipe et un bénévole accepté', async ({ page }) => {
    const { editionId } = loadState()

    const teamRes = await apiPost(page, `${BASE}/api/editions/${editionId}/volunteer-teams`, {
      data: { name: 'Équipe Accueil E2E', color: '#3b82f6' },
    })
    expect(teamRes.ok(), `POST team a échoué: ${await teamRes.text()}`).toBe(true)
    teamId = ((await teamRes.json())?.data ?? {})?.id
    expect(teamId).toBeTruthy()

    const volRes = await apiPost(
      page,
      `${BASE}/api/editions/${editionId}/volunteers/create-user-and-add`,
      { data: { email: volunteerEmail, prenom: 'Bénévole', nom: 'AffectE2E' } }
    )
    expect(volRes.ok(), `create-user-and-add a échoué: ${await volRes.text()}`).toBe(true)
    const data = (await volRes.json())?.data ?? {}
    volunteerUserId = data?.user?.id
    applicationId = data?.application?.id
    expect(volunteerUserId).toBeTruthy()
    expect(applicationId).toBeTruthy()
  })

  test("affecter le bénévole à l'équipe et le voir dans les membres", async ({ page }) => {
    const { editionId } = loadState()
    if (!teamId || !applicationId) throw new Error('teamId/applicationId manquant')

    const patch = await apiPatch(
      page,
      `${BASE}/api/editions/${editionId}/volunteers/applications/${applicationId}/teams`,
      { data: { teams: [teamId] } }
    )
    expect(patch.ok(), `teams.patch a échoué: ${await patch.text()}`).toBe(true)

    // Vérification côté organisateur (la vue « membres » d'une équipe est réservée aux leaders).
    const assignments = await page.request.get(
      `${BASE}/api/editions/${editionId}/volunteers/team-assignments`
    )
    expect(assignments.ok()).toBe(true)
    const body = await assignments.json()
    const list = Array.isArray(body) ? body : (body?.data ?? [])
    expect(JSON.stringify(list)).toContain(volunteerEmail)
  })

  test('passer le bénévole responsable de l’équipe', async ({ page }) => {
    const { editionId } = loadState()
    if (!teamId || !applicationId) throw new Error('teamId/applicationId manquant')

    const patch = await apiPatch(
      page,
      `${BASE}/api/editions/${editionId}/volunteers/applications/${applicationId}/teams/${teamId}/leader`,
      { data: { isLeader: true } }
    )
    expect(patch.ok(), `leader.patch a échoué: ${await patch.text()}`).toBe(true)
  })

  test('nettoyage : candidature et équipe', async ({ page }) => {
    const { editionId } = loadState()
    if (applicationId) {
      await apiDelete(
        page,
        `${BASE}/api/editions/${editionId}/volunteers/applications/${applicationId}`
      )
    }
    if (teamId) {
      const del = await apiDelete(
        page,
        `${BASE}/api/editions/${editionId}/volunteer-teams/${teamId}`
      )
      expect(del.ok()).toBe(true)
    }
  })
})
