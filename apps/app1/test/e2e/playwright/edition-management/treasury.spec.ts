import type { Page } from '@playwright/test'

import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, apiPut, loadState, updateEdition } from '../helpers'

const BASE = 'http://localhost:3000'

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
    const response = await apiPost(page, `${BASE}/api/editions/${editionId}/treasury/codes`, {
      data: { code: `E2E-6257-${testInfo.retry}`, label: 'Rémunérations E2E' },
    })
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
   * Un bouton par nature, SUR SA CARTE, et le sens n'est plus à choisir dans la modale.
   *
   * ⚠️ POURQUOI SUR LA CARTE. Un bouton unique en haut de page obligeait à trancher la nature
   * APRÈS avoir cliqué, dans un sélecteur qu'on pouvait laisser sur sa valeur précédente : une
   * charge se saisissait en produit sans que rien ne l'empêche. Le lieu du clic porte désormais
   * l'information.
   *
   * 📍 Le sélecteur SUBSISTE en modification, délibérément : c'est le seul moyen de corriger une
   * ligne saisie du mauvais côté. Les deux moitiés sont vérifiées ici.
   */
  test('offre un bouton par nature, sur sa carte', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/treasury`, { waitUntil: 'hydration' })
    await expect(page.getByRole('heading', { name: 'Trésorerie' })).toBeVisible({ timeout: 20000 })

    // L'ancien bouton générique n'existe plus.
    await expect(page.getByRole('button', { name: 'Ajouter une ligne' })).toHaveCount(0)

    /*
     * Chaque bouton est DANS l'en-tête de sa carte, à côté du titre — et non quelque part sur la
     * page. On remonte au parent du titre, qui est précisément cet en-tête.
     */
    for (const [titre, testid] of [
      ['Charges', 'treasury-add-expense'],
      ['Produits', 'treasury-add-income'],
    ] as const) {
      const enTete = page.getByRole('heading', { name: titre, exact: true }).locator('..')
      await expect(enTete.getByTestId(testid), `bouton sur la carte « ${titre} »`).toBeVisible()
    }

    // À la création, la nature est imposée : le titre la nomme, le sélecteur a disparu.
    await page.getByRole('button', { name: 'Ajouter un produit' }).click()
    const creation = page.getByRole('dialog')
    await expect(creation.getByText('Ajouter un produit')).toBeVisible()
    await expect(creation.getByText('Nature', { exact: true })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(creation).toBeHidden({ timeout: 10000 })

    /*
     * ⚠️ ET IL NE REVIENT PAS À LA MODIFICATION NON PLUS. « Le produit est un produit et restera un
     * produit » — décidé avec l'utilisateur le 06/10/2026, qui revient sur mon arbitrage initial :
     * j'avais gardé le sélecteur là pour rattraper une ligne du mauvais côté.
     *
     * 📍 Ce test affirmait exactement le contraire jusqu'à cette date. Un test qui garde une règle
     * abandonnée est pire qu'un test absent : il empêche de livrer la nouvelle.
     */
    await page.getByRole('button', { name: 'Modifier' }).first().click()
    const modification = page.getByRole('dialog')
    await expect(modification.getByText('Modifier la ligne')).toBeVisible()
    await expect(modification.getByText('Nature', { exact: true })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(modification).toBeHidden({ timeout: 10000 })

    /*
     * Et sur un téléphone, le bouton PASSE À LA LIGNE au lieu de pousser le titre hors de l'écran.
     * C'est ce que fait `flex-wrap` ; on le mesure plutôt que de s'y fier, un en-tête qui déborde
     * étant exactement ce qu'un ajout de bouton provoque.
     */
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByTestId('treasury-add-expense')).toBeVisible()
    const debordement = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    )
    expect(debordement, 'la page défile horizontalement sur téléphone').toBe(false)
  })

  /**
   * Un produit dont le montant est TIRÉ DE TARIFS choisis.
   *
   * ⚠️ CE QUI SE VÉRIFIE ICI, ET QUE RIEN D'AUTRE NE PEUT VOIR : que le montant quitte réellement
   * « Billetterie — autres produits » au lieu de s'y ajouter. C'est un RÉACHEMINEMENT — la ligne
   * de commande part vers le produit nommé au lieu d'aller dans le fourre-tout — donc le total de
   * l'édition ne doit pas bouger d'un centime.
   *
   * 📍 CE QUE CE PARCOURS PROUVE, ET CE QU'IL NE PROUVE PAS. Il couvre le CÂBLAGE : que le point
   * d'API lise le tarif de chaque ligne de commande, qu'il construise les regroupements, que
   * Prisma connaisse la table de liaison, et que les deux refus tiennent. Trois choses qu'un test
   * unitaire mocké ne voit pas.
   *
   * ⚠️ Il NE prouve PAS l'arithmétique : le tarif créé ici n'a aucune vente, donc les montants
   * valent zéro et la comparaison « ce qui sort du fourre-tout = ce qui entre dans la ligne »
   * compare 0 à 0. Fabriquer une vraie vente demanderait une commande complète ; l'arithmétique
   * est couverte, avec de vrais montants, par `treasury-compute.test.ts` — dont le cas « le total
   * ne bouge pas, avec ou sans regroupement ».
   */
  test('crée un produit tiré de tarifs, sans bouger le total', async ({ page, goto }) => {
    const { editionId } = loadState()

    /*
     * On CRÉE le tarif plutôt que d'espérer en trouver un.
     *
     * ⚠️ Une première version se contentait d'un `test.skip` quand l'édition n'avait aucun tarif —
     * et elle a été ignorée au premier passage, laissant la chaîne serveur ENTIÈREMENT non
     * éprouvée. Un test ignoré se voit, c'est déjà mieux qu'un vert creux, mais il ne prouve rien :
     * ici la donnée manquante se fabrique en un appel.
     */
    await updateEdition(page, editionId, { ticketingEnabled: true })
    const tarif = await apiPost(page, `${BASE}/api/editions/${editionId}/ticketing/tiers`, {
      data: {
        name: 'Repas samedi E2E',
        price: 1200,
        // `false` : ce tarif rejoint « autres produits », exactement le cas que l'utilisateur
        // décrit. Le cas « compté comme participant » est couvert par les tests unitaires.
        countAsParticipant: false,
      },
    })
    expect(tarif.ok(), 'création du tarif refusée').toBe(true)
    /*
     * ⚠️ `data.tier.id`, et la réponse est lue UNE SEULE FOIS. Appeler `.json()` deux fois sur la
     * même réponse Playwright ne rend rien la seconde — l'identifiant sortait `undefined`, le
     * rattachement visait un tarif inexistant, et l'échec parlait du tarif « absent des libres »
     * plutôt que de sa lecture.
     */
    const tierId: number = (await tarif.json())?.data?.tier?.id
    expect(tierId, 'identifiant du tarif créé illisible').toBeTruthy()

    // Les tarifs de l'édition, tels que la trésorerie les expose pour le sélecteur.
    const avant = await (
      await page.request.get(`${BASE}/api/editions/${editionId}/treasury`)
    ).json()
    const tarifs: { id: number; label: string; prisPar: number | null }[] = avant?.data?.tiers ?? []
    expect(tarifs.length, 'la trésorerie n’expose aucun tarif').toBeGreaterThan(0)

    const libres = tarifs.filter((tarif) => tarif.prisPar === null)
    expect(libres.length, 'aucun tarif libre à rattacher').toBeGreaterThan(0)
    expect(
      libres.some((t) => t.id === tierId),
      'le tarif créé n’apparaît pas comme libre'
    ).toBe(true)

    const soldeAvant = avant.data.totals.income.settled + avant.data.totals.income.pending
    const autresAvant =
      avant.data.lines.find((l: { source?: string }) => l.source === 'TICKETING_OTHER') ?? null

    const creation = await apiPost(page, `${BASE}/api/editions/${editionId}/treasury/entries`, {
      data: {
        kind: 'INCOME',
        title: 'Repas du samedi E2E',
        // Pas de montant : c'est tout l'objet du rattachement. Le schéma ne l'exige que sans
        // tarifs, et l'envoyer ici serait de toute façon ignoré.
        amount: 0,
        tierIds: [tierId],
      },
    })
    expect(creation.ok(), `création refusée : ${await creation.text()}`).toBe(true)
    const entryId = (await creation.json())?.data?.id
    expect(entryId).toBeTruthy()

    const apres = await (
      await page.request.get(`${BASE}/api/editions/${editionId}/treasury`)
    ).json()

    const ligne = apres.data.lines.find((l: { entryId?: number }) => l.entryId === entryId)
    expect(ligne, 'la ligne créée est absente du rapport').toBeTruthy()
    expect(ligne.tierIds, 'la ligne ne dit pas qu’elle est rattachée').toEqual([tierId])

    /*
     * ⚠️ L'INVARIANT. Le produit total de l'édition ne bouge pas : ce qui part dans la nouvelle
     * ligne est exactement ce qui quitte « autres produits ». Un montant ajouté au lieu d'être
     * réacheminé ferait grimper ce total, et c'est le défaut le plus facile à commettre ici.
     */
    const soldeApres = apres.data.totals.income.settled + apres.data.totals.income.pending
    expect(soldeApres, 'le produit total a bougé : le montant a été ajouté, pas réacheminé').toBe(
      soldeAvant
    )

    // Et si ce tarif avait vendu quelque chose, « autres produits » a bien diminué d'autant.
    const autresApres = apres.data.lines.find(
      (l: { source?: string }) => l.source === 'TICKETING_OTHER'
    )
    const sortiDuFourreTout =
      (autresAvant?.settled ?? 0) +
      (autresAvant?.pending ?? 0) -
      (autresApres.settled + autresApres.pending)
    expect(sortiDuFourreTout, 'ce qui quitte le fourre-tout ≠ ce qui entre dans la ligne').toBe(
      ligne.settled + ligne.pending
    )

    // Un second produit ne peut PAS réclamer le même tarif : son montant serait compté deux fois.
    const doublon = await apiPost(page, `${BASE}/api/editions/${editionId}/treasury/entries`, {
      data: { kind: 'INCOME', title: 'Doublon E2E', amount: 0, tierIds: [tierId] },
    })
    expect(doublon.status(), 'le tarif déjà pris aurait dû être refusé').toBe(400)

    // Et un rattachement sur une CHARGE est refusé : cela inverserait le signe d'un encaissement.
    const charge = await apiPost(page, `${BASE}/api/editions/${editionId}/treasury/entries`, {
      data: { kind: 'EXPENSE', title: 'Charge E2E', amount: 0, tierIds: [tierId] },
    })
    expect(charge.status(), 'un rattachement sur une charge aurait dû être refusé').toBe(400)

    /*
     * ⚠️ ET ON ENREGISTRE UNE MODIFICATION, ce qui manquait.
     *
     * La première version de ce parcours créait, rouvrait, puis fermait par « Échap » — elle n'a
     * donc JAMAIS exercé le `PUT`. Celui-ci échouait sur « Cannot access 'data' before
     * initialization » : la garde des tarifs y lisait le corps avant sa déclaration. Signalé par
     * l'utilisateur, pas par les tests.
     *
     * 📍 Trois cas d'un coup : renommer sans toucher aux tarifs, DÉTACHER (ce qui rend la ligne à
     * la saisie manuelle), et rattacher à nouveau.
     */
    const renommage = await apiPut(
      page,
      `${BASE}/api/editions/${editionId}/treasury/entries/${entryId}`,
      {
        data: { title: 'Repas du samedi E2E — renommé' },
      }
    )
    expect(renommage.ok(), `renommage refusé : ${await renommage.text()}`).toBe(true)

    const toujoursRattachee = await (
      await page.request.get(`${BASE}/api/editions/${editionId}/treasury`)
    ).json()
    const apresRenommage = toujoursRattachee.data.lines.find(
      (l: { entryId?: number }) => l.entryId === entryId
    )
    expect(apresRenommage.title).toBe('Repas du samedi E2E — renommé')
    // Une requête qui ne parle pas des tarifs ne doit RIEN y changer.
    expect(apresRenommage.tierIds, 'le renommage a détaché les tarifs').toEqual([tierId])

    // `[]` détache : la ligne redevient saisissable, et son montant repasse à ce qu'on envoie.
    const detachement = await apiPut(
      page,
      `${BASE}/api/editions/${editionId}/treasury/entries/${entryId}`,
      {
        data: { tierIds: [], amount: 42 },
      }
    )
    expect(detachement.ok(), `détachement refusé : ${await detachement.text()}`).toBe(true)

    const detachee = await (
      await page.request.get(`${BASE}/api/editions/${editionId}/treasury`)
    ).json()
    const ligneDetachee = detachee.data.lines.find(
      (l: { entryId?: number }) => l.entryId === entryId
    )
    expect(ligneDetachee.tierIds, 'les tarifs n’ont pas été détachés').toBeUndefined()
    expect(ligneDetachee.settled, 'le montant saisi n’est pas repris après détachement').toBe(4200)

    // Et le tarif redevient libre pour une autre ligne.
    const libereApres = await (
      await page.request.get(`${BASE}/api/editions/${editionId}/treasury`)
    ).json()
    expect(
      libereApres.data.tiers.find((tarif: { id: number }) => tarif.id === tierId)?.prisPar,
      'le tarif est resté marqué comme pris'
    ).toBeNull()

    await apiDelete(page, `${BASE}/api/editions/${editionId}/treasury/entries/${entryId}`)
    await apiDelete(page, `${BASE}/api/editions/${editionId}/ticketing/tiers/${tierId}`)
    await goto(`/editions/${editionId}/gestion/treasury`, { waitUntil: 'hydration' })
  })

  /**
   * La modale sait créer un produit calculé, et le rouvrir sans le détacher.
   *
   * ⚠️ CE QUE LE PARCOURS SERVEUR NE VOIT PAS. Deux pièges vivent uniquement dans l'écran : le
   * bouton « Enregistrer » resterait désactivé sur un produit calculé — dont le montant vaut zéro
   * par construction — et rouvrir un tel produit afficherait un sélecteur VIDE, si bien que le
   * réenregistrer DÉTACHERAIT tous ses tarifs sans rien demander.
   */
  test('la modale crée un produit calculé et le rouvre rattaché', async ({ page, goto }) => {
    const { editionId } = loadState()

    await updateEdition(page, editionId, { ticketingEnabled: true })
    const tarif = await apiPost(page, `${BASE}/api/editions/${editionId}/ticketing/tiers`, {
      data: { name: 'Camping E2E', price: 800, countAsParticipant: false },
    })
    expect(tarif.ok()).toBe(true)
    const tierId: number = (await tarif.json())?.data?.tier?.id
    expect(tierId).toBeTruthy()

    await goto(`/editions/${editionId}/gestion/treasury`, { waitUntil: 'hydration' })
    await expect(page.getByRole('heading', { name: 'Trésorerie' })).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: 'Ajouter un produit' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('textbox').first().fill('Camping E2E — produit')

    // L'interrupteur remplace le champ de montant par le sélecteur de tarifs.
    await dialog.getByRole('switch').first().click()
    await expect(dialog.getByRole('spinbutton')).toHaveCount(0)

    /*
     * ⚠️ `USelectMenu` s'expose en `button "Show popup"` — ni comme un `combobox`, ni sous son
     * texte indicatif. J'ai deviné deux fois avant de lire l'arbre d'accessibilité, qui le disait.
     *
     * 📍 Et il y a DEUX boutons « Show popup » dans cette modale, l'autre étant le code
     * d'imputation. On clique donc son TEXTE INDICATIF, qui n'appartient qu'à ce champ — plutôt
     * qu'un `.first()`, que le prochain champ ajouté au-dessus casserait.
     */
    await dialog.getByText('Choisir un ou plusieurs tarifs').click()
    await page.getByRole('option', { name: 'Camping E2E' }).click()
    await page.keyboard.press('Escape')

    /*
     * ⚠️ LE POINT QUI COMPTE : le bouton s'active SANS montant saisi. C'est la validation qui
     * devait apprendre à distinguer les deux cas — sinon on remplit, on choisit, et rien ne
     * s'enregistre sans qu'aucun message ne dise pourquoi.
     */
    const enregistrer = dialog.getByRole('button', { name: 'Enregistrer' })
    await expect(enregistrer, 'le bouton est resté désactivé sans montant').toBeEnabled({
      timeout: 10000,
    })
    await enregistrer.click()
    await expect(dialog).toBeHidden({ timeout: 15000 })

    // La ligne existe, et son montant vient des ventes : zéro ici, le tarif n'ayant rien vendu.
    const creee = page.getByRole('row', { name: /Camping E2E — produit/ })
    await expect(creee).toBeVisible({ timeout: 15000 })

    /*
     * Et on la ROUVRE : le sélecteur doit montrer son tarif. Un sélecteur vide ferait du
     * réenregistrement un détachement silencieux.
     */
    await creee.getByRole('button', { name: 'Modifier' }).click()
    const edition = page.getByRole('dialog')
    await expect(edition.getByText('Modifier la ligne')).toBeVisible()
    await expect(edition.getByRole('switch', { name: /Montant calculé/ })).toBeChecked()
    // `exact` : sans lui, le libellé attraperait aussi « Camping E2E — produit », le titre.
    await expect(
      edition.getByText('Camping E2E', { exact: true }),
      'le sélecteur est vide : réenregistrer détacherait les tarifs'
    ).toBeVisible()

    /*
     * ⚠️ ON ENREGISTRE, au lieu de fermer par « Échap ».
     *
     * La première version fermait sans enregistrer, et n'a donc jamais exercé le chemin
     * écran → `PUT`. Celui-ci échouait sur « Cannot access 'data' before initialization » :
     * l'utilisateur l'a trouvé, pas ce test. Un parcours qui ouvre une modale et la referme ne
     * prouve rien de ce qu'elle enregistre.
     */
    const enregistrerModif = edition.getByRole('button', { name: 'Enregistrer' })
    await expect(enregistrerModif).toBeEnabled({ timeout: 10000 })
    await enregistrerModif.click()
    await expect(edition).toBeHidden({ timeout: 15000 })

    // Et la ligne est toujours là, toujours rattachée : l'enregistrement n'a rien détaché.
    await expect(page.getByRole('row', { name: /Camping E2E — produit/ })).toBeVisible({
      timeout: 15000,
    })

    // Nettoyage : la ligne puis le tarif.
    const rapport = await (
      await page.request.get(`${BASE}/api/editions/${editionId}/treasury`)
    ).json()
    const ligne = rapport.data.lines.find(
      (l: { title?: string }) => l.title === 'Camping E2E — produit'
    )
    if (ligne?.entryId) {
      await apiDelete(page, `${BASE}/api/editions/${editionId}/treasury/entries/${ligne.entryId}`)
    }
    await apiDelete(page, `${BASE}/api/editions/${editionId}/ticketing/tiers/${tierId}`)
  })

  /**
   * Le filtre par ÉTAT : avancées, prévisionnelles.
   *
   * ⚠️ CE QUE LES TESTS UNITAIRES NE VOIENT PAS. La règle de sélection est pure et couverte par
   * `etats-de-tresorerie.test.ts`. Ce parcours couvre le CÂBLAGE : que le sélecteur existe dans
   * les DEUX exemplaires des filtres — la barre et la modale du téléphone —, que l'état voyage
   * dans l'URL, et qu'il survive à un rechargement. Un filtre qui ne se recopie pas par son lien
   * est un filtre qu'on ne peut pas partager.
   */
  test('filtre par état, et le retient dans l’URL', async ({ page, goto }) => {
    const { editionId } = loadState()

    await page.setViewportSize({ width: 1400, height: 900 })
    await goto(`/editions/${editionId}/gestion/treasury`, { waitUntil: 'hydration' })
    await expect(page.getByRole('heading', { name: 'Trésorerie' })).toBeVisible({ timeout: 20000 })

    const avant = await lignes(page).count()
    expect(avant, 'aucune ligne : la trésorerie ne charge pas').toBeGreaterThan(0)

    // Le sélecteur s'expose en `button "Show popup"` — on clique son texte indicatif, qui
    // n'appartient qu'à lui (leçon de la modale des tarifs).
    await page.getByText('Tous les états').first().click()
    await page.getByRole('option', { name: 'Prévisionnelles' }).click()
    await page.keyboard.press('Escape')

    /*
     * ⚠️ L'URL D'ABORD : c'est elle qui prouve que le filtre est posé, indépendamment de ce que la
     * liste contient. Les lignes PRÉVISIONNELLES de l'édition E2E dépendent des parcours voisins,
     * donc compter les survivantes serait fragile — mais le filtre doit nécessairement RÉDUIRE ou
     * égaler, jamais augmenter.
     */
    await expect
      .poll(() => new URL(page.url()).searchParams.get('etat'), { timeout: 10000 })
      .toBe('previsionnelle')
    const apres = await lignes(page).count()
    expect(apres, 'le filtre a AUGMENTÉ le nombre de lignes').toBeLessThanOrEqual(avant)

    // Et il survit au rechargement : sans cela le lien ne se partage pas.
    await goto(`/editions/${editionId}/gestion/treasury?etat=previsionnelle`, {
      waitUntil: 'hydration',
    })
    await expect(page.getByText('Prévisionnelles').first()).toBeVisible({ timeout: 20000 })

    // « Effacer les filtres » le retire aussi, sinon il resterait collé à l'écran.
    await page.getByRole('button', { name: 'Effacer les filtres' }).click()
    await expect
      .poll(() => new URL(page.url()).searchParams.get('etat'), { timeout: 10000 })
      .toBeNull()
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
  /*
   * Le sens vient du BOUTON, plus d'un sélecteur dans la modale : « Ajouter une charge » sur la
   * carte des charges, « Ajouter un produit » sur celle des produits.
   */
  const bouton = entry.kind === 'Charge' ? 'Ajouter une charge' : 'Ajouter un produit'
  await page.getByRole('button', { name: bouton }).click()

  const dialog = page.getByRole('dialog')

  // Et le formulaire est DÉJÀ du bon côté : son titre le nomme, et aucune nature n'est à choisir.
  await expect(dialog.getByText(bouton)).toBeVisible()
  await expect(dialog.getByText('Nature', { exact: true })).toHaveCount(0)
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
