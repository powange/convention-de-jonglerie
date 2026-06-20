import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Smoke fonctionnel des tâches (extraites en `layers/tasks`) : activation, création d'un groupe de
 * tâches via l'API et rendu dans la page de gestion.
 */
test.describe.serial('Module Tâches', () => {
  let groupId: number | null = null

  test.beforeAll(async () => {
    const { editionId } = loadState()
    if (!editionId) throw new Error('editionId manquant dans state.json (setup global non joué)')
  })

  test("activer les tâches via l'API", async ({ page }) => {
    const { editionId } = loadState()
    await updateEdition(page, String(editionId), { tasksEnabled: true })
  })

  test('créer un groupe de tâches via API et le voir dans la page gestion', async ({
    page,
    goto,
  }) => {
    const { editionId } = loadState()
    const response = await apiPost(page, `${BASE}/api/editions/${editionId}/task-groups`, {
      data: { name: 'Logistique E2E', description: 'Groupe de test E2E' },
    })
    expect(response.ok()).toBe(true)
    const body = await response.json()
    groupId = body?.data?.group?.id ?? body?.group?.id
    expect(groupId).toBeTruthy()

    await expect(async () => {
      await goto(`/editions/${editionId}/gestion/tasks`, { waitUntil: 'hydration' })
      await expect(page.getByRole('heading', { name: /tâches/i }).first()).toBeVisible({
        timeout: 5000,
      })
      await expect(page.getByText(/logistique e2e/i).first()).toBeVisible({ timeout: 5000 })
    }).toPass({ timeout: 30000, intervals: [2000, 3000, 5000] })
  })

  test('le groupe apparaît dans GET task-groups', async ({ page }) => {
    const { editionId } = loadState()
    if (!groupId) throw new Error('groupId manquant')
    const response = await page.request.get(`${BASE}/api/editions/${editionId}/task-groups`)
    expect(response.ok()).toBe(true)
    const body = await response.json()
    const groups = body?.data?.groups ?? body?.groups ?? (Array.isArray(body) ? body : [])
    expect(groups.some((g: { id: number }) => g.id === groupId)).toBe(true)
  })

  test('nettoyage : supprimer le groupe et désactiver les tâches', async ({ page }) => {
    const { editionId } = loadState()
    if (groupId) {
      const del = await apiDelete(page, `${BASE}/api/editions/${editionId}/task-groups/${groupId}`)
      expect(del.ok()).toBe(true)
    }
    await updateEdition(page, String(editionId), { tasksEnabled: false })
  })
})
