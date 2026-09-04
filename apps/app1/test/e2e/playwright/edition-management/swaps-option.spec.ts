import { expect, test } from '@nuxt/test-utils/playwright'

import { activerBenevolatTemporairement, apiPatch, loadState } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Les échanges de créneaux sont désormais optionnels par édition, ouverts par défaut.
 *
 * Fermés, ils doivent disparaître des deux côtés — le bouton du bénévole et la page du
 * responsable —, et pas seulement de l'affichage : masquer un bouton n'empêche personne
 * d'appeler l'API. D'où le contrôle sur l'endpoint autant que sur la page.
 */
test.describe.serial('Option « échanges de créneaux »', () => {
  let restaurer: (() => Promise<void>) | null = null

  test.beforeAll(async ({ browser }) => {
    restaurer = await activerBenevolatTemporairement(browser, loadState().editionId)
  })

  test.afterAll(async () => {
    await restaurer?.()
  })

  const fermer = (page: any, editionId: string | number, ouverts: boolean) =>
    apiPatch(page, `${BASE}/api/editions/${editionId}/volunteers/settings`, {
      data: { swapsEnabled: ouverts },
    })

  test('ouverts par défaut : la page de gestion répond', async ({ page }) => {
    const { editionId } = loadState()

    const reglages = await page.request.get(`${BASE}/api/editions/${editionId}/volunteers/settings`)
    const corps = await reglages.json()
    expect((corps.data ?? corps).swapsEnabled, 'ouverts par défaut').toBe(true)

    await page.goto(`${BASE}/editions/${editionId}/gestion/volunteers/swaps`, {
      waitUntil: 'domcontentloaded',
    })
    await expect(page.getByRole('heading', { name: /échanges de créneaux/i }).first()).toBeVisible({
      timeout: 30000,
    })
  })

  test('fermés : la page de gestion disparaît et l’API refuse', async ({ page }) => {
    const { editionId } = loadState()
    const reponse = await fermer(page, editionId, false)
    expect(reponse.ok(), `fermeture refusée : ${await reponse.text()}`).toBe(true)

    // L'API d'abord : c'est elle qui protège vraiment.
    const file = await page.request.get(
      `${BASE}/api/editions/${editionId}/volunteers/swaps/pending`
    )
    expect(file.status(), 'la file devrait être refusée').toBe(403)

    // Puis la page, qui doit rendre un 404 franc plutôt qu'un écran d'erreur.
    await page.goto(`${BASE}/editions/${editionId}/gestion/volunteers/swaps`, {
      waitUntil: 'domcontentloaded',
    })
    await expect(page.getByText(/page not found|page introuvable|404/i).first()).toBeVisible({
      timeout: 30000,
    })

    await fermer(page, editionId, true)
  })

  test('sans demande en attente, la fermeture est acceptée', async ({ page }) => {
    const { editionId } = loadState()
    const reponse = await fermer(page, editionId, false)
    expect(reponse.ok(), `fermeture refusée à tort : ${await reponse.text()}`).toBe(true)
    await fermer(page, editionId, true)
  })

  // Le refus en présence d'une demande en attente se vérifie là où une demande existe :
  // dans `swaps-mobile.spec.ts`, qui en crée une de bout en bout.
})
