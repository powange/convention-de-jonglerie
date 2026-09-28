import { expect, test } from '@nuxt/test-utils/playwright'

import type { Page } from '@playwright/test'

/**
 * La loupe de l'en-tête, vue depuis un vrai navigateur.
 *
 * Ce que le test de composant ne peut pas dire : que la page réagit vraiment à ce que la loupe
 * écrit dans l'URL. `pages/index.vue` observe `route.query` et en redéduit ses filtres — une
 * mécanique qui n'existe qu'à l'exécution, et dont la seule preuve est ici : la case « Éditions
 * terminées » du panneau latéral doit se cocher toute seule.
 *
 * Les spécifications de ce dossier tournent sans authentification, sur les données du serveur de
 * développement. Rien n'y est créé ni supprimé : on tape un nom, on lit l'URL et le panneau.
 */

const loupe = (page: Page) => page.getByRole('button', { name: /rechercher une édition/i })
const champ = (page: Page) => page.getByPlaceholder(/nom de l'édition/i)
/** Un témoin de ce que la recherche masque, et qui doit revenir quand on la referme. */
const connexion = (page: Page) => page.getByRole('link', { name: /connexion/i }).first()

test.describe("Recherche d'édition dans l'en-tête", () => {
  test("la loupe est sur l'accueil, et nulle part ailleurs", async ({ page, goto }) => {
    // Deux pages hydratées dans un même test, dont une qu'aucune autre spécification de ce fichier
    // ne visite : en développement, le serveur la compile à la première visite, et l'attente
    // d'hydratation dépassait alors le délai par défaut. En CI, l'application est pré-construite.
    test.slow()

    await goto('/', { waitUntil: 'hydration' })
    await expect(loupe(page)).toBeVisible()

    await goto('/login', { waitUntil: 'hydration' })
    await expect(loupe(page)).toHaveCount(0)
  })

  test("le champ déployé prend l'en-tête et en masque le titre", async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })

    const titre = page.getByText('Convention de Jonglerie', { exact: true }).first()
    await expect(titre).toBeVisible()

    await loupe(page).click()

    await expect(champ(page)).toBeVisible()
    await expect(connexion(page)).toBeHidden()
    // Le titre cède la place : c'est ce qui libère la largeur, et sans quoi le champ serait
    // inutilisable sur un téléphone où l'en-tête porte déjà quatre boutons.
    await expect(titre).toBeHidden()
    await expect(loupe(page)).toHaveCount(0)

    // Et la largeur est bien prise, pas seulement libérée : le champ occupe la majeure partie de
    // l'en-tête. Sans le `w-full`, il garderait la largeur de son contenu et l'assertion tomberait.
    const champDeployé = await champ(page).boundingBox()
    const entete = await page.locator('header').first().boundingBox()
    expect(champDeployé!.width).toBeGreaterThan(entete!.width * 0.7)
  })

  test('chercher un nom ouvre les éditions terminées et écarte les autres filtres', async ({
    page,
    goto,
  }) => {
    // On arrive avec un filtre déjà posé, pour que son effacement se constate.
    await goto('/?countries=%5B%22France%22%5D', { waitUntil: 'hydration' })

    await loupe(page).click()
    await champ(page).fill('Rennes')

    await expect(page).toHaveURL(/name=Rennes/)
    await expect(page).toHaveURL(/showPast=true/)
    await expect(page).toHaveURL(/sort=recent/)
    await expect(page).not.toHaveURL(/countries/)

    // La preuve que la page a bien repris la main sur ses filtres, et pas seulement l'URL.
    await expect(page.getByRole('checkbox', { name: /éditions terminées/i })).toBeChecked()
  })

  test('les résultats arrivent de la plus récente à la plus ancienne', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })
    await loupe(page).click()

    // On lit la réponse du serveur plutôt que l'ordre des cartes à l'écran : c'est le même fait,
    // mais il ne dépend pas de ce que contient la base de développement au moment du test.
    const reponse = page.waitForResponse(
      (r) => r.url().includes('/api/editions?') && r.url().includes('sort=recent')
    )
    await champ(page).fill('convention')

    const corps = await (await reponse).json()
    const debuts: string[] = (corps.data ?? []).map((edition: { startDate: string }) =>
      new Date(edition.startDate).toISOString()
    )
    expect(debuts).toEqual([...debuts].sort().reverse())
  })

  test('la croix efface la recherche et referme le champ', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })
    await loupe(page).click()
    await champ(page).fill('Rennes')
    await expect(page).toHaveURL(/name=Rennes/)

    // Une seule croix dans le champ, et elle fait les deux : effacer et refermer.
    await page.getByRole('button', { name: /fermer/i }).click()

    await expect(champ(page)).toHaveCount(0)
    await expect(loupe(page)).toBeVisible()
    // Le reste de l'en-tête revient. Ce n'est pas acquis : il est masqué par un `v-show` posé sur
    // un conteneur en `display: contents`, et les deux règles se disputent la même propriété.
    await expect(connexion(page)).toBeVisible()
    await expect(page).not.toHaveURL(/name=/)
    await expect(page.getByRole('checkbox', { name: /éditions terminées/i })).not.toBeChecked()
  })
})
