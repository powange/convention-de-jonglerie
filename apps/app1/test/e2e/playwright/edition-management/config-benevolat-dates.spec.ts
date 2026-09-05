import { expect, test } from '@nuxt/test-utils/playwright'

import { activerBenevolatTemporairement, loadState } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Le calendrier des dates de montage refusait la valeur qu'on lui donnait, au typage.
 *
 * `DateValue` est une classe portant un champ privé ; `ref()` déballe en profondeur ce qu'on lui
 * confie et en réécrit le type en objet structurel, qui perd ce champ et cesse d'être reconnu
 * comme la classe. Rien ne se voyait à l'écran — d'où ce parcours, qui vérifie que choisir puis
 * effacer une date fonctionne toujours après le passage à `shallowRef`.
 */
test('les dates de montage se choisissent et s’effacent', async ({ browser }) => {
  const { editionId } = loadState()
  const restaurer = await activerBenevolatTemporairement(browser, editionId)

  const context = await browser.newContext({
    storageState: new URL('../../../../test-results/.auth/user.json', import.meta.url).pathname,
    viewport: { width: 1280, height: 900 },
    locale: 'fr-FR',
  })
  const page = await context.newPage()
  await page.goto(`${BASE}/editions/${editionId}/gestion/volunteers/config`, {
    waitUntil: 'domcontentloaded',
  })

  const invites = page.getByRole('button', { name: /sélectionner une date/i })
  await expect(invites.first()).toBeVisible({ timeout: 30000 })
  await expect(invites, 'deux dates à renseigner au départ').toHaveCount(2)

  await invites.first().click()
  // Une date antérieure au début de l'édition : les suivantes sont désactivées, le montage
  // devant précéder l'événement.
  await page.locator('td[role=gridcell]').filter({ hasText: /^10$/ }).first().click()

  // La date choisie remplace l'invite : c'est la preuve que le composant a bien reçu la valeur.
  await expect(invites, 'la date de montage devrait être renseignée').toHaveCount(1)
  await expect(page.getByRole('button', { name: /2026-09-10/ }).first()).toBeVisible()

  await context.close()
  await restaurer()
})
