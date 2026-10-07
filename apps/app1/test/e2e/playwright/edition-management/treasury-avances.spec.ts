import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'

/**
 * Avances remboursables : la carte « À rembourser » et son détail par personne.
 *
 * Demandé par les organisateurs : une dépense avancée de sa poche est réglée du point de vue du
 * fournisseur, mais l'association doit ce montant à la personne. Cette dette n'apparaissait dans
 * aucun total, et sans agrégat le montant global ne se lisait nulle part.
 *
 * Le parcours passe par l'interface plutôt que par l'API : le calcul est déjà couvert par des
 * tests unitaires, ce qui reste à prouver c'est que la carte affiche la bonne somme et que son
 * clic ouvre bien le détail.
 */
test.describe.serial('Trésorerie — avances à rembourser', () => {
  test.describe.configure({ timeout: 120000 })

  const MONTANT_A = 4200 // 42,00 €
  const MONTANT_B = 1800 // 18,00 €
  const MONTANT_C = 1000 // 10,00 €, la seule avance portant un code d'imputation
  /**
   * Le total dû, DÉRIVÉ des trois avances.
   *
   * ⚠️ Écrit en dur (« 60 »), il obligeait à retoucher trois assertions dès qu'on ajoutait une
   * avance — ce qui est exactement ce qui vient d'arriver en couvrant le code d'imputation.
   */
  const TOTAL_DU = ((MONTANT_A + MONTANT_B + MONTANT_C) / 100).toString()
  const CODE_IMPUTATION = '6063'
  const LIBELLE_IMPUTATION = 'Fournitures E2E'
  const creees: number[] = []
  let pseudo = ''

  test('prépare deux dépenses avancées par le compte courant', async ({ page }) => {
    const { editionId } = loadState()
    await updateEdition(page, String(editionId), { treasuryEnabled: true })

    // Passe par le point dédié : il liste les personnes de l'édition, et vérifie au passage que
    // l'organisateur courant y figure — c'est lui qui avancera les dépenses.
    const candidats = await page.request.get(
      `${BASE}/api/editions/${editionId}/treasury/advance-candidates`
    )
    const corps = await candidats.json()
    const utilisateur = (corps?.data?.users ?? corps?.users ?? [])[0]
    expect(
      utilisateur?.id,
      `aucun candidat à l'avance : ${JSON.stringify(corps).slice(0, 200)}`
    ).toBeTruthy()
    pseudo = utilisateur.pseudo

    /*
     * ⚠️ REPARTIR D'UN ÉTAT CONNU. Ce fichier n'était pas idempotent : un second passage sur la
     * même édition recréait les deux avances sans retirer les premières, et la carte annonçait
     * alors 120 € là où le test en attend 60. L'échec ressemble à une régression du calcul, et
     * n'en est pas — mesuré, huit lignes résiduelles sur deux éditions d'essai.
     *
     * 📍 Le nettoyage final ne suffit pas : il ne tourne pas quand un test échoue avant lui, et
     * c'est précisément là que les restes s'accumulent.
     */
    /*
     * ⚠️ LE RAPPORT, ET NON `/treasury/entries` — CE POINT D'API N'EXISTE PAS. Ma première version
     * l'appelait : la requête échouait, `ok()` rendait faux, et le nettoyage ne faisait RIEN sans
     * rien dire. Le test échouait ensuite sur « 120 € au lieu de 60 », ce qui désigne le calcul
     * alors que la faute était dans le décor.
     *
     * 📍 D'où le `expect` sur la réponse : un nettoyage muet est pire qu'un nettoyage absent.
     */
    const rapport = await page.request.get(`${BASE}/api/editions/${editionId}/treasury`)
    expect(rapport.ok(), `lecture du rapport: ${await rapport.text()}`).toBe(true)
    const corpsRapport = await rapport.json()
    for (const ligne of corpsRapport?.data?.lines ?? corpsRapport?.lines ?? []) {
      if (ligne?.entryId && String(ligne.title ?? '').startsWith('Avance E2E')) {
        const efface = await apiDelete(
          page,
          `${BASE}/api/editions/${editionId}/treasury/entries/${ligne.entryId}`
        )
        expect(efface.ok(), `nettoyage de ${ligne.entryId}: ${await efface.text()}`).toBe(true)
      }
    }

    /*
     * ⚠️ VÉRIFIER L'ÉTAT, PAS SEULEMENT LES GESTES. Mon premier `expect` portait sur la LECTURE du
     * rapport, pas sur les suppressions — un nettoyage pouvait donc échouer sans rien dire, et le
     * test suivant tombait sur « 120 € au lieu de 60 », ce qui accuse le calcul quand la faute est
     * dans le décor. Cette assertion-ci est la seule qui ferme vraiment le cas.
     */
    const apresNettoyage = await page.request.get(`${BASE}/api/editions/${editionId}/treasury`)
    const etat = await apresNettoyage.json()
    expect((etat?.data ?? etat)?.totals?.toReimburse?.total ?? 0).toBe(0)

    /*
     * ⚠️ UNE AVANCE AVEC UN CODE D'IMPUTATION. Sans elle, les deux autres n'en portant aucun, le
     * détail n'exerçait que la branche « Sans imputation » — et le `{{ code }} · {{ label }}`, qui
     * est le cœur de la demande, n'était rendu dans AUCUN test. Une faute d'attribut (`libelle`
     * au lieu de `label`, les deux cohabitent dans ce dépôt) rendrait une chaîne vide : aucune
     * erreur, lint et typage muets, et « 606 · » en production.
     */
    const reponseCode = await apiPost(page, `${BASE}/api/editions/${editionId}/treasury/codes`, {
      data: { code: CODE_IMPUTATION, label: LIBELLE_IMPUTATION },
    })
    /*
     * ⚠️ LE RAPPORT PORTE LES CODES — il n'existe AUCUN `GET /treasury/codes`. Mon premier jet
     * l'appelait, pour la deuxième fois dans ce fichier : la requête échouait, la liste était
     * vide, et le test devenait instable d'un passage à l'autre selon que le code existait déjà.
     * Un point d'API supposé rend une liste vide avec le même aplomb qu'un point d'API réel.
     */
    let codeId: number | undefined = reponseCode.ok()
      ? ((await reponseCode.json())?.data?.code ?? {}).id
      : undefined

    if (!codeId) {
      const rapportCodes = await page.request.get(`${BASE}/api/editions/${editionId}/treasury`)
      expect(rapportCodes.ok(), `lecture des codes: ${await rapportCodes.text()}`).toBe(true)
      const corpsCodes = await rapportCodes.json()
      const liste = (corpsCodes?.data ?? corpsCodes)?.codes ?? []
      codeId = liste.find((c: { code: string }) => c.code === CODE_IMPUTATION)?.id
    }
    expect(codeId, 'aucun code d’imputation disponible').toBeTruthy()

    const avecCode = await apiPost(page, `${BASE}/api/editions/${editionId}/treasury/entries`, {
      data: {
        kind: 'EXPENSE',
        title: `Avance E2E ${MONTANT_C}`,
        amount: MONTANT_C / 100,
        advancedById: utilisateur.id,
        codeId,
      },
    })
    expect(avecCode.ok(), await avecCode.text()).toBe(true)
    creees.push(((await avecCode.json())?.data ?? {}).id)

    for (const montant of [MONTANT_A, MONTANT_B]) {
      const r = await apiPost(page, `${BASE}/api/editions/${editionId}/treasury/entries`, {
        data: {
          kind: 'EXPENSE',
          title: `Avance E2E ${montant}`,
          amount: montant / 100,
          advancedById: utilisateur.id,
        },
      })
      expect(r.ok(), await r.text()).toBe(true)
      creees.push(((await r.json())?.data ?? {}).id)
    }
  })

  test('la carte affiche la somme due, et son clic détaille par personne', async ({
    page,
    goto,
  }) => {
    const { editionId } = loadState()
    await goto(`/editions/${editionId}/gestion/treasury`, { waitUntil: 'hydration' })
    await expect(page.getByRole('heading', { name: 'Trésorerie' })).toBeVisible({ timeout: 20000 })

    // Les trois avances, dues à la même personne.
    const carte = page
      .locator('div')
      .filter({ hasText: /^À rembourser/ })
      .last()
    await expect(carte).toContainText(TOTAL_DU, { timeout: 15000 })

    await carte.click()

    const modale = page.getByRole('dialog')
    await expect(modale).toBeVisible({ timeout: 10000 })
    await expect(modale).toContainText(pseudo)
    await expect(modale).toContainText(TOTAL_DU)
  })

  test('⚠️ déplier une personne montre les écritures qui composent sa dette', async ({
    page,
    goto,
  }) => {
    /*
     * ⚠️ CE TEST OUVRE LA MODALE LUI-MÊME. Ma première version s'appuyait sur « le test précédent
     * l'a laissée ouverte » — et quand celui-ci échoue, le dialogue n'existe pas : mon test
     * échouait alors pour la faute du voisin, en annonçant « element(s) not found », ce qui ne
     * désigne pas la vraie cause. Un test qui dépend de l'état laissé par un autre ne dit plus
     * ce qu'il mesure.
     *
     * ⚠️ CE QU'ON ÉPROUVE EST QUE LE DÉTAIL MONTRE SES ÉCRITURES, chacune avec son montant. Que
     * la somme fasse le total est garanti par le test unitaire, qui le vérifie directement. Un détail qui ne somme pas à l'en-tête ne se
     * remarque qu'en recomptant à la main, et l'on ne sait alors plus lequel des deux croire —
     * c'est la raison pour laquelle ces lignes sont calculées par le serveur, dans la boucle qui
     * applique déjà la règle des avances, et non regroupées une seconde fois côté client.
     */
    const { editionId } = loadState()
    await goto(`/editions/${editionId}/gestion/treasury`, { waitUntil: 'hydration' })
    await expect(page.getByRole('heading', { name: 'Trésorerie' })).toBeVisible({ timeout: 20000 })

    await page
      .locator('div')
      .filter({ hasText: /^À rembourser/ })
      .last()
      .click()

    const modale = page.getByRole('dialog')
    await expect(modale).toBeVisible({ timeout: 10000 })

    /*
     * 📍 Le repli DÉMONTE son contenu : replié, les écritures ne sont pas dans le DOM. Mon premier
     * jet gardait `unmount-on-hide="false"`, ce qui m'avait fait écrire `toBeHidden()` — une
     * assertion CREUSE, puisqu'elle passe aussi quand l'élément n'existe nulle part. Elle aurait
     * été verte sans le détail du tout, c'est-à-dire sans la fonctionnalité.
     */
    await expect(modale.getByText('Avance E2E 4200')).toHaveCount(0)

    await modale.getByText(pseudo).click()

    // Dépliée : les deux écritures, chacune avec son montant.
    await expect(modale.getByText('Avance E2E 4200')).toBeVisible()
    await expect(modale.getByText('Avance E2E 1800')).toBeVisible()
    await expect(modale).toContainText('42')
    await expect(modale).toContainText('18')

    // Sans imputation, l'écran le DIT plutôt que d'afficher un code inventé : ces avances ont été
    // créées sans code, et c'est le cas le plus fréquent d'une dépense saisie dans l'urgence.
    await expect(modale.getByText('Sans imputation').first()).toBeVisible()

    // ⚠️ ET LA BRANCHE INVERSE : code ET libellé, ce que l'utilisateur a demandé. Sans ce cas,
    // seule l'absence d'imputation était rendue dans un test.
    await expect(modale.getByText(`Avance E2E ${MONTANT_C}`)).toBeVisible()
    await expect(modale.getByText(`${CODE_IMPUTATION} · ${LIBELLE_IMPUTATION}`)).toBeVisible()
  })

  test('le bouton « Remboursé » solde les avances de la personne en une fois', async ({ page }) => {
    // La modale est encore ouverte : le test précédent l'a laissée ainsi, et chaque `test()`
    // repart d'une page neuve — on la rouvre donc.
    const { editionId } = loadState()
    await page.goto(`${BASE}/editions/${editionId}/gestion/treasury`)
    await expect(page.getByRole('heading', { name: 'Trésorerie' })).toBeVisible({ timeout: 20000 })

    const carte = page
      .locator('div')
      .filter({ hasText: /^À rembourser/ })
      .last()
    await expect(carte).toContainText(TOTAL_DU, { timeout: 15000 })
    await carte.click()

    const modale = page.getByRole('dialog')
    /*
     * ⚠️ `exact: true`, ET C'EST LE CORRECTIF D'ACCESSIBILITÉ QUI L'EXIGE. Le déclencheur du repli
     * porte désormais `role="button"` — sans quoi le détail serait inatteignable au clavier — et
     * son nom accessible est TOUT le texte de la ligne, qui contient « Remboursé ». Or la
     * correspondance de nom est une SOUS-CHAÎNE par défaut : `.first()` attrapait le déclencheur,
     * dépliait la personne au lieu de la rembourser, et la modale restait ouverte.
     */
    await modale.getByRole('button', { name: 'Remboursé', exact: true }).first().click()

    /*
     * ⚠️ UNE CONFIRMATION S'INTERPOSE DÉSORMAIS. Le geste solde toutes les avances de la personne
     * d'un coup, depuis une ligne où l'on vient cliquer pour déplier, et rien ne le défait en bloc.
     *
     * 📍 On assère son CONTENU, pas seulement sa présence : elle doit nommer qui et combien, sinon
     * c'est un « êtes-vous sûr ? » qu'on valide sans lire — et elle ne protégerait de rien.
     */
    const confirmation = page.getByRole('dialog').filter({ hasText: 'remboursées ?' })
    await expect(confirmation).toBeVisible({ timeout: 10000 })
    await expect(confirmation).toContainText(pseudo)
    await expect(confirmation).toContainText(TOTAL_DU)
    await confirmation.getByRole('button', { name: 'Remboursé', exact: true }).click()

    // Les DEUX lignes doivent être soldées d'un coup, pas seulement la première : la carte
    // retombe à zéro et la modale se referme d'elle-même.
    await expect(modale).toBeHidden({ timeout: 15000 })
    await expect(carte).toContainText('0', { timeout: 15000 })
    await expect(carte).not.toContainText(TOTAL_DU)
  })

  test('une avance soldée garde « Avancé par », gagne « Remboursé », et sa date au survol', async ({
    page,
  }) => {
    const { editionId } = loadState()

    /*
     * Le parcours précédent vient de solder ces trois avances : leur date est donc fraîche. C'est
     * la seule façon de l'éprouver — les avances soldées AVANT l'arrivée de la colonne n'en ont
     * pas, et l'écran n'affiche alors pas d'infobulle.
     */
    const rapport = await (
      await page.request.get(`${BASE}/api/editions/${editionId}/treasury`)
    ).json()
    const lignes = (rapport?.data ?? rapport)?.lines ?? []
    const soldee = lignes.find((l: { title?: string }) => l.title === `Avance E2E ${MONTANT_A}`)
    expect(soldee, 'la ligne avancée est introuvable dans le rapport').toBeTruthy()
    expect(soldee.reimbursed).toBe(true)
    /*
     * ⚠️ L'ASSERTION QUI TIENT TOUT LE RESTE. La date est lue en base puis recopiée dans le
     * rapport par `treasury-compute` : l'oubli de cette recopie est déjà arrivé pour
     * `operationDate`, et la colonne restait vide quoi qu'on saisisse, sans qu'aucune erreur ne le
     * dise. Un test qui ne regarderait que l'écran verrait une infobulle désactivée et passerait.
     */
    expect(soldee.reimbursedAt, 'le remboursement n’a pas été daté').toBeTruthy()

    await page.goto(`${BASE}/editions/${editionId}/gestion/treasury`)
    await expect(page.getByRole('heading', { name: 'Trésorerie' })).toBeVisible({ timeout: 20000 })

    const ligne = page.locator('tbody tr').filter({ hasText: `Avance E2E ${MONTANT_A}` })
    await expect(ligne).toBeVisible({ timeout: 20000 })

    /*
     * LES DEUX PASTILLES. L'orange disparaissait au remboursement, et la ligne redevenait
     * identique à une ligne que personne n'avait avancée : on perdait qui avait avancé. Les deux
     * assertions comptent — la verte seule laisserait réintroduire cette disparition.
     */
    await expect(ligne).toContainText(`Avancé par ${pseudo}`)
    const pastilleVerte = ligne.getByText('Remboursé', { exact: true })
    await expect(pastilleVerte).toBeVisible()

    // Et le survol donne la date, calculée ici dans le même format que l'écran.
    await pastilleVerte.hover()
    const aujourdHui = new Date().toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    /*
     * `.first()` : l'infobulle rend son texte DEUX fois — le libellé visible, et une copie que
     * Reka UI tient hors écran pour les lecteurs d'écran. Sans cela, Playwright refuse en mode
     * strict, sur un défaut qui n'existe pas.
     */
    await expect(page.getByText(`Remboursé le ${aujourdHui}`).first()).toBeVisible({
      timeout: 10000,
    })
  })

  test('nettoyer : retirer les lignes créées', async ({ page }) => {
    const { editionId } = loadState()
    /*
     * ⚠️ `apiDelete` ET NON `page.request.delete` : le middleware CSRF exige un jeton sur tout
     * DELETE, que la requête brute ne porte pas. Chaque suppression rendait donc 403, le
     * `.catch(() => {})` l'avalait, et ce test était VERT en n'ayant rien supprimé — y compris
     * quand toute la suite passait. C'est la vraie origine des huit lignes résiduelles mesurées,
     * et non « le nettoyage ne tourne pas quand un test échoue », qui n'en était que la moitié.
     */
    for (const id of creees) {
      if (!id) continue
      const efface = await apiDelete(
        page,
        `${BASE}/api/editions/${editionId}/treasury/entries/${id}`
      )
      expect(efface.ok(), `suppression de l'entrée ${id}: ${await efface.text()}`).toBe(true)
    }
    await updateEdition(page, String(editionId), { treasuryEnabled: false })
  })
})
