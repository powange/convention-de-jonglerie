import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPut, loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Le fonds de caisse d'une édition : les apports, les restitutions, le comptage de clôture.
 *
 * ## Ce que ce parcours éprouve, et pourquoi il faut un navigateur
 *
 * La page est rendue côté client et derrière une authentification : un 200 par `curl` ne dirait
 * rien. Ce qui est vérifié ici, c'est la chaîne complète — saisir un apport dans la modale, le
 * voir arriver dans la liste, voir les cartes se recalculer, et voir une restitution basculer.
 *
 * ## ⚠️ L'INVARIANT, et pourquoi il n'est PAS numérique
 *
 * Le fonds de caisse ne doit entrer dans aucun total du compte de résultat. Le réflexe serait de
 * relever les totaux avant et après et d'en vérifier l'égalité — mais **les lots Playwright
 * tournent en parallèle sur la même base**, et les parcours d'artistes créent des lignes de
 * trésorerie calculées. Une égalité de totaux échouerait donc sur une course, pas sur un défaut.
 *
 * L'assertion retenue est structurelle, et elle est plus forte : la charge utile de `/treasury` ne
 * contient **aucune trace** des apports — ni le montant, ni le libellé, ni la moindre clé. Si la
 * donnée n'y est pas, aucun total ne peut la compter, quelle que soit l'arithmétique.
 */
test.describe.serial('Fonds de caisse d’une édition', () => {
  // Des montants reconnaissables : on les cherchera dans la charge utile de la trésorerie.
  const PRET_A = 777.77
  const PRET_B = 333.33
  const COMPTE = 1000
  const PRETEUR = `Prêteur E2E ${Date.now()}`

  const ouvrirLaPage = async (page: any, goto: any) => {
    const { editionId } = loadState()
    await expect(async () => {
      await goto(`/editions/${editionId}/gestion/treasury/cash-float`, { waitUntil: 'hydration' })
      await expect(page.getByRole('heading', { name: 'Fonds de caisse' })).toBeVisible({
        timeout: 5000,
      })
    }).toPass({ timeout: 60000, intervals: [2000, 3000, 5000] })
  }

  /** La valeur d'une carte de synthèse, visée par son libellé et non par sa position. */
  const carte = (page: any, libelle: string) =>
    page.locator('[data-carte-fonds-de-caisse]', { hasText: libelle }).locator('p').nth(1)

  const apportsEnBase = async (page: any) => {
    const { editionId } = loadState()
    const res = await page.request.get(`${BASE}/api/editions/${editionId}/treasury/cash-float`)
    expect(res.ok(), `GET cash-float a échoué : ${await res.text()}`).toBe(true)
    const corps = await res.json()
    return (corps.data ?? corps) as {
      apports: { id: number }[]
      etat: {
        totalApporte: number
        totalRestitue: number
        resteARestituer: number
        compte: number | null
        disponibleApresRestitutions: number | null
      }
    }
  }

  /**
   * ⚠️ REPARTIR D'UN ÉTAT CONNU, et non de ce qu'un run précédent a laissé.
   *
   * Sans cette remise à zéro, le test « part à zéro » retrouvait au réessai le comptage et les
   * apports du passage d'avant, et échouait pour une raison qui n'est pas la sienne. Le comptage
   * vit sur l'ÉDITION : il survit à la suppression des apports, et c'est précisément ce qu'on
   * oublie.
   */
  const remiseAZero = async (page: any) => {
    const { editionId } = loadState()
    const { apports } = await apportsEnBase(page)
    for (const apport of apports) {
      const res = await apiDelete(
        page,
        `${BASE}/api/editions/${editionId}/treasury/cash-float/${apport.id}`
      )
      expect(res.ok(), `DELETE a échoué : ${await res.text()}`).toBe(true)
    }
    const res = await apiPut(page, `${BASE}/api/editions/${editionId}/treasury/cash-float-count`, {
      data: { count: null },
    })
    expect(res.ok(), `remise à zéro du comptage : ${await res.text()}`).toBe(true)

    const fin = await apportsEnBase(page)
    expect(fin.apports).toHaveLength(0)
    expect(fin.etat.compte).toBeNull()
  }

  test('activer la trésorerie', async ({ page }) => {
    const { editionId } = loadState()
    if (!editionId) throw new Error('editionId manquant dans state.json (setup global non joué)')
    await updateEdition(page, String(editionId), { treasuryEnabled: true })
  })

  test('la page s’ouvre, explique pourquoi elle est à part, et part à zéro', async ({
    page,
    goto,
  }) => {
    await remiseAZero(page)
    await ouvrirLaPage(page, goto)

    // L'encart d'explication : sans lui, on croirait à un oubli dans le compte de résultat.
    await expect(page.getByText('Hors du compte de résultat')).toBeVisible()
    await expect(page.locator('[data-carte-fonds-de-caisse]')).toHaveCount(4)

    // Rien n'est compté : le disponible n'est pas zéro, il est INDÉTERMINÉ.
    await expect(carte(page, 'Disponible après restitutions')).toHaveText('—')
  })

  test('saisir deux apports depuis la modale, dont un prêteur sans compte', async ({
    page,
    goto,
  }) => {
    await ouvrirLaPage(page, goto)

    for (const [montant, nom] of [
      [PRET_A, PRETEUR],
      [PRET_B, PRETEUR],
    ] as const) {
      await page.getByRole('button', { name: 'Ajouter un apport' }).click()
      const modale = page.getByRole('dialog')
      await expect(modale).toBeVisible()
      await modale.getByLabel('Montant prêté', { exact: true }).fill(String(montant))
      // Le prêteur n'a pas de compte : c'est le cas le plus courant sur une convention.
      await modale.getByRole('button', { name: 'Un autre nom' }).click()
      await modale.getByPlaceholder('Choisir ou saisir un nom').fill(nom)
      await modale.getByRole('button', { name: 'Enregistrer' }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
    }

    /*
     * Les deux apports du MÊME nom forment une seule dette : c'est la règle partagée avec les
     * avances (`cleDuNomAvance`). Deux lignes pour la même personne, et une restitution n'en
     * solderait qu'une.
     */
    const total = PRET_A + PRET_B
    await expect(carte(page, 'Apporté par les prêteurs')).toContainText('1 111,10')
    await expect(carte(page, 'Reste à rendre')).toContainText('1 111,10')
    await expect(page.locator('[data-preteur]')).toHaveCount(1)
    await expect(page.locator('[data-preteur]').first()).toContainText(PRETEUR)

    const { etat } = await apportsEnBase(page)
    expect(etat.totalApporte).toBe(Math.round(total * 100))
    expect(etat.resteARestituer).toBe(Math.round(total * 100))
  })

  /*
   * ⚠️ LE CALCUL QUI COMPTE, et le piège qu'il évite. Le disponible vaut `compté − reste à rendre`,
   * jamais `compté − apporté` : un prêt déjà rendu a quitté la caisse, et la soustraction naïve le
   * compterait comme s'il y était encore. Ici rien n'est encore rendu, donc les deux coïncident —
   * le test suivant les sépare.
   */
  test('le comptage de clôture donne le disponible après restitutions', async ({ page, goto }) => {
    await ouvrirLaPage(page, goto)

    await page.getByLabel('Compté dans la caisse à la clôture').fill(String(COMPTE))
    await page.getByRole('button', { name: 'Enregistrer' }).first().click()

    await expect(carte(page, 'Disponible après restitutions')).toContainText('-111,10')
    const { etat } = await apportsEnBase(page)
    expect(etat.compte).toBe(COMPTE * 100)
    expect(etat.disponibleApresRestitutions).toBe(COMPTE * 100 - etat.resteARestituer)
  })

  test('rendre un apport change le reste à rendre, et le disponible avec lui', async ({
    page,
    goto,
  }) => {
    await ouvrirLaPage(page, goto)

    const { etat: avant } = await apportsEnBase(page)
    expect(avant.disponibleApresRestitutions!).toBeLessThan(0)

    // Le premier apport de la liste, corrigé pour le marquer rendu.
    await page.getByRole('button', { name: "Corriger l'apport" }).first().click()
    const modale = page.getByRole('dialog')
    await expect(modale).toBeVisible()
    await modale.getByRole('switch', { name: 'Restitution' }).check()
    await modale.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await expect(page.getByText('Rendu', { exact: true }).first()).toBeVisible()

    const { etat: apres } = await apportsEnBase(page)
    expect(apres.totalRestitue).toBeGreaterThan(0)
    expect(apres.resteARestituer).toBeLessThan(avant.resteARestituer)
    /*
     * ET C'EST ICI QUE LA FORMULE SE PROUVE. Le comptage n'a pas bougé, mais une partie des prêts
     * est rendue : le disponible AUGMENTE. Avec `compté − apporté`, il n'aurait pas bougé d'un
     * centime — l'erreur serait restée invisible.
     */
    expect(apres.disponibleApresRestitutions!).toBeGreaterThan(avant.disponibleApresRestitutions!)
    expect(apres.disponibleApresRestitutions).toBe(apres.compte! - apres.resteARestituer)
  })

  /** ⚠️ L'INVARIANT. Voir la note en tête : structurel, et non numérique, à cause des lots. */
  test('aucune trace du fonds de caisse dans la charge utile de la trésorerie', async ({
    page,
  }) => {
    const { editionId } = loadState()
    const res = await page.request.get(`${BASE}/api/editions/${editionId}/treasury`)
    expect(res.ok()).toBe(true)
    const brut = await res.text()

    expect(brut).not.toContain('cashFloat')
    expect(brut).not.toContain('CashFloat')
    expect(brut).not.toContain(PRETEUR)
    // Les montants, en centimes comme la trésorerie les manipule : 77777 et 33333.
    expect(brut).not.toContain(String(Math.round(PRET_A * 100)))
    expect(brut).not.toContain(String(Math.round(PRET_B * 100)))

    // Et le témoin : la charge utile n'est pas vide, donc ces absences ont un sens.
    const corps = JSON.parse(brut)
    expect(corps.data?.totals ?? corps.totals).toBeDefined()
  })

  // La même fonction qu'au début : elle asserte l'ÉTAT, donc un nettoyage qui échoue se voit.
  test('nettoyage : retirer les apports et le comptage', async ({ page }) => {
    await remiseAZero(page)
  })
})
