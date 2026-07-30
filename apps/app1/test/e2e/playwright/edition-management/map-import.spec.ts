import { expect, test } from '@nuxt/test-utils/playwright'

import { apiPatch, loadState } from '../helpers'

/**
 * Import des objets d'une carte externe : `/editions/:id/gestion/map-import`.
 *
 * Cet écran a produit trois défauts d'affilée qui ne se voyaient qu'à l'usage : le rendu qui ne
 * se déclenchait pas après un import, l'état de la ligne qui ne basculait pas, et la suppression
 * qui laissait les boutons inchangés. Tous portaient sur l'état de la ligne **après** une action,
 * sans erreur ni dans la console ni côté serveur — d'où ce parcours.
 *
 * Dépendance assumée : la carte est récupérée **côté serveur**, `page.route()` ne peut donc pas
 * l'intercepter. Le test s'appuie sur une petite carte publique réelle ; si elle disparaît, la
 * première assertion échoue avec un message qui le dit.
 */

/** Carte de test publique, volontairement minuscule : 2 polygones et 2 points. */
const TEST_MAP_URL = 'https://www.google.com/maps/d/viewer?mid=1cgmDvOEFcwSwbkKyZ0NLXSv6UmyOFdg'

/** Repère posé sur la page pour détecter un rechargement, qui l'effacerait. */
const NO_RELOAD_MARKER = '__mapImportNoReload'

test.describe.serial("Import des objets d'une carte externe", () => {
  test('rattache une carte externe à l’édition', async ({ page }) => {
    const { editionId } = loadState()

    const response = await apiPatch(
      page,
      `http://localhost:3000/api/editions/${editionId}/external-map`,
      { data: { url: TEST_MAP_URL } }
    )

    expect(
      response.ok(),
      `Rattachement de la carte échoué (${response.status()}) : ${await response.text()}`
    ).toBe(true)
  })

  test('importe un objet, puis le retire, sans recharger la page', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/map-import`, { waitUntil: 'hydration' })

    // La liste vient d'un appel serveur vers le fournisseur : lui laisser le temps d'aboutir.
    const importButtons = page.getByRole('button', { name: 'Importer', exact: true })
    await expect(
      importButtons.first(),
      'Aucun objet importable : la carte de test est-elle toujours partagée publiquement ?'
    ).toBeVisible({ timeout: 45000 })

    // La ligne est repérée par son nom, pas par son bouton : le bouton « Importer » disparaît
    // justement au moment de l'import, et un localisateur fondé sur lui ne désignerait plus rien.
    const rows = page.getByTestId('map-import-row')
    const name = (
      await rows
        .filter({ has: page.getByRole('button', { name: 'Importer', exact: true }) })
        .first()
        .locator('p')
        .first()
        .innerText()
    ).trim()
    const row = rows.filter({ hasText: name }).first()

    // Repère qui ne survivrait pas à un rechargement de page.
    await page.evaluate((key) => {
      ;(window as unknown as Record<string, boolean>)[key] = true
    }, NO_RELOAD_MARKER)

    await row.getByRole('button', { name: 'Importer', exact: true }).click()

    // La ligne doit basculer d'elle-même : badge « Importé » et bouton « Retirer ».
    await expect(row.getByText('Importé', { exact: true })).toBeVisible({ timeout: 15000 })
    await expect(row.getByRole('button', { name: 'Retirer', exact: true })).toBeVisible()

    expect(
      await page.evaluate(
        (key) => (window as unknown as Record<string, boolean>)[key] === true,
        NO_RELOAD_MARKER
      ),
      "La page a été rechargée : l'import doit mettre à jour la ligne sur place"
    ).toBe(true)

    // Retrait : la confirmation passe par une modale.
    await row.getByRole('button', { name: 'Retirer', exact: true }).click()
    await page.getByRole('button', { name: 'Supprimer', exact: true }).click()

    // La ligne doit redevenir importable — c'est précisément ce qui restait figé.
    await expect(row.getByRole('button', { name: 'Importer', exact: true })).toBeVisible({
      timeout: 15000,
    })
    await expect(row.getByText('Importé', { exact: true })).toBeHidden()
    await expect(row.getByRole('button', { name: 'Retirer', exact: true })).toBeHidden()

    expect(
      await page.evaluate(
        (key) => (window as unknown as Record<string, boolean>)[key] === true,
        NO_RELOAD_MARKER
      ),
      'La page a été rechargée : le retrait doit mettre à jour la ligne sur place'
    ).toBe(true)
  })

  test('détache la carte externe pour ne rien laisser derrière', async ({ page }) => {
    const { editionId } = loadState()

    const response = await apiPatch(
      page,
      `http://localhost:3000/api/editions/${editionId}/external-map`,
      { data: { url: '' } }
    )
    expect(response.ok()).toBe(true)
  })
})
