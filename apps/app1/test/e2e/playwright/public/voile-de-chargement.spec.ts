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
 * finissait par apparaître. Mais le délai se mesure DANS LA PAGE, en horloge interne : chronométré
 * depuis Node, il incluait la latence du harnais et échouait deux fois sur trois pour quelques
 * dizaines de millisecondes. Il ne mesure pas une performance, il vérifie qu'aucune attente n'est
 * réintroduite.
 *
 * ⚠️ LE REPÈRE EST L'HYDRATATION, ET NON `DOMContentLoaded`. Le contenu reste volontairement masqué
 * jusque-là : une première version le découvrait dès le rendu serveur, et quatre lots Playwright
 * sont tombés parce que leurs scénarios remplissaient un champ de mot de passe avant l'hydratation
 * — Vue le réinitialisait ensuite. Ce que ce voile empêche n'est donc pas seulement un saut de mise
 * en page, c'est de saisir dans un formulaire que personne n'écoute encore.
 */
test.describe('Voile de chargement', () => {
  test('🔬 l’attente ajoutée se borne au fondu, pas une milliseconde de plus', async ({
    page,
    goto,
  }) => {
    /*
     * ⚠️ LA MESURE A ÉTÉ DÉPLACÉE DANS LA PAGE, et sa RÉFÉRENCE corrigée. La version précédente
     * chronométrait depuis Node le temps qu'un localisateur mettait à voir le titre des filtres,
     * seuil 500 ms : relevé sur trois exécutions de `main`, 519, 531 et 568 ms — un échec deux fois
     * sur trois, toujours de quelques dizaines de millisecondes. Elle mesurait la latence du
     * harnais autant que l'application.
     *
     * ⚠️⚠️ ET UNE PREMIÈRE RÉÉCRITURE S'EST TROMPÉE DE REPÈRE : `window.useNuxtApp` est posé à la
     * CRÉATION du client Nuxt, bien avant le montage. Mesuré ainsi, l'écart valait 1 187 ms en
     * développement — c'était la durée d'hydratation, pas l'attente ajoutée. Un seuil calé dessus
     * n'aurait rien dit de l'application et beaucoup de la machine.
     *
     * 📍 LE BON REPÈRE EST LE DÉBUT DU FONDU. `app.vue` pose la classe `loading-screen--sortie` au
     * montage, puis retire le voile du DOM après `DUREE_DU_FONDU`. L'écart entre les deux est
     * exactement l'attente que l'application AJOUTE, et il ne dépend ni de la vitesse du coureur,
     * ni du réseau, ni des images.
     */
    await page.addInitScript(() => {
      const fenetre = window as unknown as {
        __voile: { apparu?: number; fondu?: number; disparu?: number }
      }
      fenetre.__voile = {}

      const voile = () => document.querySelector('.loading-screen')

      const guetterDisparition = () => {
        if (!voile()) fenetre.__voile.disparu = performance.now()
        else requestAnimationFrame(guetterDisparition)
      }
      const guetterFondu = () => {
        const element = voile()
        if (!element) {
          // Le voile est parti sans jamais passer par le fondu : on note tout de même l'instant,
          // le cas sera jugé plus bas.
          fenetre.__voile.disparu = performance.now()
          return
        }
        if (element.classList.contains('loading-screen--sortie')) {
          fenetre.__voile.fondu = performance.now()
          requestAnimationFrame(guetterDisparition)
        } else requestAnimationFrame(guetterFondu)
      }
      // D'abord qu'il paraisse : au premier appel le document est vide, et l'y chercher absent
      // serait toujours vrai.
      const guetterApparition = () => {
        if (voile()) {
          fenetre.__voile.apparu = performance.now()
          requestAnimationFrame(guetterFondu)
        } else requestAnimationFrame(guetterApparition)
      }
      requestAnimationFrame(guetterApparition)
    })

    await goto('/', { waitUntil: 'hydration' })

    const mesures = await page.waitForFunction(
      () => {
        const v = (window as unknown as { __voile: Record<string, number | undefined> }).__voile
        return v?.disparu !== undefined ? v : null
      },
      null,
      { timeout: 15000 }
    )
    const { apparu, fondu, disparu } = await mesures.jsonValue()

    /*
     * ⚠️⚠️ LE VOILE DOIT AVOIR EXISTÉ ET AVOIR FONDU. Sans ces deux vérifications, un voile
     * supprimé du code rendrait ce cas vert pour la pire des raisons : il ne mesurerait plus rien.
     * C'est le défaut que ce dépôt a payé plusieurs fois — une assertion satisfaite par l'absence
     * de ce qu'elle surveille.
     */
    expect(apparu, 'le voile n’est jamais apparu : ce cas ne mesurerait plus rien').toBeDefined()
    expect(fondu, 'le voile n’est jamais passé par le fondu').toBeDefined()

    const attenteAjoutee = disparu! - fondu!
    /*
     * `DUREE_DU_FONDU` vaut 300 ms dans `app.vue`. Le défaut d'origine en ajoutait MILLE, après
     * `load` — donc après les images. 600 ms laissent au fondu le double de sa durée et refusent
     * tout retour en arrière, sans rien devoir à la vitesse de la machine.
     */
    expect(
      attenteAjoutee,
      `le voile est resté ${Math.round(attenteAjoutee)} ms après le début du fondu`
    ).toBeLessThan(600)
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
