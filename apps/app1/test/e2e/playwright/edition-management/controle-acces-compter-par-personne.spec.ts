import { expect, test } from '@nuxt/test-utils/playwright'

import { loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'
const AUTH = new URL('../../../../test-results/.auth/user.json', import.meta.url).pathname

/**
 * La tuile « Participants » du contrôle d'accès comptait des LIGNES DE COMMANDE : une personne
 * venue avec un billet vendredi et un billet samedi y comptait deux fois. Elle bascule désormais
 * entre deux lectures — par billet, par personne — d'un clic, et un second clic revient.
 *
 * Ce que ce spec prouve, et lui seul peut le prouver : la tuile est réellement cliquable (c'était
 * un `<div>` inerte), le mode s'écrit à l'écran, et il survit à un rechargement. L'ARITHMÉTIQUE du
 * regroupement, elle, est éprouvée là où elle peut l'être sans dépendre des données de l'édition
 * partagée : `test/unit/utils/participants-par-personne.test.ts` pour la règle, et
 * `test/nuxt/server/api/editions/ticketing/stats.get.test.ts` pour ce que le point d'API en rend.
 */
test.describe('Contrôle d’accès — compter par billet ou par personne', () => {
  // L'édition est partagée entre toutes les specs, et `features-toggle` vérifie que les modules
  // sont éteints par défaut : ce qu'on allume ici, on le rend dans l'état où on l'a trouvé.
  let etaitActive = false

  test.beforeAll(async ({ browser }) => {
    const { editionId } = loadState()
    const context = await browser.newContext({ storageState: AUTH })
    const page = await context.newPage()

    const reponse = await page.request.get(`${BASE}/api/editions/${editionId}`)
    const corps = reponse.ok() ? await reponse.json() : {}
    etaitActive = Boolean((corps.data ?? corps)?.ticketingEnabled)

    await updateEdition(page, String(editionId), { ticketingEnabled: true })
    await context.close()
  })

  test.afterAll(async ({ browser }) => {
    if (etaitActive) return
    const { editionId } = loadState()
    const context = await browser.newContext({ storageState: AUTH })
    const page = await context.newPage()
    await updateEdition(page, String(editionId), { ticketingEnabled: false })
    await context.close()
  })

  test('un clic passe par personne, un rechargement s’en souvient, un second clic revient', async ({
    browser,
  }) => {
    const { editionId } = loadState()
    // Contexte neuf : le mode est gardé dans le navigateur, on part donc d'une mémoire vierge.
    const context = await browser.newContext({ storageState: AUTH, locale: 'fr-FR' })
    const page = await context.newPage()

    await page.goto(`${BASE}/editions/${editionId}/gestion/ticketing/access-control`, {
      waitUntil: 'domcontentloaded',
    })

    // Visée par identité — le rôle et le nom accessible —, jamais par position : les quatre tuiles
    // se ressemblent, et un index changerait au premier module désactivé.
    const tuile = page.getByRole('button', { name: /^Participants/ })

    await expect(tuile).toBeVisible({ timeout: 40000 })
    // Le mode de départ est celui d'avant le changement : rien ne bouge pour qui n'y touche pas.
    await expect(tuile).toContainText('par billet')
    await expect(tuile).toHaveAttribute('aria-pressed', 'false')

    await tuile.click()

    await expect(tuile).toContainText('par personne')
    await expect(tuile).toHaveAttribute('aria-pressed', 'true')

    // Le comptoir d'entrée rafraîchit sa page : le choix ne doit pas se perdre à chaque fois.
    await page.reload({ waitUntil: 'domcontentloaded' })
    const apresRechargement = page.getByRole('button', { name: /^Participants/ })
    await expect(apresRechargement).toContainText('par personne', { timeout: 40000 })

    await apresRechargement.click()
    await expect(apresRechargement).toContainText('par billet')

    await context.close()
  })
})
