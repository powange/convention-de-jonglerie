import { expect, test } from '@nuxt/test-utils/playwright'

import type { Page } from '@playwright/test'

import { apiPut } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Change la seule langue du profil, en renvoyant le reste tel quel.
 *
 * ⚠️ `/api/profile/update` attend un profil COMPLET — `pseudo` et `email` sont requis par son
 * schéma, et il compare l'email à celui de la session. Un corps partiel est refusé (400), et c'est
 * sur ce refus que la première version de cette spec est tombée. On relit donc la session avant
 * d'écrire, plutôt que de deviner les champs.
 */
async function choisirLaLangue(page: Page, langue: string) {
  const moi = await (await page.request.get(`${BASE}/api/session/me`)).json()
  const utilisateur = moi?.user ?? moi
  const reponse = await apiPut(page, `${BASE}/api/profile/update`, {
    data: {
      pseudo: utilisateur.pseudo,
      email: utilisateur.email,
      preferredLanguage: langue,
    },
  })
  expect(reponse.ok(), `réglage de la langue sur « ${langue} »`).toBe(true)
}

/**
 * La langue choisie dans le profil s'applique vraiment à l'interface.
 *
 * ⚠️ POURQUOI CETTE SPEC EXISTE, APRÈS DEUX CORRECTIFS. #629 était censé rendre ce réglage
 * effectif ; six jours plus tard, l'utilisateur signalait toujours une erreur en console et aucune
 * bascule. La cause : `appliquerLaLangueDuProfil` appelait `useI18n()` depuis une action Pinia, où
 * vue-i18n lève « Must be called at the top of a `setup` function ». Le `try/catch` avalait la
 * levée, et les tests unitaires BOUCHAIENT précisément `useI18n` — donc ne voyaient rien.
 *
 * 📍 Un test unitaire ne peut pas prouver ce point : il faut un vrai `setup` Vue, un vrai store
 * Pinia et un vrai vue-i18n pour que la contrainte s'applique. D'où cette spec, qui mesure les
 * DEUX symptômes signalés : l'erreur en console, et l'absence de bascule.
 *
 * ⚠️ `preferredLanguage` est NON NULLABLE et vaut « fr » par défaut : la fonction s'exécute donc
 * pour tout utilisateur connecté, à chaque chargement de page. L'erreur n'était pas un cas de
 * bord, elle était permanente.
 */
test.describe.serial('La langue du profil', () => {
  // L'utilisateur E2E est partagé par les specs de ce projet : on le remet en français à la fin,
  // sans quoi les specs voisines liraient une interface en anglais.
  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage()
    await choisirLaLangue(page, 'fr')
    await page.close()
  })

  test('s’applique à l’interface, sans erreur en console', async ({ page, goto }) => {
    const erreurs: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') erreurs.push(m.text())
    })
    page.on('pageerror', (e) => erreurs.push(e.message))

    // Une langue DIFFÉRENTE de celle du navigateur (fr-FR) : sinon la fonction sort par sa garde
    // « déjà la bonne langue » et il n'y aurait aucune bascule à observer.
    await choisirLaLangue(page, 'en')

    await goto('/', { waitUntil: 'hydration' })

    // ⚠️ LE SYMPTÔME EXACT SIGNALÉ. Il apparaissait à chaque chargement de page.
    await expect
      .poll(() => erreurs.filter((e) => e.includes('langue du profil')), { timeout: 15000 })
      .toEqual([])

    /*
     * Et la bascule elle-même, mesurée sur l'attribut que `@nuxtjs/i18n` tient à jour. C'est la
     * moitié qui compte : sans erreur mais sans effet, le réglage resterait aussi inopérant
     * qu'avant — et un réglage sans effet est pire qu'un réglage absent, on le rechange en
     * croyant s'être trompé.
     */
    await expect
      .poll(() => page.locator('html').getAttribute('lang'), { timeout: 15000 })
      .toMatch(/^en/)
  })

  test('revient au français quand le profil le demande', async ({ page, goto }) => {
    await choisirLaLangue(page, 'fr')

    await goto('/', { waitUntil: 'hydration' })

    await expect
      .poll(() => page.locator('html').getAttribute('lang'), { timeout: 15000 })
      .toMatch(/^fr/)
  })
})
