import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, apiPut, loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Smoke fonctionnel des ateliers (extraits en `layers/workshops`).
 * Un atelier doit se situer dans la plage de dates de l'édition (start = J+7, end = J+9 au setup).
 */
test.describe.serial('Module Ateliers', () => {
  let workshopId: number | null = null

  test.beforeAll(async () => {
    const { editionId } = loadState()
    if (!editionId) throw new Error('editionId manquant dans state.json (setup global non joué)')
  })

  test("activer les ateliers via l'API", async ({ page }) => {
    const { editionId } = loadState()
    await updateEdition(page, String(editionId), { workshopsEnabled: true })
  })

  test('créer un atelier via API et le voir sur la page ateliers', async ({ page, goto }) => {
    const { editionId } = loadState()
    // Créneau clairement dans la plage de l'édition (J+7.5 → J+7.5 +2h, donc entre J+7 et J+9)
    const start = new Date(Date.now() + 7.5 * 24 * 3600_000)
    const end = new Date(start.getTime() + 2 * 3600_000)

    const response = await apiPost(page, `${BASE}/api/editions/${editionId}/workshops`, {
      data: {
        title: 'Atelier diabolo E2E',
        description: 'Atelier de test E2E',
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
      },
    })
    expect(response.ok()).toBe(true)
    const body = await response.json()
    workshopId = (body?.data ?? body)?.id
    expect(workshopId).toBeTruthy()

    // Les ateliers sont listés sur la page publique (la page de gestion gère lieux/carte).
    await expect(async () => {
      await goto(`/editions/${editionId}/workshops`, { waitUntil: 'hydration' })
      await expect(page.getByText(/atelier diabolo e2e/i).first()).toBeVisible({ timeout: 5000 })
    }).toPass({ timeout: 30000, intervals: [2000, 3000, 5000] })
  })

  test('l’atelier apparaît dans GET workshops', async ({ page }) => {
    const { editionId } = loadState()
    if (!workshopId) throw new Error('workshopId manquant')
    const response = await page.request.get(`${BASE}/api/editions/${editionId}/workshops`)
    expect(response.ok()).toBe(true)
    const body = await response.json()
    const items = Array.isArray(body) ? body : (body?.data ?? body?.workshops ?? [])
    expect(items.some((w: { id: number }) => w.id === workshopId)).toBe(true)
  })

  /**
   * Le droit de proposer un atelier ne doit pas dépendre d'une course.
   *
   * `checkCanCreate` s'exécute au montage et, si le store d'authentification est encore vide,
   * renonce en masquant le bouton — sans que rien ne relance la vérification. Le plugin client
   * lançant `/api/session/me` sans l'attendre, l'issue dépendait de qui arrivait le premier :
   * en développement la page est la plus lente et gagne toujours, ce qui masquait le défaut.
   *
   * D'où le retard imposé ici, qui reproduit le timing de production. Même défaut que sur la
   * page bénévolat, où il avait été signalé et mesuré.
   */
  /**
   * Modifier un atelier renvoyait 500 en production.
   *
   * Le contrôle « l'atelier appartient-il bien à cette édition ? » passait `{ id, editionId }` à
   * un helper qui attend un identifiant scalaire : la requête devenait `where: { id: { id,
   * editionId } }`, que Prisma refuse. Sept tentatives sont remontées des journaux avant que le
   * défaut soit vu — aucune n'avait abouti.
   */
  test('modifier un atelier aboutit, et un atelier d’une autre édition reste introuvable', async ({
    page,
  }) => {
    const { editionId } = loadState()
    if (!workshopId) throw new Error('workshopId manquant')

    const start = new Date(Date.now() + 7.5 * 24 * 3600_000)
    const end = new Date(start.getTime() + 2 * 3600_000)
    const corps = {
      title: 'Atelier diabolo E2E modifié',
      description: 'Description mise à jour',
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
    }

    const modification = await apiPut(
      page,
      `${BASE}/api/editions/${editionId}/workshops/${workshopId}`,
      { data: corps }
    )
    expect(modification.status(), await modification.text()).toBe(200)

    // Et le garde d'appartenance tient toujours : le même atelier vu depuis une autre édition
    // n'existe pas.
    const autreEdition = Number(editionId) + 100000
    const usurpation = await apiPut(
      page,
      `${BASE}/api/editions/${autreEdition}/workshops/${workshopId}`,
      { data: corps }
    )
    expect(
      [403, 404],
      `un atelier d'une autre édition ne devrait pas être modifiable (${usurpation.status()})`
    ).toContain(usurpation.status())
  })

  test('le bouton de proposition résiste à une session tardive', async ({ page }) => {
    const { editionId } = loadState()

    await page.route('**/api/session/me', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      await route.continue()
    })

    await page.goto(`${BASE}/editions/${editionId}/workshops`, { waitUntil: 'domcontentloaded' })

    await expect(
      page.getByRole('button', { name: /ajouter un workshop/i }).first(),
      'le bouton de proposition devrait apparaître une fois la session arrivée'
    ).toBeVisible({ timeout: 30000 })
  })

  test('nettoyage : supprimer l’atelier et désactiver les ateliers', async ({ page }) => {
    const { editionId } = loadState()
    if (workshopId) {
      const del = await apiDelete(page, `${BASE}/api/editions/${editionId}/workshops/${workshopId}`)
      expect(del.ok()).toBe(true)
    }
    await updateEdition(page, String(editionId), { workshopsEnabled: false })
  })
})
