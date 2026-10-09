import { expect, test } from '@nuxt/test-utils/playwright'

import {
  createShowCall,
  deleteShowCall,
  getEditionStatus,
  loadState,
  setEditionStatus,
  updateEdition,
  updateShowCall,
} from '../helpers'

/**
 * Sur la page centralisée des appels ouverts, la description n'est plus affichée brute.
 *
 * ## ⚠️ POURQUOI UNE SPÉCIFICATION, ET NON SEULEMENT DES TESTS UNITAIRES
 *
 * `markdownEnTexte` est une fonction pure, couverte par neuf cas unitaires. Ce qui n'était couvert
 * par rien, c'est le **branchement** : un `ref` alimenté par un watcher, parce que la fonction est
 * asynchrone et qu'un `computed` rendrait l'objet `Promise` — que le gabarit afficherait sous la
 * forme « [object Promise] ».
 *
 * ⚠️⚠️ ET UNE SONDE SUR LE SERVEUR DE DÉVELOPPEMENT NE SUFFISAIT PAS : la base n'y contient
 * **AUCUN appel ouvert**. La page répondait donc 200 sans qu'aucune description soit rendue — un
 * relevé entièrement vert au-dessus d'un branchement qui aurait pu ne rien faire du tout. C'est le
 * piège de la mesure satisfaite par des zéros, et la raison d'être de ce fichier : il **crée** la
 * donnée qui exerce le code.
 *
 * ## Le témoin négatif, qui est la moitié du test
 *
 * Asserter que l'extrait apparaît ne suffirait pas : interpoler la description brute le
 * satisferait aussi, puisque le texte s'y trouve. Le test exige donc en plus que les marqueurs
 * `**`, `##` et `:performing_arts:` soient **absents** de la carte — c'est-à-dire exactement les
 * trois symptômes que le constat nommait.
 */
const BASE = 'http://localhost:3000'

const NOM = `Appel E2E description ${Date.now()}`
const DESCRIPTION = '## Conditions\n\n**Scène ouverte** en juillet :performing_arts:'

test.describe.serial('Appels ouverts — description sans balisage', () => {
  test.describe.configure({ timeout: 120000 })

  let editionId: string
  let showCallId: string | null = null
  let statutInitial: string | null = null

  test('prépare un appel public avec une description en markdown', async ({ page }) => {
    editionId = String(loadState().editionId)
    await updateEdition(page, editionId, { artistsEnabled: true })

    /*
     * ⚠️ L'ÉDITION DOIT ÊTRE ANNONÇABLE, et c'est la CI qui l'a dit : la carte n'apparaissait
     * jamais. `/api/shows-call/open` borne son `where` sur l'INTERSECTION des statuts visibles
     * publiquement et de ceux qui accueillent des candidatures, soit `PUBLISHED` et `PLANNED`. Or
     * **toute édition naît `OFFLINE`** — celle du décor E2E comprise. L'appel existait bien, mais
     * la liste ne pouvait pas le rendre.
     *
     * Le statut d'origine est relevé puis restauré, comme le fait déjà `swaps-mobile.spec.ts` : la
     * base est partagée avec les lots qui tournent en parallèle, et la laisser publiée changerait
     * ce que voient leurs propres parcours.
     */
    statutInitial = await getEditionStatus(page, editionId)
    await setEditionStatus(page, editionId, 'PUBLISHED')

    const appel = await createShowCall(page, editionId, { name: NOM, description: DESCRIPTION })
    expect(appel.id).toBeTruthy()
    showCallId = String(appel.id)

    // Une échéance future : la page ne liste que les appels encore OUVERTS.
    const echeance = new Date()
    echeance.setDate(echeance.getDate() + 30)
    await updateShowCall(page, editionId, showCallId, {
      name: NOM,
      visibility: 'PUBLIC',
      mode: 'INTERNAL',
      deadline: echeance.toISOString(),
      requirePhone: false,
    })
  })

  /*
   * ⚠️ L'API AVANT LA PAGE, et c'est délibéré : si la liste ne rend pas l'appel, l'échec doit le
   * dire ICI plutôt que de se présenter comme un défaut d'affichage. C'est exactement la confusion
   * dans laquelle le premier passage de CI m'a laissé — « carte introuvable » là où la cause était
   * le statut de l'édition.
   */
  test('la liste des appels ouverts rend bien cet appel', async ({ page }) => {
    const reponse = await page.request.get(`${BASE}/api/shows-call/open`)
    expect(reponse.ok(), await reponse.text()).toBe(true)
    const corps = await reponse.json()
    const appels = corps?.showCalls ?? corps?.data?.showCalls ?? []
    const notre = appels.find((a: { name?: string }) => a.name === NOM)
    expect(
      notre,
      `appel absent de la liste — noms rendus : ${appels.map((a: { name?: string }) => a.name).join(', ')}`
    ).toBeTruthy()
    // La description part BRUTE de l'API : c'est la page qui la met en forme, et c'est ce que le
    // cas suivant mesure.
    expect(notre.description).toBe(DESCRIPTION)
  })

  test('affiche un extrait texte, et aucun marqueur markdown', async ({ page, goto }) => {
    await goto('/shows-call/open', { waitUntil: 'hydration' })

    /*
     * Le nom d'abord : il rend les assertions d'ABSENCE ci-dessous non vacuoues. Sans lui, une
     * page vide — ou qui n'aurait pas chargé — les satisferait toutes.
     */
    await expect(page.getByText(NOM)).toBeVisible({ timeout: 25000 })

    /*
     * L'extrait attendu : les blocs de premier niveau joints par ` · `, le gras retiré, le
     * raccourci d'emoji converti. Sans séparateur, « Conditions Scène ouverte… » se lirait comme
     * une phrase mal formée.
     */
    await expect(page.getByText('Conditions · Scène ouverte en juillet 🎭')).toBeVisible({
      timeout: 20000,
    })

    /*
     * ⚠️ LE TÉMOIN NÉGATIF. Interpoler la description brute contiendrait AUSSI « Scène ouverte » :
     * sans ces assertions, le test passerait au-dessus du défaut qu'il doit attraper. La portée
     * est la PAGE entière — c'est une liste d'appels, rien d'autre n'y porterait ces marqueurs.
     *
     * ⚠️⚠️ `innerText` ET SURTOUT PAS `textContent`, et c'est la CI qui l'a dit : `textContent`
     * d'un `<body>` inclut le texte des `<script>`, donc **la charge d'hydratation de Nuxt** — où
     * la description figure forcément à l'état BRUT, puisque c'est la page qui la met en forme.
     * Le test échouait donc sur `**` alors que l'écran, lui, était correct : il mesurait le
     * payload et non le rendu.
     *
     * `innerText` ne rend que le texte EFFECTIVEMENT AFFICHÉ. C'est la distinction déjà fichée
     * entre le HTML rendu et la charge d'hydratation, payée ici une fois de plus.
     */
    const texte = (await page.locator('body').innerText()) ?? ''
    expect(texte, 'le gras markdown ne doit pas être servi tel quel').not.toContain('**')
    expect(texte, 'le titre de niveau 2 ne doit pas être servi tel quel').not.toContain('##')
    expect(texte, "le raccourci d'emoji doit être converti").not.toContain(':performing_arts:')
    expect(texte, 'un computed asynchrone aurait rendu une promesse').not.toContain(
      '[object Promise]'
    )
  })

  test.afterAll(async ({ browser }) => {
    // Retiré par IDENTIFIANT : la base de développement est partagée, et viser par position y a
    // déjà détruit de vraies données.
    if (!showCallId) return
    const page = await browser.newPage()
    try {
      await deleteShowCall(page, editionId, showCallId)
      // Le statut est remis tel qu'il était : la base est partagée avec les lots voisins.
      if (statutInitial) {
        await setEditionStatus(page, editionId, statutInitial as 'OFFLINE').catch(() => {})
      }
    } finally {
      await page.close()
    }
  })
})
