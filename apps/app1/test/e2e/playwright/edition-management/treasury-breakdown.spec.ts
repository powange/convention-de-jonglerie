import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Répartition par imputation : `/editions/:id/gestion/treasury/breakdown`.
 *
 * Une BALANCE au sens comptable — un total par code —, et non un grand livre : le détail des
 * écritures reste sur le compte de résultat.
 *
 * ⚠️ CE PARCOURS CRÉE SES PROPRES MONTANTS, et c'est indispensable. Sur une édition neuve, tous
 * les totaux valent zéro : une page qui n'afficherait RIEN passerait chacune des assertions. Le
 * code d'imputation est unique au parcours, donc son sous-total est vérifiable au centime près,
 * même si d'autres parcours ajoutent des lignes à la même édition.
 */
test.describe.serial('Trésorerie — répartition par imputation', () => {
  const CODE = '6068'
  const LIBELLE = 'Autres fournitures E2E'
  const CHARGE = 4200 // 42,00 €
  const PRODUIT = 10000 // 100,00 €
  const creees: number[] = []

  /** Le nombre lu dans un texte, séparateurs de milliers compris. */
  const nombreDans = (texte: string) => {
    const SEP = '[ \\u00a0\\u202f]'
    const trouve = texte.match(new RegExp(`-?(?:\\d|${SEP})*\\d(?:,\\d+)?`))
    if (!trouve) throw new Error(`Montant illisible : ${JSON.stringify(texte)}`)
    return Number(trouve[0].replace(new RegExp(SEP, 'g'), '').replace(',', '.'))
  }

  test('prépare une charge et un produit sur un même code', async ({ page }, testInfo) => {
    const { editionId } = loadState()
    await updateEdition(page, String(editionId), { treasuryEnabled: true })

    // Le code est unique par convention : une reprise du bloc retomberait sinon sur un conflit.
    const code = `${CODE}-${testInfo.retry}`
    const reponse = await apiPost(page, `${BASE}/api/editions/${editionId}/treasury/codes`, {
      data: { code, label: LIBELLE },
    })
    expect(reponse.ok(), `création du code refusée : ${await reponse.text()}`).toBe(true)
    const codeId = (await reponse.json())?.data?.code?.id
    expect(codeId, 'aucun identifiant de code').toBeTruthy()

    for (const [kind, montant] of [
      ['EXPENSE', CHARGE],
      ['INCOME', PRODUIT],
    ] as const) {
      const creation = await apiPost(page, `${BASE}/api/editions/${editionId}/treasury/entries`, {
        data: { kind, title: `Répartition E2E ${montant}`, amount: montant / 100, codeId },
      })
      expect(creation.ok(), `création refusée : ${await creation.text()}`).toBe(true)
      creees.push((await creation.json())?.data?.id)
    }
  })

  test('chaque section montre le code et son sous-total', async ({ page, goto }, testInfo) => {
    const { editionId } = loadState()
    const code = `${CODE}-${testInfo.retry}`

    await goto(`/editions/${editionId}/gestion/treasury/breakdown`, { waitUntil: 'hydration' })
    await expect(page.getByRole('heading', { name: 'Répartition par imputation' })).toBeVisible({
      timeout: 20000,
    })

    /*
     * La rangée du code, dans CHAQUE section. Le même code porte une charge et un produit : il doit
     * apparaître deux fois, avec deux montants différents — c'est ce qui prouve que les deux
     * sections sont bien séparées et non un seul tableau dupliqué.
     */
    const rangees = page.locator('tr', { hasText: code })
    await expect(rangees).toHaveCount(2)

    const montants = await rangees.allInnerTexts()
    const lus = montants.map((t) => nombreDans(t.split('\t').slice(-1)[0] ?? t))
    expect(lus.sort((a, b) => a - b)).toEqual([CHARGE / 100, PRODUIT / 100])

    // Le libellé du code accompagne son numéro : un code seul ne dit rien à la lecture.
    await expect(page.getByText(LIBELLE).first()).toBeVisible()
  })

  test('⚠️ le solde concorde avec celui du compte de résultat', async ({ page, goto }) => {
    /*
     * L'assertion qui relie les deux écrans. Le solde de cette page est calculé à partir des
     * GROUPES ; celui du compte de résultat vient du serveur. Deux chemins, un seul chiffre — s'ils
     * divergent, c'est que le regroupement perd des lignes, ce qu'aucun total pris isolément ne
     * dirait.
     */
    const { editionId } = loadState()
    await goto(`/editions/${editionId}/gestion/treasury/breakdown`, { waitUntil: 'hydration' })
    const carte = page.locator('[data-solde-general]')
    await expect(carte).toBeVisible({ timeout: 20000 })

    /*
     * ⚠️ UNE COMPARAISON QUI CONVERGE, et non une lecture unique.
     *
     * Les lots Playwright tournent EN PARALLÈLE sur la même base, et d'autres parcours touchent la
     * trésorerie de cette édition — ceux des artistes y créent des lignes calculées. Entre la
     * lecture de l'API et celle de l'écran, un total peut donc bouger, et le test échouerait sur
     * une course plutôt que sur un défaut.
     *
     * En rechargeant les deux à chaque tour, l'égalité s'établit dès que les écritures cessent. Un
     * VRAI désaccord, lui, ne converge jamais : le regroupement perdrait des lignes à chaque fois.
     */
    await expect
      .poll(
        async () => {
          const rapport = await (
            await page.request.get(`${BASE}/api/editions/${editionId}/treasury`)
          ).json()
          const attendu = (rapport?.data ?? rapport)?.totals?.balance
          await page.reload()
          await expect(carte).toBeVisible({ timeout: 20000 })
          // L'engagé est la colonne de gauche : « produits moins charges, réglés ou non », comme
          // la carte du compte de résultat.
          const texte = await carte.innerText()
          return nombreDans(texte.split('Engagé')[1] ?? texte) - attendu / 100
        },
        { timeout: 30000, message: 'le solde de l’écran ne rejoint pas celui du rapport' }
      )
      .toBe(0)
  })

  test('la page ne permet rien de modifier', async ({ page, goto }) => {
    // Lecture seule : c'est la raison d'être de cette page, et une régression y serait invisible.
    const { editionId } = loadState()
    await goto(`/editions/${editionId}/gestion/treasury/breakdown`, { waitUntil: 'hydration' })
    await expect(page.getByRole('heading', { name: 'Répartition par imputation' })).toBeVisible({
      timeout: 20000,
    })

    await expect(page.getByRole('button', { name: 'Ajouter une charge' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Ajouter un produit' })).toHaveCount(0)
    await expect(page.getByRole('combobox')).toHaveCount(0)
  })

  test('nettoyer : retirer les lignes créées', async ({ page }) => {
    const { editionId } = loadState()
    for (const id of creees) {
      if (id) await apiDelete(page, `${BASE}/api/editions/${editionId}/treasury/entries/${id}`)
    }
  })
})
