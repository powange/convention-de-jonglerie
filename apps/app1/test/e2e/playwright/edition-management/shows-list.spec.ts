import { expect, test } from '@nuxt/test-utils/playwright'

import { createShow, deleteShow, loadState, updateEdition } from '../helpers'

const STAMP = Date.now()
const CABARET_TITLE = `E2E Cabaret liste ${STAMP}`
const ACT_1_TITLE = `E2E Numéro un ${STAMP}`
const ACT_2_TITLE = `E2E Numéro deux ${STAMP}`
const STANDARD_TITLE = `E2E Spectacle simple ${STAMP}`
const JETABLE_TITLE = `E2E Spectacle jetable ${STAMP}`

/**
 * Tableau des spectacles de la gestion : les numéros d'un cabaret y sont des sous-lignes.
 *
 * Rien ne couvrait cette page. Trois comportements ne se vérifient qu'ici, à l'écran :
 * un numéro occupe une ligne (et non une liste tassée sous le titre), le pliage cache et
 * rend ses lignes, et la ligne qu'UTable produit pour son slot `#expanded` — que la page
 * n'utilise pas — reste invisible.
 */
test.describe.serial('Tableau des spectacles (gestion)', () => {
  let editionId: string
  let cabaretId: number
  let standardId: number

  type Page = import('@playwright/test').Page

  // Une ligne du tableau, désignée par ce qu'elle affiche : l'édition est partagée avec les
  // autres specs, compter les lignes rendrait le test dépendant de leurs spectacles.
  const rowWith = (page: Page, text: string) => page.getByRole('row').filter({ hasText: text })

  // Chaque test reçoit une page neuve : sans cette navigation, les assertions porteraient sur
  // une page vide et passeraient sans rien vérifier.
  const openShowsPage = async (
    page: Page,
    goto: (path: string, options?: object) => Promise<unknown>
  ) => {
    // Première visite : en local, le serveur de développement compile la page à la volée
    await expect(async () => {
      await goto(`/editions/${editionId}/gestion/artists/shows`, { waitUntil: 'hydration' })
      await expect(rowWith(page, CABARET_TITLE).first()).toBeVisible({ timeout: 5000 })
    }).toPass({ timeout: 30000, intervals: [2000, 3000, 5000] })
  }

  test.beforeAll(() => {
    editionId = loadState().editionId
    if (!editionId) throw new Error('editionId manquant dans state.json (setup global non joué)')
  })

  test('préparer : un cabaret à deux numéros et un spectacle standard', async ({ page }) => {
    await updateEdition(page, editionId, { artistsEnabled: true })

    const cabaret = await createShow(page, editionId, {
      title: CABARET_TITLE,
      type: 'CABARET',
      startDateTime: new Date().toISOString(),
      duration: 90,
      acts: [
        { title: ACT_1_TITLE, duration: 10 },
        { title: ACT_2_TITLE, duration: 15 },
      ],
    })
    expect(cabaret.type).toBe('CABARET')
    cabaretId = cabaret.id

    const standard = await createShow(page, editionId, {
      title: STANDARD_TITLE,
      startDateTime: new Date().toISOString(),
      duration: 45,
    })
    expect(standard.type).toBe('STANDARD')
    standardId = standard.id
  })

  test('les numéros du cabaret sont des lignes, dépliées à l’ouverture', async ({ page, goto }) => {
    await openShowsPage(page, goto)

    const cabaretRow = rowWith(page, CABARET_TITLE).first()
    await expect(cabaretRow).toContainText('Cabaret')
    await expect(cabaretRow).toContainText('2 numéro(s)')

    // Chaque numéro a sa propre ligne, avec son rang et sa durée dans les colonnes
    const firstAct = rowWith(page, ACT_1_TITLE).first()
    await expect(firstAct).toBeVisible()
    await expect(firstAct).toContainText('Numéro 1')
    await expect(firstAct).toContainText('10 min')
    await expect(rowWith(page, ACT_2_TITLE).first()).toContainText('Numéro 2')

    // La ligne du slot `#expanded` d'UTable : une cellule unique et vide, là où une vraie
    // ligne en a sept. Elle est rendue mais doit rester masquée.
    await expect(page.locator('tbody tr:visible > td:only-child')).toHaveCount(0)

    // Un spectacle standard n'a pas de numéro : son chevron reste masqué
    const standardRow = rowWith(page, STANDARD_TITLE).first()
    await expect(standardRow).toBeVisible()
    await expect(
      standardRow.getByRole('button', { name: /afficher ou masquer les numéros/i })
    ).toBeHidden()
  })

  test('le chevron replie puis redéplie les numéros', async ({ page, goto }) => {
    await openShowsPage(page, goto)

    const toggle = rowWith(page, CABARET_TITLE)
      .first()
      .getByRole('button', { name: /afficher ou masquer les numéros/i })

    await toggle.click()
    await expect(rowWith(page, ACT_1_TITLE)).toHaveCount(0)
    await expect(rowWith(page, ACT_2_TITLE)).toHaveCount(0)
    // Le cabaret, lui, reste affiché : c'est son déroulé qui est replié
    await expect(rowWith(page, CABARET_TITLE).first()).toBeVisible()

    await toggle.click()
    await expect(rowWith(page, ACT_1_TITLE).first()).toBeVisible()
  })

  test('la modale de suppression se referme après confirmation', async ({ page, goto }) => {
    // `UiConfirmModal` n'émet que `confirm` et `cancel` : la refermer revient à l'appelant, qui
    // l'oubliait. La modale restait ouverte, et reconfirmer envoyait un DELETE sur un
    // identifiant déjà vidé — `/shows/undefined` dans les journaux de production. Les autres
    // specs suppriment par l'API et ne pouvaient rien en voir.
    await openShowsPage(page, goto)

    const jetable = await createShow(page, editionId, {
      title: JETABLE_TITLE,
      startDateTime: new Date().toISOString(),
    })

    await goto(`/editions/${editionId}/gestion/artists/shows`, { waitUntil: 'hydration' })
    const ligne = rowWith(page, JETABLE_TITLE).first()
    await expect(ligne).toBeVisible({ timeout: 15000 })

    // Le dernier bouton de la ligne — la corbeille — ouvre directement la confirmation :
    // cette page n'a pas de menu d'actions.
    await ligne.getByRole('button').last().click()

    const confirmer = page.getByRole('button', { name: /^Confirmer$/i })
    await expect(confirmer).toBeVisible()
    await confirmer.click()

    // Ce que l'utilisateur constatait : la modale restait à l'écran malgré la suppression
    await expect(confirmer).toBeHidden({ timeout: 15000 })
    await expect(rowWith(page, JETABLE_TITLE)).toHaveCount(0)

    expect(jetable.id).toBeTruthy()
  })

  test('la modale de suppression se referme aussi à l’annulation', async ({ page, goto }) => {
    await openShowsPage(page, goto)

    const ligne = rowWith(page, STANDARD_TITLE).first()
    await ligne.getByRole('button').last().click()

    const annuler = page.getByRole('button', { name: /^Annuler$/i })
    await expect(annuler).toBeVisible()
    await annuler.click()

    await expect(annuler).toBeHidden({ timeout: 10000 })
    // Annuler ne supprime rien : le spectacle est toujours là
    await expect(rowWith(page, STANDARD_TITLE).first()).toBeVisible()
  })

  test('nettoyage : supprimer les spectacles et désactiver les artistes', async ({ page }) => {
    if (cabaretId) await deleteShow(page, editionId, cabaretId)
    if (standardId) await deleteShow(page, editionId, standardId)
    await updateEdition(page, editionId, { artistsEnabled: false })
  })
})
