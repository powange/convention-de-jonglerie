import type { Page } from '@playwright/test'

import { expect, test } from '@nuxt/test-utils/playwright'

import { apiPost, loadState, updateEdition } from '../helpers'

/**
 * Trésorerie d'une édition : `/editions/:id/gestion/treasury`.
 *
 * Un total faux reste un nombre plausible — c'est la raison d'être de ce parcours. Il vérifie
 * que la saisie aboutit réellement en base, que le solde retient les produits moins les charges,
 * et que l'imputation se rattache.
 */

/**
 * Les lignes affichées, charges et produits confondus.
 *
 * ⚠️ `<tr>` et non plus un `data-testid` : l'écran est passé d'une liste de blocs à deux `UTable`,
 * qui ne permet pas de poser un attribut par rangée. Le repère est donc la rangée elle-même — ce
 * qui vaut mieux, la rangée portant à la fois le libellé qu'on cherche et les boutons d'action.
 *
 * Les tableaux vides rendent une rangée « Aucune ligne » : elle ne porte aucun bouton et ne
 * ressort d'aucun filtre par titre, mais elle compte. Les parcours ci-dessous comparent des
 * écarts, jamais des valeurs absolues, ce qui la rend sans effet.
 */
const lignes = (page: Page) => page.locator('tbody tr')

test.describe.serial("Trésorerie d'une édition", () => {
  test('active la fonctionnalité', async ({ page }) => {
    const { editionId } = loadState()
    const response = await updateEdition(page, editionId, { treasuryEnabled: true })
    expect(response.ok(), `Activation échouée : ${await response.text()}`).toBe(true)
  })

  test('crée un code d’imputation', async ({ page }, testInfo) => {
    const { editionId } = loadState()
    // Le code est unique par convention. Un `describe.serial` rejoue tout le bloc à chaque
    // nouvelle tentative : avec un code figé, la 2ᵉ tentative se heurtait au code créé par la
    // 1ʳᵉ et échouait sur un conflit, masquant l'échec qui avait déclenché la reprise.
    const response = await apiPost(
      page,
      `http://localhost:3000/api/editions/${editionId}/treasury/codes`,
      { data: { code: `E2E-6257-${testInfo.retry}`, label: 'Rémunérations E2E' } }
    )
    expect(response.ok(), `Création du code échouée : ${await response.text()}`).toBe(true)
  })

  test('saisit une charge et un produit, et voit le solde', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/treasury`, { waitUntil: 'hydration' })
    await expect(page.getByRole('heading', { name: 'Trésorerie' })).toBeVisible({ timeout: 20000 })

    // Les lignes calculées sont toujours là, quel que soit leur montant. Leur nombre suit les
    // origines et change quand on en ajoute une — le compter en dur ferait échouer ce parcours
    // à chaque enrichissement de la trésorerie, sans qu'aucune régression n'ait eu lieu.
    const baseLines = await lignes(page).count()
    expect(baseLines, 'aucune ligne calculée : la trésorerie ne charge pas').toBeGreaterThan(0)

    // L'édition est partagée avec les autres parcours, qui y ajoutent des artistes : son solde
    // de départ n'est pas nul et dépend de l'ordre d'exécution. C'est l'écart qui prouve
    // l'arithmétique, pas la valeur absolue — l'ancienne attente d'un « 250,00 » figé tenait
    // d'une édition supposée vierge.
    const before = await readBalance(page)

    await addEntry(page, { kind: 'Charge', title: 'Location salle E2E', amount: 150 })
    await expect(lignes(page)).toHaveCount(baseLines + 1)

    await addEntry(page, { kind: 'Produit', title: 'Subvention E2E', amount: 400 })
    await expect(lignes(page)).toHaveCount(baseLines + 2)

    // 400 encaissés moins 150 dépensés : le solde doit progresser de 250, et lui seul le prouve.
    await expect.poll(() => readBalance(page), { timeout: 15000 }).toBeCloseTo(before + 250, 2)
  })

  /**
   * Les filtres, et ce qu'ils ne doivent PAS emporter avec eux.
   *
   * Un filtre qui se contenterait de masquer des rangées paraîtrait juste tout en mentant sur deux
   * points : le solde de l'édition, qui ne doit pas bouger, et l'URL, sans laquelle un écran
   * filtré ne se recopie ni ne survit à un rafraîchissement. Les deux sont vérifiés ici.
   */
  test('filtre par libellé sans toucher au solde de l’édition', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/treasury`, { waitUntil: 'hydration' })
    await expect(lignes(page).first()).toBeVisible({ timeout: 20000 })

    const toutes = await lignes(page).count()
    const soldeAvant = await readBalance(page)

    // Les mots DANS LE DÉSORDRE : c'est le propos de la recherche par mots-clés, et une recherche
    // d'un bloc ne trouverait rien ici.
    await page.getByLabel('Rechercher').fill('salle location')

    // La ligne cherchée reste, les autres partent. Le nombre exact dépend des lignes calculées de
    // l'édition : c'est la DIMINUTION qui prouve le filtre, pas une valeur figée.
    await expect(lignes(page).filter({ hasText: 'Location salle E2E' })).toHaveCount(1)
    await expect.poll(() => lignes(page).count(), { timeout: 10000 }).toBeLessThan(toutes)

    // Le sous-total du filtre apparaît — et les cartes du haut ne bougent pas : elles portent le
    // solde de l'ÉDITION, pas celui de l'affichage.
    await expect(page.getByTestId('treasury-filtered-subtotal')).toBeVisible()
    expect(await readBalance(page)).toBeCloseTo(soldeAvant, 2)

    // Porté par l'URL : sans cela, un écran filtré ne se partage pas et un rafraîchissement le perd.
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('salle location')

    await page.getByRole('button', { name: 'Effacer les filtres' }).click()
    await expect(page.getByTestId('treasury-filtered-subtotal')).toHaveCount(0)
    await expect.poll(() => lignes(page).count(), { timeout: 10000 }).toBe(toutes)
  })

  /**
   * Le clic droit ouvre les actions, NOMMÉES.
   *
   * La dernière colonne les réduit à des icônes : un crayon et une corbeille ne se distinguent
   * qu'au survol, ce qu'un écran tactile n'offre pas. Ce parcours vérifie que le second chemin
   * existe et qu'il nomme ce qu'il propose.
   */
  test('propose les actions au clic droit', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/treasury`, { waitUntil: 'hydration' })
    const ligne = lignes(page).filter({ hasText: 'Location salle E2E' })
    await expect(ligne).toHaveCount(1, { timeout: 20000 })

    await ligne.click({ button: 'right' })

    await expect(page.getByRole('menuitem', { name: 'Modifier' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Supprimer' })).toBeVisible()

    // Refermé sans rien choisir : ce parcours ne doit pas modifier les données qu'il observe.
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menuitem', { name: 'Supprimer' })).toHaveCount(0)
  })

  /**
   * Sur téléphone, les filtres passent dans une modale.
   *
   * Quatre contrôles côte à côte y sont illisibles, et empilés ils repousseraient le tableau hors
   * de l'écran. Le nombre affiché sur le bouton dit qu'un filtre est posé sans avoir à ouvrir.
   */
  test('replie les filtres derrière un bouton sur téléphone', async ({ page, goto }) => {
    const { editionId } = loadState()
    await page.setViewportSize({ width: 390, height: 844 })

    await goto(`/editions/${editionId}/gestion/treasury`, { waitUntil: 'hydration' })
    await expect(page.getByTestId('treasury-filters')).toBeVisible({ timeout: 20000 })

    // La barre de grand écran reste dans le DOM, masquée en CSS : aucun de ses champs n'est
    // visible. C'est la modale, et elle seule, qui les montre ensuite — d'où le repère restreint
    // au dialogue, sans quoi les deux copies du champ se confondent.
    await expect(page.getByLabel('Rechercher')).toBeHidden()

    await page.getByRole('button', { name: 'Filtres' }).click()
    const champ = page.getByRole('dialog').getByLabel('Rechercher')
    await expect(champ).toBeVisible()

    await champ.fill('Location salle E2E')
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('Location salle E2E')

    await page.keyboard.press('Escape')
    await expect(lignes(page).filter({ hasText: 'Location salle E2E' })).toHaveCount(1)
  })

  /**
   * Le choix des colonnes, et le fait qu'il vaille pour les DEUX tableaux.
   *
   * Charges et produits sont rendus séparément : sans visibilité partagée, masquer une colonne
   * d'un côté laisserait l'autre inchangé, et l'écran montrerait deux tableaux différents pour
   * une même trésorerie.
   */
  test('masque une colonne des deux tableaux à la fois', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/treasury`, { waitUntil: 'hydration' })
    await expect(lignes(page).first()).toBeVisible({ timeout: 20000 })

    const enTetes = page.getByRole('columnheader', { name: 'Description' })
    const avant = await enTetes.count()
    expect(avant, 'les deux tableaux portent la colonne Description').toBe(2)

    await page.getByRole('button', { name: 'Colonnes' }).first().click()
    await page.getByRole('menuitemcheckbox', { name: 'Description' }).click()

    await expect(enTetes).toHaveCount(0)

    // Porté par l'URL, comme les filtres : le réglage survit à un rafraîchissement.
    await expect
      .poll(() => new URL(page.url()).searchParams.get('colonnes'))
      .toContain('description')
  })

  test('retire les lignes saisies', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/treasury`, { waitUntil: 'hydration' })
    await expect(lignes(page).first()).toBeVisible({ timeout: 20000 })

    const before = await lignes(page).count()

    // Les lignes calculées n'ont pas de bouton de suppression : seules les saisies en portent un.
    for (const title of ['Location salle E2E', 'Subvention E2E']) {
      const row = lignes(page).filter({ hasText: title })
      await row.getByRole('button').last().click()
      await expect(row).toHaveCount(0, { timeout: 15000 })
    }

    // Les deux saisies partent, les lignes calculées restent.
    await expect(lignes(page)).toHaveCount(before - 2)
  })
})

/**
 * Lit le solde affiché et le rend en nombre.
 *
 * Le montant est formaté en français — séparateur de milliers insécable, virgule décimale —
 * et suivi du symbole de la devise de l'édition, qui n'est pas toujours l'euro.
 */
async function readBalance(page: import('@playwright/test').Page): Promise<number> {
  const text = await page
    .locator('div')
    .filter({ hasText: /^Solde/ })
    .last()
    .innerText()
  // Espaces possibles entre milliers : ordinaire, insécable (U+00A0), insécable étroite (U+202F).
  const SEP = '[ \\u00a0\\u202f]'
  const match = text.match(new RegExp(`-?(?:\\d|${SEP})*\\d(?:,\\d+)?`))
  if (!match) throw new Error(`Solde illisible : ${JSON.stringify(text)}`)
  return Number(match[0].replace(new RegExp(SEP, 'g'), '').replace(',', '.'))
}

async function addEntry(
  page: import('@playwright/test').Page,
  entry: { kind: 'Charge' | 'Produit'; title: string; amount: number }
) {
  await page.getByRole('button', { name: 'Ajouter une ligne' }).click()
  await page.getByRole('button', { name: entry.kind, exact: true }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox').first().fill(entry.title)

  // Le champ numérique ne commet sa valeur qu'à la sortie du champ : sans ce `Tab`, le modèle
  // reste à zéro et le bouton d'enregistrement demeure désactivé.
  const amount = dialog.getByRole('spinbutton')
  await amount.fill(String(entry.amount))
  await amount.press('Tab')

  const save = dialog.getByRole('button', { name: 'Enregistrer' })
  await expect(save, 'le formulaire est resté invalide après saisie').toBeEnabled({
    timeout: 10000,
  })
  await save.click()

  await expect(dialog).toBeHidden({ timeout: 15000 })
}
