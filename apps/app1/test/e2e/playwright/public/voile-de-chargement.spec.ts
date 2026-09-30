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
 * ⚠️ POURQUOI CE TEST MESURE UN DÉLAI, ce qu'on évite d'ordinaire. Parce que le défaut EST un
 * délai : une assertion de visibilité seule serait restée verte avant comme après — le contenu
 * finissait par apparaître. Le seuil est donc volontairement large (500 ms, contre les 1 000 ms
 * fixes d'avant) : il ne mesure pas une performance, il vérifie qu'aucune attente n'est réintroduite.
 */
test.describe('Voile de chargement', () => {
  test('le contenu est visible moins de 500 ms après le chargement du DOM', async ({
    page,
    goto,
  }) => {
    // `domcontentloaded` et non `hydration` : c'est justement l'écart entre les deux que ce test
    // surveille, et attendre l'hydratation le rendrait aveugle.
    await goto('/', { waitUntil: 'domcontentloaded' })

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
      `le contenu a mis ${ecoule} ms à devenir visible après DOMContentLoaded`
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

  test('la page reste cliquable tout de suite', async ({ page, goto }) => {
    // Le corollaire du précédent, vérifié par l'usage plutôt que par le style : un lien de
    // l'en-tête doit répondre sans qu'on ait attendu la fin d'un fondu.
    await goto('/', { waitUntil: 'domcontentloaded' })

    const lien = page.getByRole('link', { name: /connexion/i }).first()
    await expect(lien).toBeVisible({ timeout: 5000 })
    await lien.click({ timeout: 3000 })

    await expect(page).toHaveURL(/\/login/)
  })
})
