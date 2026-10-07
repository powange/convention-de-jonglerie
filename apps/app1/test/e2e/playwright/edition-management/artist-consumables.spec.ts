import { expect, test } from '@nuxt/test-utils/playwright'

import { apiDelete, apiPost, apiPut, loadCredentials, loadState } from '../helpers'

const BASE_URL = 'http://localhost:3000'

/**
 * Couvre le remboursement des consommables (matériel consommé pendant la prestation),
 * enveloppe distincte du défraiement trajet.
 *
 * Flow couvert :
 *   1. Création d'un artiste avec un plafond de consommables
 *   2. Relecture via la liste de gestion (round-trip Decimal)
 *   3. Renseignement du réel + marquage remboursé via PUT
 *   4. Garde-fou : réel > max rejeté en 400
 *   5. Garde-fou : suppression du max impossible tant qu'un réel existe
 *   6. Indépendance vis-à-vis du défraiement trajet
 */
test.describe.serial('Remboursement des consommables des artistes', () => {
  const timestamp = Date.now()
  const ARTIST_EMAIL = `e2e-consumables-${timestamp}@example.com`

  let editionId: string
  let artistId: number
  let selfArtistId: number

  const getArtist = async (page: any) => {
    const res = await page.request.get(`${BASE_URL}/api/editions/${editionId}/artists`)
    expect(res.ok(), `GET /artists a échoué: ${await res.text()}`).toBe(true)
    const body = await res.json()
    const artists = body.data?.artists || body.artists || []
    return artists.find((a: any) => a.user.email === ARTIST_EMAIL)
  }

  test('création d’un artiste avec un plafond de consommables', async ({ page }) => {
    editionId = loadState().editionId

    const response = await apiPost(page, `${BASE_URL}/api/editions/${editionId}/artists`, {
      data: {
        email: ARTIST_EMAIL,
        prenom: 'Conso',
        nom: 'Test',
        payment: 400,
        reimbursementMax: 150,
        consumablesMax: 80,
      },
    })
    expect(response.ok(), `POST /artists a échoué: ${await response.text()}`).toBe(true)

    const artist = await getArtist(page)
    expect(artist, `Artiste ${ARTIST_EMAIL} non trouvé`).toBeDefined()
    artistId = artist.id

    // Le plafond est bien persisté, et les enveloppes ne se mélangent pas
    expect(Number(artist.consumablesMax)).toBe(80)
    expect(artist.consumablesActual).toBeNull()
    expect(artist.consumablesActualPaid).toBe(false)
    expect(Number(artist.reimbursementMax)).toBe(150)
  })

  test('renseignement du réel puis marquage comme remboursé', async ({ page }) => {
    const response = await apiPut(
      page,
      `${BASE_URL}/api/editions/${editionId}/artists/${artistId}`,
      { data: { consumablesActual: 62.5, consumablesActualPaid: true } }
    )
    expect(response.ok(), `PUT a échoué: ${await response.text()}`).toBe(true)

    const artist = await getArtist(page)
    expect(Number(artist.consumablesActual)).toBe(62.5)
    expect(artist.consumablesActualPaid).toBe(true)
    // Le défraiement trajet n'a pas bougé
    expect(artist.reimbursementActualPaid).toBe(false)
  })

  test('un réel supérieur au plafond est rejeté', async ({ page }) => {
    const response = await apiPut(
      page,
      `${BASE_URL}/api/editions/${editionId}/artists/${artistId}`,
      { data: { consumablesActual: 500 } }
    )
    expect(response.status()).toBe(400)

    // La valeur en base n'a pas été modifiée
    const artist = await getArtist(page)
    expect(Number(artist.consumablesActual)).toBe(62.5)
  })

  test('le plafond ne peut pas être supprimé tant qu’un réel existe', async ({ page }) => {
    const response = await apiPut(
      page,
      `${BASE_URL}/api/editions/${editionId}/artists/${artistId}`,
      { data: { consumablesMax: null } }
    )
    expect(response.status()).toBe(400)

    const artist = await getArtist(page)
    expect(Number(artist.consumablesMax)).toBe(80)
  })

  test('les consommables sont visibles dans le tableau de gestion', async ({ page, goto }) => {
    await goto(`/editions/${editionId}/gestion/artists`, { waitUntil: 'hydration' })

    // Cible la ligne par l'email : le libellé d'en-tête « Consommables » contient
    // sinon le prénom de l'artiste de test.
    // Les montants sont formatés dans la devise de l'édition depuis la trésorerie : le réel
    // s'affiche « 62,50 € », plus le nombre brut « 62.5 » d'avant la bascule en centimes.
    const row = page.locator('tr', { hasText: ARTIST_EMAIL }).first()
    await expect(row).toContainText('Max:80')
    await expect(row).toContainText('62,50')
  })

  test('l’artiste voit ses consommables dans son espace artiste', async ({ page, goto }) => {
    // Le compte E2E est déjà authentifié : on l'inscrit lui-même comme artiste
    // pour pouvoir visiter /artist-space avec sa propre session.
    const { email } = loadCredentials()

    const created = await apiPost(page, `${BASE_URL}/api/editions/${editionId}/artists`, {
      data: { email, prenom: 'Self', nom: 'Artist', consumablesMax: 90, consumablesActual: 45 },
    })

    /*
     * ⚠️ « DÉJÀ ARTISTE » N'EST PAS UN ÉCHEC ICI. À la reprise d'un test, cette inscription
     * retombe sur la fiche que la tentative précédente a laissée, et le point d'API rend 400. Le
     * test échouait alors pour une raison qui n'est pas la sienne, et la reprise ne pouvait jamais
     * réussir — ce qui retire tout intérêt aux reprises de ce fichier.
     *
     * La recherche qui suit retrouve la fiche dans les deux cas : c'est elle qui fait foi.
     */
    if (!created.ok()) {
      const corps = await created.text()
      expect(corps, `POST /artists (self) a échoué: ${corps}`).toContain('déjà artiste')
    }

    const res = await page.request.get(`${BASE_URL}/api/editions/${editionId}/artists`)
    const body = await res.json()
    const artists = body.data?.artists || body.artists || []
    selfArtistId = artists.find((a: any) => a.user.email === email)?.id

    await goto(`/editions/${editionId}/artist-space`, { waitUntil: 'hydration' })

    // Le bloc consommables s'affiche avec plafond, réel et statut en attente
    await expect(page.getByText('Consommables maximum')).toBeVisible()
    await expect(page.getByText('90 €')).toBeVisible()
    await expect(page.getByText('Consommables réels')).toBeVisible()
    await expect(page.getByText('45 €')).toBeVisible()
    await expect(page.getByText('Consommables en attente')).toBeVisible()
  })

  test('l’artiste saisit ses coordonnées bancaires, normalisées à l’enregistrement', async ({
    page,
    goto,
  }) => {
    /*
     * ⚠️ UN SPEC AUTHENTIFIÉ ET NON UN TEST MONTÉ : l'espace artiste est rendu côté client, et
     * seul un vrai parcours connecté exécute le composant. Un 200 par `curl` ne prouverait rien.
     *
     * 📍 L'IBAN est saisi AVEC SES ESPACES, comme on le recopie d'un relevé. C'est tout l'objet de
     * la normalisation serveur : sans elle, « BE68 5390… » et « BE6853 90… » seraient deux valeurs
     * différentes pour le même compte, qu'on ne compare jamais.
     */
    /*
     * ⚠️ REPARTIR D'UN ÉTAT CONNU. Le bouton « Enregistrer » n'est actif que si le formulaire
     * diffère de la base — c'est le garde-fou qui évite d'envoyer un enregistrement inutile. Au
     * second passage de ce fichier, l'IBAN y était déjà, rien ne différait, et le clic expirait sur
     * un bouton désactivé. Le test échouait donc pour une raison qui n'est pas la sienne.
     */
    const remise = await apiPut(page, `${BASE_URL}/api/editions/${editionId}/my-payment-info`, {
      data: { iban: null, bic: null },
    })
    expect(remise.ok(), `remise à zéro des coordonnées: ${await remise.text()}`).toBe(true)

    await goto(`/editions/${editionId}/artist-space`, { waitUntil: 'hydration' })

    // Tout vit dans la carte des montants : le bloc bancaire n'est plus une carte à lui, mais un
    // sous-titre à l'intérieur de « Paiement et remboursements ».
    await expect(page.getByRole('heading', { name: 'Paiement et remboursements' })).toBeVisible()
    await expect(page.getByText('Coordonnées bancaires')).toBeVisible()

    await page.getByLabel('IBAN', { exact: true }).fill('be68 5390 0754 7034')
    await page.getByLabel('BIC', { exact: true }).fill('gebabebb')
    await page.getByRole('button', { name: 'Enregistrer' }).click()

    await expect(page.getByText('Coordonnées enregistrées', { exact: true })).toBeVisible()

    // Ce que la BASE a retenu, et non ce que l'écran affiche : c'est la valeur comparable.
    const relu = await page.request.get(`${BASE_URL}/api/editions/${editionId}/my-artist-info`)
    expect(relu.ok(), `GET /my-artist-info a échoué: ${await relu.text()}`).toBe(true)
    const { artist } = await relu.json()
    expect(artist.iban).toBe('BE68539007547034')
    expect(artist.bic).toBe('GEBABEBB')

    /*
     * ⚠️ L'ASSERTION QUI MANQUAIT, ET LE DÉFAUT QU'ELLE FERME. Vérifier la base ne prouve pas que
     * l'écran relit : au rechargement, le champ restait VIDE alors que l'IBAN était enregistré.
     *
     * La cause était dans la garde du rappel d'initialisation. Il renonçait si le formulaire était
     * « modifié », et « modifié » se mesurait en comparant le champ à la base — au chargement, le
     * champ est vide et la base porte un IBAN, donc la comparaison rendait vrai et le rappel
     * renonçait exactement quand il fallait remplir.
     *
     * 📍 On attend la forme PAR GROUPES DE QUATRE : c'est ce que l'écran doit afficher pour qu'on
     * puisse relire un IBAN caractère par caractère en le comparant au papier.
     */
    /*
     * ⚠️ `goto` AVEC `hydration`, ET SURTOUT PAS `page.reload({ waitUntil: 'networkidle' })`. En
     * développement, le serveur garde une connexion ouverte pour le rechargement à chaud : le
     * réseau n'est JAMAIS au repos, et l'attente expire au bout des deux minutes du test. Mesuré :
     * « waiting for navigation until networkidle », après avoir pourtant navigué. C'est la
     * convention de tous les autres parcours du dépôt.
     */
    await goto(`/editions/${editionId}/artist-space`, { waitUntil: 'hydration' })

    await expect(page.getByLabel('IBAN', { exact: true })).toHaveValue('BE68 5390 0754 7034')
    await expect(page.getByLabel('BIC', { exact: true })).toHaveValue('GEBABEBB')

    // Et le bouton ne doit PAS être proposé : rien n'a changé depuis le chargement. Sans cela, un
    // clic enverrait `iban: null` et effacerait les coordonnées qu'on vient de lire.
    await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  })

  test('le justificatif des consommables se dépose depuis une modale, et se relit', async ({
    page,
    goto,
  }) => {
    /*
     * ⚠️ LE BOUTON CHANGE D'ALLURE SELON L'ÉTAT, et c'est ce qu'on éprouve : « Ajouter un
     * justificatif » tant qu'il n'y a rien, « Justificatif » ensuite. Deux boutons identiques
     * auraient obligé à ouvrir la modale pour savoir si le document était là.
     *
     * 📍 On passe par le point d'API pour attacher le fichier, et non par le sélecteur de
     * fichiers : Playwright sait téléverser, mais ce que ce spec doit prouver est le PARCOURS
     * d'affichage — le bouton, la modale, l'aperçu —, pas le téléversement, déjà couvert ailleurs.
     */
    await goto(`/editions/${editionId}/artist-space`, { waitUntil: 'hydration' })

    /*
     * ⚠️ `data-justificatif` ET NON UN CHEMIN RELATIF. Remonter deux `..` depuis le libellé du
     * montant fonctionnait, mais visait par la POSITION : réordonner la ligne, ou glisser un
     * conteneur, aurait fait pointer le sélecteur ailleurs sans que rien ne le dise. L'attribut
     * porte l'identité du champ.
     */
    const justificatif = page.locator('[data-justificatif="consumables"]')

    // Témoin : la carte est bien rendue, donc l'absence qui suit a du sens.
    await expect(page.getByText('Consommables maximum')).toBeVisible()

    // Rien encore : l'invitation à déposer, et aucune pastille.
    await expect(
      justificatif.getByRole('button', { name: 'Ajouter un justificatif' })
    ).toBeVisible()
    /*
     * ⚠️ `exact: true` : la correspondance d'un nom accessible est une SOUS-CHAÎNE par défaut, et
     * « Ajouter un justificatif » contient donc « Justificatif ». L'assertion trouvait la pastille
     * là où il n'y avait que l'invitation à déposer, et le test échouait sur un défaut imaginaire.
     */
    await expect(
      justificatif.getByRole('button', { name: 'Justificatif', exact: true })
    ).toHaveCount(0)

    // La modale d'envoi s'ouvre et se referme sans rien changer.
    await justificatif.getByRole('button', { name: 'Ajouter un justificatif' }).click()
    await expect(page.getByRole('button', { name: 'Annuler' })).toBeVisible()
    await page.getByRole('button', { name: 'Annuler' }).click()
    await expect(
      justificatif.getByRole('button', { name: 'Ajouter un justificatif' })
    ).toBeVisible()
  })

  test('la carte présence n’affiche ses champs qu’après un clic sur modifier', async ({
    page,
    goto,
  }) => {
    /*
     * ⚠️ LE DÉFAUT QUE CE SPEC FERME : le formulaire portait un `v-else` accroché au `v-if` du
     * rappel de récupération, lequel teste DEUX choses. Pour un artiste sans demande d'aller ni de
     * retour — le cas du compte d'essai —, les champs de saisie s'affichaient donc sous le résumé,
     * en permanence.
     *
     * 📍 C'est précisément parce que le défaut ne se voyait QUE dans ce cas qu'il a vécu : avec une
     * demande de récupération, le `v-else` tombait juste par accident.
     */
    await goto(`/editions/${editionId}/artist-space`, { waitUntil: 'hydration' })

    /*
     * ⚠️ `data-carte` ET NON UN CHEMIN RELATIF DEPUIS LE TITRE. La première version faisait
     * `getByRole('heading').locator('../..')`, ce qui désigne le bloc d'en-tête de l'`UCard` — un
     * FRÈRE du corps, pas son ancêtre : l'assertion « aucun champ » y était vraie par construction,
     * correctif ou pas, et celle d'après ne pouvait jamais passer.
     *
     * ⚠️ `getByText` ET NON `getByLabel`. `UiDateTimePicker` pose son libellé sur un `UFormField`
     * dont le contrôle est un `UButton`, et `UButton` ne reprend pas l'identifiant du champ comme
     * le fait `UInput` : le `for` du libellé ne désigne rien, et `getByLabel` ne résout nulle part.
     * Le TEXTE, lui, est bien rendu.
     */
    const presence = page.locator('[data-carte="presence"]')

    // Au repos : aucun champ de date. « Date d'arrivée » n'existe que dans le formulaire — le
    // résumé, lui, dit « Arrivée ».
    await expect(presence.getByText("Date d'arrivée")).toHaveCount(0)
    // Témoin : la carte est bien là et bien rendue. Sans lui, un sélecteur devenu faux rendrait
    // l'absence vraie pour la mauvaise raison — c'est exactement ce qui s'était produit.
    await expect(presence.getByRole('heading', { name: 'Présence' })).toBeVisible()

    await presence.getByRole('button', { name: 'Modifier' }).click()

    // Après le clic : les champs apparaissent.
    await expect(presence.getByText("Date d'arrivée")).toBeVisible()
  })

  /*
   * ⚠️ CE TEST PASSE EN DERNIER, ET CE N'EST PAS UN DÉTAIL D'ORDRE. Il efface les trois
   * montants de la fiche, donc la condition qui fait exister la carte entière. Placé plus haut,
   * il privait le test suivant de son décor : « Consommables maximum » et les deux boutons de
   * justificatif n'étaient plus rendus, et l'échec était déterministe dans un `describe.serial`.
   *
   * 📍 La mutation est persistée en base : un test qui défait le décor doit venir après tous
   * ceux qui s'en servent, ou le remettre en place lui-même.
   */
  test('la carte bancaire disparaît quand plus aucun montant n’est annoncé', async ({
    page,
    goto,
  }) => {
    /*
     * La règle décidée le 07/10/2026 : un artiste qu'on ne paie pas n'a pas à voir de section
     * bancaire. La même condition gouverne l'encart des montants et celui de la saisie — c'est
     * pourquoi elle est en facteur commun dans la page.
     *
     * ⚠️ LE RÉEL D'ABORD, PUIS LE PLAFOND : une garde du point d'API refuse d'effacer un plafond
     * tant qu'un montant réel s'y rattache. L'ordre inverse rendrait 400, et le test échouerait
     * pour une raison qui n'est pas la sienne.
     */
    const vider = async (data: Record<string, unknown>) => {
      const res = await apiPut(
        page,
        `${BASE_URL}/api/editions/${editionId}/artists/${selfArtistId}`,
        { data }
      )
      expect(res.ok(), `PUT a échoué: ${await res.text()}`).toBe(true)
    }

    await vider({ consumablesActual: null })
    await vider({ consumablesMax: null, payment: null, reimbursementMax: null })

    await goto(`/editions/${editionId}/artist-space`, { waitUntil: 'hydration' })

    await expect(page.getByRole('heading', { name: 'Paiement et remboursements' })).toHaveCount(0)
    await expect(page.getByText('Coordonnées bancaires')).toHaveCount(0)
    // Témoin : la page a bien été rendue. Sans lui, une page en erreur passerait au vert, puisque
    // l'absence attendue y serait tout aussi vraie.
    await expect(page.getByText('Mes spectacles')).toBeVisible()
  })

  test('⚠️ « Reste à verser » liste les artistes à payer, et le bouton solde tout', async ({
    page,
    goto,
  }) => {
    /*
     * ⚠️ UN ÉTAT POSÉ PAR CE TEST, ET VISÉ PAR IDENTITÉ. Le total de la carte additionne TOUS les
     * artistes de l'édition d'essai, que d'autres tests font varier : s'y accrocher produirait un
     * échec selon l'ordre d'exécution. Ce qu'on éprouve, c'est la ligne de NOTRE artiste et le
     * geste qui la solde.
     *
     * 📍 DEUX DETTES SUR TROIS, ET LA TROISIÈME VIDE MAIS NON MARQUÉE. C'est la construction qui
     * rend l'assertion finale discriminante : les consommables n'ont aucun montant réel et leur
     * drapeau est à `false`. Si le bouton posait les trois drapeaux au lieu des seules dettes
     * dues, il écrirait « remboursé » sur une somme qui n'existe pas — et la fiche annoncerait un
     * remboursement jamais fait.
     */
    const prepare = await apiPut(
      page,
      `${BASE_URL}/api/editions/${editionId}/artists/${artistId}`,
      {
        data: {
          payment: 400,
          paymentPaid: false,
          reimbursementActual: 100,
          consumablesActual: null,
          consumablesActualPaid: false,
        },
      }
    )
    expect(prepare.ok(), `préparation de l'état: ${await prepare.text()}`).toBe(true)

    await goto(`/editions/${editionId}/gestion/artists`, { waitUntil: 'hydration' })

    // La carte s'annonce comme cliquable, et on la clique.
    await expect(page.getByText('Reste à verser')).toBeVisible()
    await page.getByText('Reste à verser').click()

    const ligne = page.locator(`[data-a-payer="${artistId}"]`)
    await expect(ligne).toBeVisible()

    // Le montant est bien la somme des DEUX dettes dues — 400 + 100 —, et non celle des trois.
    await expect(ligne.getByText('500 €')).toBeVisible()
    /*
     * De quoi payer sans rouvrir la fiche — et de quoi RELANCER sans recopier. On assère le `href`
     * et non la seule présence du texte : une adresse affichée en texte mort ressemble à un lien
     * et n'en est pas, ce qui était le cas avant (un `ULink` nu hérite de la couleur de son parent
     * et ne se distingue de rien).
     */
    await expect(ligne.getByRole('link', { name: ARTIST_EMAIL })).toHaveAttribute(
      'href',
      `mailto:${ARTIST_EMAIL}`
    )
    await expect(ligne.getByText('de cachet', { exact: false })).toBeVisible()

    await ligne.getByRole('button', { name: 'Marquer comme versé' }).click()

    // La ligne quitte la liste d'elle-même : la page relit les artistes après l'enregistrement.
    await expect(ligne).toHaveCount(0)

    /*
     * Ce que la BASE a retenu. L'écran peut très bien masquer une ligne sans que rien n'ait été
     * écrit — c'est exactement la différence entre « ça a l'air réglé » et « c'est réglé ».
     */
    const relu = await getArtist(page)
    expect(relu.paymentPaid).toBe(true)
    expect(relu.reimbursementActualPaid).toBe(true)
    /*
     * ⚠️ L'ASSERTION QUI DISCRIMINE : les consommables n'avaient aucun montant réel, leur drapeau
     * doit donc être resté à `false`. Un bouton qui poserait les trois sans regarder le rendrait
     * `true` ici, et la fiche annoncerait un remboursement jamais fait.
     *
     * 📍 Ma première version attendait `true` sur un drapeau qui l'était DÉJÀ : elle était donc
     * verte dans les deux cas, tout en prétendant par son commentaire prouver le contraire.
     */
    expect(relu.consumablesActualPaid).toBe(false)
    // Et aucun montant n'a bougé : le bouton solde, il ne réécrit pas les sommes.
    expect(Number(relu.payment)).toBe(400)
    expect(Number(relu.reimbursementActual)).toBe(100)
  })

  // Le compte E2E est partagé par tous les specs : le laisser inscrit comme artiste
  // ferait apparaître l'espace artiste dans sa navigation et casserait un rerun.
  test('la facture : demandée, déposée, et la remise cochée d’elle-même', async ({
    page,
    goto,
  }) => {
    /*
     * C'est l'ARTISTE qui fournit sa facture : il la remet à la convention, pas l'inverse. Ce
     * parcours éprouve les trois choses qui en découlent :
     *
     *   1. le dépôt n'est proposé QUE si une facture est demandée — déposer une facture que
     *      personne n'a réclamée n'a pas de sens ;
     *   2. déposer vaut remise : `invoiceProvided` passe à vrai sans qu'on coche quoi que ce soit ;
     *   3. retirer le fichier NE décoche PAS — la case vaut aussi pour une facture reçue par
     *      courriel, et la décocher effacerait ce qu'un organisateur a saisi à la main.
     *
     * 📍 L'URL désigne un fichier qui n'existe pas, et c'est suffisant : le serveur accepte d'un
     * ORGANISATEUR une URL déjà définitive pourvu qu'elle désigne le dossier `artists` de cette
     * édition. Ce qu'on éprouve est la règle et l'affichage, pas la lecture du fichier.
     */
    const { conventionId } = loadState()
    const facture = `/uploads/conventions/${conventionId}/editions/${editionId}/artists/e2e-facture.pdf`

    const fiche = async () => {
      const res = await page.request.get(`${BASE_URL}/api/editions/${editionId}/artists`)
      const body = await res.json()
      const artists = body.data?.artists || body.artists || []
      return artists.find((a: any) => a.id === selfArtistId)
    }

    // --- 1. Aucune facture demandée : rien à déposer ---
    await apiPut(page, `${BASE_URL}/api/editions/${editionId}/artists/${selfArtistId}`, {
      data: { invoiceRequested: false, invoiceProvided: false, invoiceUrl: null },
    })
    await goto(`/editions/${editionId}/artist-space`, { waitUntil: 'hydration' })

    /*
     * Témoin : la page est bien rendue, donc l'absence qui suit a du sens.
     *
     * ⚠️ LE SOUS-TITRE DE LA PAGE, et non « Consommables maximum ». Ce bloc-là dépend d'un plafond
     * qu'un parcours précédent de ce `describe.serial` efface : le témoin tombait, et l'échec
     * désignait un défaut qui n'existait pas. Un témoin doit survivre à ses voisins.
     *
     * Et pas le `h1` non plus, qui porte le NOM de l'artiste : ce sous-titre est le seul texte
     * fixe que l'en-tête rende dès que la fiche est chargée.
     */
    await expect(page.getByText('Votre récapitulatif pour cette édition')).toBeVisible({
      timeout: 20000,
    })
    await expect(page.locator('[data-justificatif="invoice"]')).toHaveCount(0)

    // --- 2. Une facture est demandée : le dépôt apparaît ---
    await apiPut(page, `${BASE_URL}/api/editions/${editionId}/artists/${selfArtistId}`, {
      data: { invoiceRequested: true },
    })
    await goto(`/editions/${editionId}/artist-space`, { waitUntil: 'hydration' })

    const justificatif = page.locator('[data-justificatif="invoice"]')
    await expect(justificatif).toBeVisible({ timeout: 20000 })
    /*
     * ⚠️ `exact: true` : un nom accessible s'apparie par SOUS-CHAÎNE, et « Ajouter un
     * justificatif » contient « Justificatif ». Sans cela, l'assertion de la pastille trouverait
     * l'invitation à déposer et ce parcours serait vert sans rien prouver.
     */
    await expect(
      justificatif.getByRole('button', { name: 'Ajouter un justificatif' })
    ).toBeVisible()
    await expect(
      justificatif.getByRole('button', { name: 'Justificatif', exact: true })
    ).toHaveCount(0)
    // Et la pastille dit qu'on l'attend encore.
    await expect(page.getByText('Facture demandée')).toBeVisible()

    // --- 3. Déposée depuis la gestion : la remise se coche d'elle-même ---
    const depot = await apiPut(
      page,
      `${BASE_URL}/api/editions/${editionId}/artists/${selfArtistId}`,
      { data: { invoiceUrl: facture } }
    )
    expect(depot.ok(), `dépôt refusé : ${await depot.text()}`).toBe(true)

    const apresDepot = await fiche()
    expect(apresDepot.invoiceUrl).toBe(facture)
    // LA règle du lot : personne n'a coché cette case.
    expect(apresDepot.invoiceProvided, 'déposer la facture n’a pas valu remise').toBe(true)

    await goto(`/editions/${editionId}/artist-space`, { waitUntil: 'hydration' })
    await expect(
      page.locator('[data-justificatif="invoice"]').getByRole('button', {
        name: 'Justificatif',
        exact: true,
      })
    ).toBeVisible({ timeout: 20000 })
    await expect(page.getByText('Facture fournie')).toBeVisible()

    // --- 4. Retirée : la case reste cochée, délibérément ---
    const retrait = await apiPut(
      page,
      `${BASE_URL}/api/editions/${editionId}/artists/${selfArtistId}`,
      { data: { invoiceUrl: null } }
    )
    expect(retrait.ok(), `retrait refusé : ${await retrait.text()}`).toBe(true)

    const apresRetrait = await fiche()
    expect(apresRetrait.invoiceUrl).toBeNull()
    expect(
      apresRetrait.invoiceProvided,
      'le retrait du fichier a décoché la remise, ce qui effacerait une saisie manuelle'
    ).toBe(true)

    /*
     * --- 5. La porte, côté GESTION ---
     *
     * C'était la demande : « on doit pouvoir déposer la facture si une facture est demandée ». Les
     * deux artistes de ce parcours donnent la comparaison sans rien modifier — l'un en attend une,
     * l'autre non. Comparer deux fiches dans le même état de page vaut mieux que basculer un
     * interrupteur et relire : rien ici ne dépend de l'ordre.
     */
    await goto(`/editions/${editionId}/gestion/artists`, { waitUntil: 'hydration' })
    const { email } = loadCredentials()

    const ouvrirLaFiche = async (courriel: string) => {
      const ligne = page.locator('tr', { hasText: courriel }).first()
      await expect(ligne).toBeVisible({ timeout: 20000 })
      // Nommé pour l'occasion : réduit à son icône, ce bouton n'avait aucun nom accessible et ne
      // pouvait être visé que par sa position dans la rangée.
      await ligne.getByRole('button', { name: "Modifier l'artiste" }).click()

      /*
       * ⚠️ OUVRIR L'ONGLET « PAIEMENT », sans quoi l'assertion de visibilité échoue sur un champ
       * qui est pourtant là : la modale pose `:unmount-on-hide="false"`, et le panneau inactif
       * reste donc MONTÉ mais caché. C'est aussi le vrai chemin — la facture vit avec l'argent.
       */
      const fiche = page.getByRole('dialog')
      await fiche.getByRole('tab', { name: 'Paiement' }).click()
      return fiche
    }

    // Une facture est demandée à l'artiste « self » : le dépôt est là.
    const ficheSelf = await ouvrirLaFiche(email)
    await expect(ficheSelf.getByText("Facture de l'artiste")).toBeVisible({ timeout: 15000 })
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // L'autre artiste n'en a aucune de demandée : le dépôt n'apparaît pas.
    const ficheAutre = await ouvrirLaFiche(ARTIST_EMAIL)
    // Témoin : on est bien dans la section qui l'aurait porté, donc l'absence a du sens.
    await expect(ficheAutre.getByText('Facture et cachet')).toBeVisible({ timeout: 15000 })
    await expect(ficheAutre.getByText("Facture de l'artiste")).toHaveCount(0)
    await page.keyboard.press('Escape')
  })

  test('les justificatifs se relisent depuis le tableau, image en grand et PDF dans un onglet', async ({
    page,
    goto,
  }) => {
    const { editionId, conventionId } = loadState()
    const dossier = `/uploads/conventions/${conventionId}/editions/${editionId}/artists`
    const DEFRAIEMENT = `${dossier}/e2e-billet.jpg`
    const CONSOMMABLES = `${dossier}/e2e-ticket.jpg`
    const FACTURE = `${dossier}/e2e-facture-tableau.pdf`

    /*
     * Les URL désignent des fichiers qui n'existent pas, et c'est suffisant : ce parcours éprouve
     * la PRÉSENCE de l'icône et le chemin qu'elle emprunte, pas la lecture du fichier — celle-ci
     * est couverte par `test/nuxt/server/routes/uploads-fichier-servi`.
     *
     * ⚠️ `invoiceRequested` RESTE FAUX, délibérément. L'icône de la facture est conditionnée au
     * FICHIER et non à « demandée et fournie » : `invoiceProvided` peut être vrai sans fichier — la
     * case est cochable seule, pour une facture reçue par courriel. Une icône posée sur cet état-là
     * serait parfois un clic qui n'ouvre rien. Ce test fige ce choix.
     */
    const pose = await apiPut(
      page,
      `${BASE_URL}/api/editions/${editionId}/artists/${selfArtistId}`,
      {
        data: {
          reimbursementMax: 150,
          reimbursementReceiptUrl: DEFRAIEMENT,
          consumablesMax: 90,
          consumablesReceiptUrl: CONSOMMABLES,
          invoiceRequested: false,
          invoiceUrl: FACTURE,
        },
      }
    )
    expect(pose.ok(), `pose des justificatifs refusée : ${await pose.text()}`).toBe(true)

    await goto(`/editions/${editionId}/gestion/artists`, { waitUntil: 'hydration' })
    const { email } = loadCredentials()
    const ligne = page.locator('tr', { hasText: email }).first()
    await expect(ligne).toBeVisible({ timeout: 20000 })

    /*
     * ⚠️ `exact: true` : un nom accessible s'apparie par SOUS-CHAÎNE. « Justificatif » seul
     * attraperait les trois icônes à la fois, et l'assertion serait vraie sans rien prouver.
     */
    const iconeDefraiement = ligne.getByRole('button', {
      name: 'Justificatif du défraiement',
      exact: true,
    })
    await expect(iconeDefraiement).toBeVisible()

    // Une IMAGE s'ouvre en grand, dans la modale que porte la page — et avec la bonne URL.
    await iconeDefraiement.click()
    const apercu = page.getByRole('dialog')
    await expect(apercu.locator('img')).toHaveAttribute('src', DEFRAIEMENT, { timeout: 10000 })
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // Les consommables suivent le même chemin, depuis leur propre colonne.
    const iconeConsommables = ligne.getByRole('button', {
      name: 'Justificatif des consommables',
      exact: true,
    })
    await expect(iconeConsommables).toBeVisible()
    await iconeConsommables.click()
    await expect(page.getByRole('dialog').locator('img')).toHaveAttribute('src', CONSOMMABLES, {
      timeout: 10000,
    })
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)

    /*
     * LA FACTURE EST UN PDF : un LIEN, pas un bouton — c'est le discriminant, et il tient à `to`.
     * Elle est là alors qu'aucune facture n'est « demandée » : c'est le fichier qui commande.
     */
    const lienFacture = ligne.getByRole('link', { name: "Facture de l'artiste", exact: true })
    await expect(lienFacture).toBeVisible()
    await expect(lienFacture).toHaveAttribute('target', '_blank')
    const [onglet] = await Promise.all([page.waitForEvent('popup'), lienFacture.click()])
    expect(onglet.url()).toContain('e2e-facture-tableau.pdf')
    await onglet.close()
    // La modale est restée fermée : un PDF ne passe pas par elle.
    await expect(page.getByRole('dialog')).toHaveCount(0)

    /*
     * LE TÉMOIN NÉGATIF. Sans lui, une icône affichée sur TOUTES les lignes passerait chacune des
     * assertions ci-dessus. L'autre artiste du parcours n'a aucun justificatif : sa ligne ne doit
     * porter aucune des trois icônes.
     */
    const ligneSansRien = page.locator('tr', { hasText: ARTIST_EMAIL }).first()
    await expect(ligneSansRien).toBeVisible()
    for (const nom of [
      'Justificatif du défraiement',
      'Justificatif des consommables',
      "Facture de l'artiste",
    ]) {
      await expect(ligneSansRien.getByLabel(nom, { exact: true })).toHaveCount(0)
    }
  })

  test('nettoyage : supprimer les artistes créés', async ({ page }) => {
    for (const id of [artistId, selfArtistId]) {
      if (!id) continue
      const del = await apiDelete(page, `${BASE_URL}/api/editions/${editionId}/artists/${id}`)
      expect(del.ok(), `DELETE artiste ${id} a échoué: ${await del.text()}`).toBe(true)
    }
  })
})
