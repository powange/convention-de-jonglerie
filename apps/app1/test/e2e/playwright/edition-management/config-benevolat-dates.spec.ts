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

  /*
   * Le PREMIER jour sélectionnable, et non un quantième écrit en dur.
   *
   * Le calendrier s'ouvre sur le mois du début de l'édition, et tout ce qui suit ce début est
   * désactivé — le montage doit le précéder. Or l'édition d'essai naît à « aujourd'hui + 7 jours »
   * (`data.setup.ts`) : un jour fixe cesse donc d'être valide dès que ce décalage change de mois.
   * C'est arrivé le 24/09/2026, où le 10 visé est devenu le 10 octobre, postérieur au début de
   * l'édition — le test a échoué sans qu'aucun code applicatif ait bougé.
   */
  const jourSelectionnable = page
    .locator('td[role=gridcell][aria-disabled="false"] [data-reka-calendar-cell-trigger]')
    .first()
  await expect(jourSelectionnable, 'un jour devrait rester sélectionnable').toBeVisible()
  // Le déclencheur porte la date en ISO : on la relève pour la vérifier ensuite, plutôt que de
  // la réécrire. L'assertion reste donc aussi précise qu'avant, sans être datée.
  const dateChoisie = await jourSelectionnable.getAttribute('data-value')
  expect(dateChoisie, 'le calendrier devrait exposer la date de la cellule').toMatch(
    /^\d{4}-\d{2}-\d{2}$/
  )
  await jourSelectionnable.click()

  // La date choisie remplace l'invite : c'est la preuve que le composant a bien reçu la valeur.
  await expect(invites, 'la date de montage devrait être renseignée').toHaveCount(1)
  // Et elle s'affiche telle quelle, ce qui n'arrive que si le composant tient une vraie
  // `DateValue` — c'est la régression de typage que ce parcours garde.
  await expect(page.getByRole('button', { name: dateChoisie! }).first()).toBeVisible()

  // Puis on l'efface — et pas seulement pour couvrir ce chemin. Une date de montage restreint
  // la période où un créneau bénévole peut être créé : la laisser en place sur l'édition
  // partagée faisait échouer les specs suivantes, qui n'arrivaient plus à poser leurs créneaux.
  await page
    .getByRole('button', { name: /effacer|clear/i })
    .first()
    .click()
  await expect(invites, 'la date devrait être effaçable').toHaveCount(2)

  await context.close()
  await restaurer()
})
