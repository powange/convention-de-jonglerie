import { expect, test } from '@nuxt/test-utils/playwright'

/**
 * Le voile de chargement ne doit plus retarder une page déjà rendue.
 *
 * ⚠️ CE QU'IL FAISAIT. Le contenu, écrit par le serveur, était masqué jusqu'à
 * `document.readyState === 'complete'` PUIS mille millisecondes d'animation. Sur tout chargement
 * complet, c'était au moins une seconde de plus devant une page déjà prête — et bien davantage
 * quand les affiches d'éditions tardaient, puisque `load` les attend.
 *
 * Mesuré avant correction, en profil mobile bridé (Slow 4G, processeur ÷4), médiane de trois
 * passes : LCP de 13 344 ms sur l'accueil pour un `load` à 9 493 ms. L'écart, c'était ce voile.
 *
 * ⚠️ POURQUOI CES TESTS MESURENT UN DÉLAI, ce qu'on évite d'ordinaire. Parce que le défaut EST un
 * délai : une assertion de visibilité seule serait restée verte avant comme après — le contenu
 * finissait par apparaître. Le seuil est donc volontairement large (500 ms, contre les 1 000 ms
 * fixes d'avant) : il ne mesure pas une performance, il vérifie qu'aucune attente n'est réintroduite.
 *
 * ⚠️ LE REPÈRE EST L'HYDRATATION, ET NON `DOMContentLoaded`. Le contenu reste volontairement masqué
 * jusque-là : une première version le découvrait dès le rendu serveur, et quatre lots Playwright
 * sont tombés parce que leurs scénarios remplissaient un champ de mot de passe avant l'hydratation
 * — Vue le réinitialisait ensuite. Ce que ce voile empêche n'est donc pas seulement un saut de mise
 * en page, c'est de saisir dans un formulaire que personne n'écoute encore.
 */
test.describe('Voile de chargement', () => {
  test('le contenu est visible moins de 500 ms après l’hydratation', async ({ page, goto }) => {
    // C'est l'attente APRÈS l'hydratation que ce test surveille : les mille millisecondes fixes
    // d'animation, plus l'attente de `load` — donc des images — qui les précédait.
    await goto('/', { waitUntil: 'hydration' })

    const depart = Date.now()
    /*
     * Le titre du panneau de filtres, et non un `h1` : l'accueil n'en a pas — vérifié, la première
     * version de ce test le cherchait et ne trouvait rien. Ce titre-là est rendu par le serveur et
     * ne dépend d'aucune donnée, contrairement aux titres des cartes d'édition.
     */
    const titre = page.getByRole('heading', { name: /filtres/i }).first()
    await expect(titre).toBeVisible({ timeout: 5000 })
    const ecoule = Date.now() - depart

    expect(
      ecoule,
      `le contenu a mis ${ecoule} ms à devenir visible après l'hydratation`
    ).toBeLessThan(500)
  })

  test('le voile disparaît du DOM, il ne reste pas transparent devant la page', async ({
    page,
    goto,
  }) => {
    /*
     * Un `position: fixed` laissé en place, même à `opacity: 0`, continuerait d'intercepter les
     * clics : la page paraîtrait chargée et ne répondrait à rien. C'est le genre de défaut qu'on
     * n'attribue jamais à un écran de chargement.
     */
    await goto('/', { waitUntil: 'hydration' })

    await expect(page.locator('.loading-screen')).toHaveCount(0, { timeout: 5000 })
  })

  test('la page est cliquable dès l’hydratation', async ({ page, goto }) => {
    // Le corollaire du précédent, vérifié par l'usage plutôt que par le style : un lien doit
    // répondre sans qu'on ait attendu la fin d'un fondu ni le chargement des images.
    await goto('/', { waitUntil: 'hydration' })

    const lien = page.getByRole('link', { name: /connexion/i }).first()
    await expect(lien).toBeVisible({ timeout: 5000 })
    await lien.click({ timeout: 3000 })

    await expect(page).toHaveURL(/\/login/)
  })
})
