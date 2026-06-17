import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, apiPut, loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Module FAQ (layers/faq) — vérifie de bout en bout, en build de production, que :
 *  - les 5 endpoints de l'API FAQ du layer sont bien enregistrés (CRUD + réordonnancement) ;
 *  - le port de visibilité (`getFaqVisibility`) gère le 404 quand le module est désactivé ;
 *  - les pages du layer (gestion + page publique convertie en sous-répertoire) s'affichent.
 *
 * Tourne en tant qu'organisateur propriétaire de l'édition (projet `edition-management`).
 */
test.describe.serial('FAQ — API, gestion et page publique', () => {
  test('visibilité : l’éditeur garde l’accès et la réponse reflète le module désactivé', async ({
    page,
  }) => {
    const { editionId } = loadState()
    await updateEdition(page, editionId, { faqEnabled: false, faqPagePublic: false })

    // L'organisateur (éditeur) garde l'accès à l'API FAQ même module désactivé (bypass éditeur) et la
    // réponse reflète l'état désactivé renvoyé par le port (`faqEnabled`/`faqPagePublic` à false).
    // Le 404 visiteur (port masquant la FAQ) est couvert par le test unitaire du handler.
    const res = await page.request.get(`${BASE}/api/editions/${editionId}/faq`)
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.data.faqEnabled).toBe(false)
    expect(body.data.faqPagePublic).toBe(false)
  })

  test('API : CRUD complet (create / list / update / reorder / delete)', async ({ page }) => {
    const { editionId } = loadState()
    await updateEdition(page, editionId, { faqEnabled: true, faqPagePublic: true })

    // create #1 (publique) + #2 (privée)
    const create1 = await apiPost(page, `${BASE}/api/editions/${editionId}/faq`, {
      data: { question: 'E2E question 1 ?', answer: 'Réponse 1', isPublic: true },
    })
    expect(create1.ok()).toBe(true)
    const entry1 = (await create1.json()).data.entry
    expect(entry1.isPublic).toBe(true)

    const create2 = await apiPost(page, `${BASE}/api/editions/${editionId}/faq`, {
      data: { question: 'E2E question 2 ?', answer: 'Réponse 2', isPublic: false },
    })
    expect(create2.ok()).toBe(true)
    const entry2 = (await create2.json()).data.entry

    // list : l'organisateur voit les deux (publique + privée)
    const list = await page.request.get(`${BASE}/api/editions/${editionId}/faq`)
    expect(list.ok()).toBe(true)
    const listBody = await list.json()
    const ids = listBody.data.entries.map((e: { id: number }) => e.id)
    expect(ids).toContain(entry1.id)
    expect(ids).toContain(entry2.id)

    // list publique : seule l'entrée publique est renvoyée
    const listPublic = await page.request.get(`${BASE}/api/editions/${editionId}/faq?publicOnly=1`)
    expect(listPublic.ok()).toBe(true)
    const publicIds = (await listPublic.json()).data.entries.map((e: { id: number }) => e.id)
    expect(publicIds).toContain(entry1.id)
    expect(publicIds).not.toContain(entry2.id)

    // update : bascule l'entrée 1 en privée
    const put = await apiPut(page, `${BASE}/api/editions/${editionId}/faq/${entry1.id}`, {
      data: { isPublic: false },
    })
    expect(put.ok()).toBe(true)
    expect((await put.json()).data.entry.isPublic).toBe(false)

    // reorder : inverse l'ordre des deux entrées
    const reorder = await apiPut(page, `${BASE}/api/editions/${editionId}/faq/reorder`, {
      data: { orderedIds: [entry2.id, entry1.id] },
    })
    expect(reorder.ok()).toBe(true)
    expect((await reorder.json()).data.reordered).toBe(2)

    // delete des deux entrées
    expect((await apiDelete(page, `${BASE}/api/editions/${editionId}/faq/${entry1.id}`)).ok()).toBe(
      true
    )
    expect((await apiDelete(page, `${BASE}/api/editions/${editionId}/faq/${entry2.id}`)).ok()).toBe(
      true
    )
  })

  test('UI : page de gestion accessible et page publique affiche une entrée', async ({
    page,
    goto,
  }) => {
    const { editionId } = loadState()
    await updateEdition(page, editionId, { faqEnabled: true, faqPagePublic: true })

    const marker = `E2E_FAQ_PUBLIC_${Date.now()}`
    const create = await apiPost(page, `${BASE}/api/editions/${editionId}/faq`, {
      data: { question: `${marker} ?`, answer: 'Réponse affichée publiquement', isPublic: true },
    })
    expect(create.ok()).toBe(true)
    const entryId = (await create.json()).data.entry.id

    // Page de gestion (route du layer, sous-répertoire gestion/faq)
    await goto(`/editions/${editionId}/gestion/faq`, { waitUntil: 'hydration' })
    await expect(page.locator('h1')).toContainText('FAQ', { timeout: 15000 })

    // Page publique (route du layer, faq.vue → faq/index.vue) : l'entrée publique est affichée
    await goto(`/editions/${editionId}/faq`, { waitUntil: 'hydration' })
    await expect(page.getByText(marker, { exact: false })).toBeVisible({ timeout: 15000 })

    // Nettoyage : supprime l'entrée et remet le module FAQ dans son état par défaut
    await apiDelete(page, `${BASE}/api/editions/${editionId}/faq/${entryId}`)
    await updateEdition(page, editionId, { faqEnabled: false, faqPagePublic: false })
  })
})
