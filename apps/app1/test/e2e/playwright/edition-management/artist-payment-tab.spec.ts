import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'
const ARTIST_NOM = `PaiementOnglet${Date.now()}`
const ARTIST_EMAIL = `e2e-onglet-paiement-${Date.now()}@example.com`

/**
 * L'onglet « Paiement » de la modale de gestion d'un artiste, découpé en quatre encarts.
 *
 * ## Pourquoi un parcours authentifié et non un test monté
 *
 * Ce qu'on éprouve est une règle d'AFFICHAGE : chaque dépôt de fichier n'apparaît que sous sa
 * condition. Un test monté sur le composant dirait que les champs existent ; il ne dirait pas
 * qu'on les atteint depuis la page de gestion, ni qu'ils apparaissent et disparaissent en
 * saisissant. La page de gestion est rendue côté client — un 200 par `curl` ne prouverait rien.
 *
 * ## Les conditions, qui ne sont pas les mêmes partout
 *
 * | Encart       | Le dépôt apparaît si…                 |
 * | ------------ | ------------------------------------- |
 * | Paiement     | « facture demandée » est cochée       |
 * | Défraiement  | le PLAFOND est renseigné              |
 * | Consommables | le PLAFOND est renseigné              |
 *
 * La facture ne suit donc PAS le montant du paiement, et c'est délibéré : déposer une facture que
 * personne n'a réclamée n'a pas de sens. Un test ci-dessous tient précisément cette asymétrie —
 * sans lui, conditionner la facture au montant repasserait au vert.
 *
 * ## Rien n'est enregistré
 *
 * Aucune soumission : on ouvre, on saisit, on observe, on referme. Les lots Playwright tournent en
 * parallèle sur la même base, et cet onglet est partagé avec les autres parcours d'artistes.
 */
test.describe.serial('Onglet paiement d’un artiste : quatre encarts et leurs dépôts', () => {
  let artistId: number | null = null

  /** Ouvre la fiche de NOTRE artiste — visé par son nom, jamais par sa place dans le tableau. */
  const ouvrirLOngletPaiement = async (page: any, goto: any) => {
    const { editionId } = loadState()
    await expect(async () => {
      await goto(`/editions/${editionId}/gestion/artists`, { waitUntil: 'hydration' })
      const ligne = page.getByRole('row').filter({ hasText: ARTIST_NOM })
      await expect(ligne).toHaveCount(1, { timeout: 5000 })
      await ligne.getByRole('button', { name: "Modifier l'artiste" }).click()
      await expect(page.getByRole('tab', { name: 'Paiement' })).toBeVisible({ timeout: 5000 })
    }).toPass({ timeout: 60000, intervals: [2000, 3000, 5000] })

    await page.getByRole('tab', { name: 'Paiement' }).click()
    /*
     * ⚠️ VISIBILITÉ ET NON PRÉSENCE, pour tout ce fichier. `UTabs` garde les deux panneaux montés
     * — c'est délibéré, pour qu'un champ en erreur dans l'autre onglet existe encore. Un
     * `toHaveCount(1)` serait donc vrai même sans avoir cliqué sur l'onglet.
     */
    await expect(page.locator('[data-encart="paiement"]')).toBeVisible()
  }

  const encart = (page: any, nom: string) => page.locator(`[data-encart="${nom}"]`)

  test('créer l’artiste, sans aucun montant ni facture demandée', async ({ page }) => {
    const { editionId } = loadState()
    if (!editionId) throw new Error('editionId manquant dans state.json (setup global non joué)')
    await updateEdition(page, String(editionId), { artistsEnabled: true })

    const reponse = await apiPost(page, `${BASE}/api/editions/${editionId}/artists`, {
      data: { email: ARTIST_EMAIL, prenom: 'Onglet', nom: ARTIST_NOM },
    })
    expect(reponse.ok(), `POST /artists a échoué: ${await reponse.text()}`).toBe(true)
    const corps = await reponse.json()
    artistId = corps?.data?.artist?.id ?? corps?.artist?.id
    expect(artistId).toBeTruthy()
  })

  test('les quatre encarts sont là, et aucun dépôt n’est proposé', async ({ page, goto }) => {
    await ouvrirLOngletPaiement(page, goto)

    for (const nom of ['paiement', 'defraiement', 'consommables', 'cachet']) {
      await expect(encart(page, nom), `encart ${nom} absent`).toBeVisible()
    }
    await expect(page.getByRole('heading', { name: 'Paiement', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Défraiement de trajet' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Consommables', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Cachet', exact: true })).toBeVisible()

    // Rien n'est saisi : les trois dépôts sont absents.
    await expect(encart(page, 'paiement').getByText("Facture de l'artiste")).toBeHidden()
    await expect(encart(page, 'defraiement').getByText('Justificatif du défraiement')).toBeHidden()
    await expect(
      encart(page, 'consommables').getByText('Justificatif des consommables')
    ).toBeHidden()
  })

  test('le justificatif de défraiement suit son plafond, et apparaît à 0', async ({
    page,
    goto,
  }) => {
    await ouvrirLOngletPaiement(page, goto)
    const carte = encart(page, 'defraiement')
    const justificatif = carte.getByText('Justificatif du défraiement')
    const plafond = carte.getByLabel('Défraiement trajet maximum', { exact: true })

    /*
     * ⚠️ ZÉRO EST UNE VALEUR, et c'est le cas qui discrimine. Un défraiement plafonné à zéro —
     * « on ne rembourse pas le trajet » — reste un plafond renseigné, et l'artiste peut avoir
     * besoin de déposer son billet quand même. Une condition écrite `v-if="formData.x"` lirait
     * « 0 » comme « rien saisi » et masquerait le dépôt : ce test tombe alors, les autres non.
     */
    await plafond.fill('0')
    await expect(justificatif).toBeVisible()

    await plafond.fill('')
    await expect(justificatif).toBeHidden()

    await plafond.fill('120')
    await expect(justificatif).toBeVisible()

    // Et il reste dans SON encart : remplir le défraiement ne révèle pas celui des consommables.
    await expect(
      encart(page, 'consommables').getByText('Justificatif des consommables')
    ).toBeHidden()
  })

  test('le justificatif des consommables suit son propre plafond', async ({ page, goto }) => {
    await ouvrirLOngletPaiement(page, goto)
    const carte = encart(page, 'consommables')
    const justificatif = carte.getByText('Justificatif des consommables')
    const plafond = carte.getByLabel('Consommables maximum', { exact: true })

    await expect(justificatif).toBeHidden()
    await plafond.fill('50')
    await expect(justificatif).toBeVisible()
    await plafond.fill('')
    await expect(justificatif).toBeHidden()
  })

  test('la facture suit « facture demandée », et NON le montant du paiement', async ({
    page,
    goto,
  }) => {
    await ouvrirLOngletPaiement(page, goto)
    const carte = encart(page, 'paiement')
    const facture = carte.getByText("Facture de l'artiste")

    /*
     * LE TEST QUI TIENT L'ASYMÉTRIE. Les deux autres encarts suivent un montant ; celui-ci suit
     * une case. Saisir un paiement ne doit donc RIEN révéler — sans cette assertion, brancher la
     * facture sur le montant comme ses voisins passerait inaperçu.
     */
    await carte.getByLabel('Montant du paiement', { exact: true }).fill('300')
    await expect(facture).toBeHidden()

    /*
     * ⚠️ LE NOM ACCESSIBLE EST CELUI DU `UFormField`, pas celui de la case.
     *
     * `UCheckbox` porte bien un `label` — « Une facture est demandée à l'artiste » — qui s'affiche
     * à l'écran, mais le `UFormField` qui l'entoure pose un `aria-label` par-dessus : la case
     * s'appelle donc « Facture demandée ». Mesuré dans le DOM, après qu'un sélecteur bâti sur le
     * texte visible n'ait résolu nulle part pendant deux minutes.
     */
    const demandee = carte.getByRole('checkbox', { name: 'Facture demandée', exact: true })
    await demandee.check()
    await expect(facture).toBeVisible()

    await demandee.uncheck()
    await expect(facture).toBeHidden()
  })

  test('nettoyage : supprimer l’artiste', async ({ page }) => {
    const { editionId } = loadState()
    if (!artistId) return
    const reponse = await apiDelete(page, `${BASE}/api/editions/${editionId}/artists/${artistId}`)
    expect(reponse.ok(), `DELETE a échoué: ${await reponse.text()}`).toBe(true)

    // L'ÉTAT, et non le geste : un nettoyage dont l'échec est avalé serait vert en ne faisant rien.
    const liste = await page.request.get(`${BASE}/api/editions/${editionId}/artists`)
    const corps = await liste.json()
    const artistes = corps?.data?.artists ?? corps?.artists ?? []
    expect(artistes.some((a: { user: { email: string } }) => a.user.email === ARTIST_EMAIL)).toBe(
      false
    )
  })
})
