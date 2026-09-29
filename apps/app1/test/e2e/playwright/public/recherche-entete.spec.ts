import { expect, test } from '@nuxt/test-utils/playwright'

import type { Page } from '@playwright/test'

/**
 * La recherche de l'en-tête, vue depuis un vrai navigateur.
 *
 * Ce que le test de composant ne peut pas dire : que la page réagit vraiment à ce que la recherche
 * écrit dans l'URL. `pages/index.vue` observe `route.query` et en redéduit ses filtres — une
 * mécanique qui n'existe qu'à l'exécution, et dont la seule preuve est ici : la case « Éditions
 * terminées » du panneau latéral doit se cocher toute seule.
 *
 * ⚠️ **Deux rendus selon la largeur**, et c'est ce qui commande le découpage de ce fichier. Sur
 * grand écran, le champ est posé en permanence au centre de l'en-tête — une loupe seule ne disait
 * pas ce qu'elle cherchait. Sur téléphone, où l'en-tête porte déjà quatre boutons, la loupe reste,
 * et déploie le champ sur toute la largeur. `UHeader` masque sa région centrale sous `lg` : la
 * bascule vient de là, et un test joué à la mauvaise largeur ne trouve rien.
 *
 * Les spécifications de ce dossier tournent sans authentification, sur les données du serveur de
 * développement. Rien n'y est créé ni supprimé : on tape un nom, on lit l'URL et le panneau.
 */

/** Le champ permanent du centre, sur grand écran. */
const champCentre = (page: Page) => page.getByPlaceholder(/rechercher une édition/i)
/** La loupe du mobile, et le champ qu'elle déploie. */
const loupe = (page: Page) => page.getByRole('button', { name: /rechercher une édition/i })
const champDeploye = (page: Page) => page.getByPlaceholder(/nom de l'édition/i)
/** Un témoin de ce que la recherche masque sur mobile, et qui doit revenir quand on la referme. */
const connexion = (page: Page) => page.getByRole('link', { name: /connexion/i }).first()

test.describe("Recherche d'édition — grand écran", () => {
  test("le champ est au centre de l'accueil, et nulle part ailleurs", async ({ page, goto }) => {
    // Deux pages hydratées dans un même test, dont une qu'aucune autre spécification de ce fichier
    // ne visite : en développement, le serveur la compile à la première visite, et l'attente
    // d'hydratation dépassait alors le délai par défaut. En CI, l'application est pré-construite.
    test.slow()

    await goto('/', { waitUntil: 'hydration' })
    // Sans avoir rien cliqué : c'est tout le propos de cette variante.
    await expect(champCentre(page)).toBeVisible()

    await goto('/login', { waitUntil: 'hydration' })
    await expect(champCentre(page)).toHaveCount(0)
  })

  test('chercher un nom ouvre les éditions terminées et écarte les autres filtres', async ({
    page,
    goto,
  }) => {
    // On arrive avec un filtre déjà posé, pour que son effacement se constate.
    await goto('/?countries=%5B%22France%22%5D', { waitUntil: 'hydration' })

    await champCentre(page).fill('Rennes')

    await expect(page).toHaveURL(/name=Rennes/)
    await expect(page).toHaveURL(/showPast=true/)
    await expect(page).toHaveURL(/sort=recent/)
    await expect(page).not.toHaveURL(/countries/)

    // La preuve que la page a bien repris la main sur ses filtres, et pas seulement l'URL.
    await expect(page.getByRole('checkbox', { name: /éditions terminées/i })).toBeChecked()
  })

  /**
   * L'ordre, tel qu'il est AFFICHÉ — et non tel que l'API le rend.
   *
   * ⚠️ La distinction n'est pas une précaution de style : c'est ce qui a laissé passer le défaut.
   * Le store retriait la liste par ordre CROISSANT après chaque chargement, retournant la réponse
   * du serveur avant de l'afficher. La recherche montrait donc l'édition la plus ancienne en tête,
   * alors que `sort=recent` partait bien dans la requête et que le serveur répondait juste.
   *
   * Un test qui lisait la réponse passait au vert sans rien prouver de ce qu'on voit. Celui-ci
   * compare les deux : le serveur trie, et la première carte est bien la première réponse.
   */
  test('les résultats affichés vont de la plus récente à la plus ancienne', async ({
    page,
    goto,
  }) => {
    await goto('/', { waitUntil: 'hydration' })

    const reponse = page.waitForResponse(
      (r) => r.url().includes('/api/editions?') && r.url().includes('sort=recent')
    )
    await champCentre(page).fill('convention')

    const corps = await (await reponse).json()
    const editions: { name: string | null; startDate: string }[] = corps.data ?? []
    expect(
      editions.length,
      'la recherche ne rend rien : le test ne prouverait rien'
    ).toBeGreaterThan(1)

    // Le serveur trie décroissant.
    const debuts = editions.map((e) => new Date(e.startDate).toISOString())
    expect(debuts).toEqual([...debuts].sort().reverse())

    // Et l'écran respecte cet ordre. Le panneau de filtres porte son titre dans la même balise que
    // les cartes : viser « le premier titre » tombait sur lui, d'où l'écart explicite.
    const premiereAttendue = editions.find((e) => e.name)?.name
    const titres = (await page.locator('h2').allInnerTexts())
      .map((t) => t.trim())
      .filter((t) => t !== 'Filtres')
    expect(titres[0]).toBe(premiereAttendue)
  })

  test('le champ reprend ce que l’URL porte déjà', async ({ page, goto }) => {
    // Le cas d'une adresse partagée. Un champ vide au-dessus de résultats filtrés ferait chercher
    // la cause du filtre dans le panneau latéral, où elle n'est pas.
    await goto('/?name=Rennes&showPast=true&sort=recent', { waitUntil: 'hydration' })

    await expect(champCentre(page)).toHaveValue('Rennes')
  })

  test('la croix efface la recherche sans replier le champ', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })
    await champCentre(page).fill('Rennes')
    await expect(page).toHaveURL(/name=Rennes/)

    await page
      .getByRole('button', { name: /effacer/i })
      .first()
      .click()

    // La différence avec la loupe du mobile : le champ reste à l'écran, il n'y a rien à replier.
    await expect(champCentre(page)).toBeVisible()
    await expect(champCentre(page)).toHaveValue('')
    await expect(page).not.toHaveURL(/name=/)
    await expect(page.getByRole('checkbox', { name: /éditions terminées/i })).not.toBeChecked()
  })
})

test.describe("Recherche d'édition — téléphone", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("la loupe déploie un champ qui prend tout l'en-tête", async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })

    // Le champ du centre n'est pas rendu à cette largeur : c'est la loupe qui commande.
    await expect(champCentre(page)).toBeHidden()

    const titre = page.getByText('Convention de Jonglerie', { exact: true }).first()
    await loupe(page).click()

    await expect(champDeploye(page)).toBeVisible()
    await expect(connexion(page)).toBeHidden()
    // Le titre cède la place : c'est ce qui libère la largeur, et sans quoi le champ serait
    // inutilisable sur un téléphone où l'en-tête porte déjà quatre boutons.
    await expect(titre).toBeHidden()
    await expect(loupe(page)).toHaveCount(0)

    // Et la largeur est bien prise, pas seulement libérée. Sans le `w-full`, le champ garderait la
    // largeur de son contenu et l'assertion tomberait.
    const boite = await champDeploye(page).boundingBox()
    const entete = await page.locator('header').first().boundingBox()
    expect(boite!.width).toBeGreaterThan(entete!.width * 0.7)
  })

  test('la croix efface la recherche et referme le champ', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })
    await loupe(page).click()
    await champDeploye(page).fill('Rennes')
    await expect(page).toHaveURL(/name=Rennes/)

    // Une seule croix dans le champ, et elle fait les deux : effacer et refermer.
    await page.getByRole('button', { name: /fermer/i }).click()

    await expect(champDeploye(page)).toHaveCount(0)
    await expect(loupe(page)).toBeVisible()
    // Le reste de l'en-tête revient. Ce n'est pas acquis : il est masqué par un `v-show` posé sur
    // un conteneur en `display: contents`, et les deux règles se disputent la même propriété.
    await expect(connexion(page)).toBeVisible()
    await expect(page).not.toHaveURL(/name=/)
  })
})
