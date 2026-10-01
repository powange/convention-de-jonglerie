import { expect, test } from '@nuxt/test-utils/playwright'

import {
  createShowCall,
  deleteShowCall,
  loadState,
  updateEdition,
  updateShowCall,
} from '../helpers'

/**
 * La date limite d'un appel à spectacles se lit dans le fuseau de la CONVENTION, pas dans celui de
 * l'organisateur.
 *
 * ⚠️ CE QUI N'ALLAIT PAS. Le formulaire remplissait le champ avec `formatDateTimeLocal(new
 * Date(...))` et le renvoyait avec `new Date(saisie).toISOString()` : les deux conversions
 * prenaient le fuseau de la MACHINE. « 30 juin 23 h 59 » ne désignait donc pas le même instant
 * selon qui ouvrait la page, et l'organisateur en déplacement voyait une autre échéance que son
 * collègue resté sur place. Le formulaire des spectacles, lui, ancre déjà ses horaires sur
 * `edition.timezone` : c'est la même règle, et elle manquait ici.
 *
 * ⚠️⚠️ POURQUOI UNE SPÉCIFICATION DE BOUT EN BOUT, et pas un test unitaire. `versInstant` et
 * `versChampLocal` sont déjà éprouvés (27 cas dans `test/unit/utils/fuseau-edition.test.ts`) : ce
 * qui n'était couvert par RIEN, c'est leur BRANCHEMENT dans la page — et un fuseau ne se prouve
 * pas sans un navigateur qui en annonce un autre. `timezoneId` le fournit, et c'est le seul
 * endroit du dépôt où cette distinction est observable.
 *
 * 📍 L'écart choisi est volontairement grossier : Paris en juin est à UTC+2, Auckland à UTC+12. Un
 * décalage de dix heures fait CHANGER LE JOUR, ce qui rend l'assertion lisible sur le seul
 * libellé du bouton de date — sans avoir à piloter les segments du champ d'heure, dont la
 * structure interne appartient à la bibliothèque.
 */

/** 30 juin 2026, 23 h 59 à Paris (UTC+2 en juin) — soit le 1er juillet 09 h 59 à Auckland. */
const ECHEANCE_PARIS = '2026-06-30T21:59:00.000Z'

test.use({ timezoneId: 'Pacific/Auckland' })

test.describe.serial('Date limite d’un appel à spectacles et fuseau de la convention', () => {
  let showCallId: string
  let fuseauDOrigine: string | null = null

  test('poser un fuseau à la convention et une échéance connue', async ({ page }) => {
    const { editionId } = loadState()

    /*
     * ⚠️ L'ÉDITION DE TEST NAÎT SANS FUSEAU — `data.setup.ts` ne l'envoie pas, et le champ est
     * facultatif. Or sans fuseau déclaré, `versChampLocal` retombe DÉLIBÉRÉMENT sur la machine :
     * la spécification serait alors vacuement verte, avant comme après le correctif. Le poser est
     * la condition pour que ce test prouve quoi que ce soit.
     */
    const avant = await page.request.get(`http://localhost:3000/api/editions/${editionId}`)
    fuseauDOrigine = (await avant.json())?.timezone ?? null

    await updateEdition(page, editionId, { timezone: 'Europe/Paris' })

    const showCall = await createShowCall(page, editionId, {
      name: 'E2E Fuseau appel à spectacles',
    })
    showCallId = String(showCall.id)

    await updateShowCall(page, editionId, showCallId, {
      name: 'E2E Fuseau appel à spectacles',
      visibility: 'OFFLINE',
      mode: 'INTERNAL',
      deadline: ECHEANCE_PARIS,
    })
  })

  test('🔬 la page de gestion affiche le JOUR de la convention, pas celui du navigateur', async ({
    page,
    goto,
  }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/shows-call/${showCallId}`, {
      waitUntil: 'hydration',
    })

    /*
     * L'assertion qui porte le point. Le navigateur est à Auckland, où cet instant tombe le
     * 1er juillet : avant le correctif, le bouton de date affichait « 01/07/2026 ». Il doit
     * afficher le 30 juin, jour vécu sur place.
     */
    const champDate = page.getByRole('button', { name: /30\/06\/2026|30 juin/i })
    await expect(champDate).toBeVisible({ timeout: 15000 })

    // Et le 1er juillet ne doit apparaître nulle part : une assertion positive seule resterait
    // verte si la page affichait les deux.
    await expect(page.getByText(/01\/07\/2026/)).toHaveCount(0)
  })

  test('annonce le fuseau employé à côté du champ', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/shows-call/${showCallId}`, {
      waitUntil: 'hydration',
    })

    // Sans cette mention, l'organisateur n'a aucun moyen de savoir dans quel fuseau il saisit —
    // et c'est l'ambiguïté qui a produit le défaut, pas seulement la conversion.
    await expect(page.getByText(/Europe\/Paris/)).toBeVisible({ timeout: 15000 })
  })

  test('enregistrer un AUTRE champ ne déplace pas l’échéance', async ({ page, goto }) => {
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/shows-call/${showCallId}`, {
      waitUntil: 'hydration',
    })

    /*
     * 📍 IL FAUT MODIFIER QUELQUE CHOSE : le bouton d'enregistrement n'existe que sous
     * `v-if="hasChanges"`. Une première version de ce test cliquait sans rien toucher et attendait
     * cent vingt secondes un bouton qui ne pouvait pas paraître. C'est au passage une bonne
     * propriété de la page — on n'enregistre pas par accident — et elle dicte la forme du test.
     *
     * On change donc le NOM, et l'on vérifie que la date limite, elle, ne bouge pas : chaque
     * enregistrement renvoie l'intégralité du formulaire, échéance comprise.
     */
    const champNom = page.locator('input[type="text"]').first()
    await expect(champNom).toBeVisible({ timeout: 15000 })
    await champNom.fill('E2E Fuseau appel renomme')

    await page
      .getByRole('button', { name: /enregistrer/i })
      .first()
      .click()
    await page.waitForTimeout(2000)

    const reponse = await page.request.get(
      `http://localhost:3000/api/editions/${editionId}/shows-call/${showCallId}`
    )
    const appel = await reponse.json()

    /*
     * 📍 CE TEST N'EST PAS CELUI QUI DISCRIMINE, et autant l'écrire : l'ancien code lisait et
     * écrivait dans le MÊME fuseau (celui de la machine), si bien que l'aller-retour était déjà
     * stable. Il garde l'autre risque, celui qu'introduit le correctif : une lecture ancrée sur la
     * convention suivie d'une écriture ancrée ailleurs décalerait l'échéance à chaque
     * enregistrement, sans que personne n'ait touché à la date.
     */
    expect(appel.name).toBe('E2E Fuseau appel renomme')
    expect(new Date(appel.deadline).toISOString()).toBe(ECHEANCE_PARIS)
  })

  /**
   * Nettoyage en `afterAll` et non en dernier `test()` : dans un `describe.serial`, un échec en
   * cours de route saute les tests suivants, donc le nettoyage — et le fuseau posé ici resterait
   * sur l'ÉDITION PARTAGÉE, où il décalerait l'affichage des horaires de toutes les autres
   * spécifications. Le motif est celui de `swaps-mobile.spec.ts`, pour la même raison.
   *
   * Le contexte est rouvert avec la session de l'organisateur : `browser.newPage()` nu n'en a
   * aucune, et les deux appels répondraient 401 sans qu'on le voie.
   */
  test.afterAll(async ({ browser }) => {
    const { editionId } = loadState()
    const context = await browser.newContext({
      storageState: new URL('../../../../test-results/.auth/user.json', import.meta.url).pathname,
    })
    const page = await context.newPage()
    try {
      if (showCallId) await deleteShowCall(page, editionId, showCallId)
      await updateEdition(page, editionId, { timezone: fuseauDOrigine })
    } finally {
      await context.close()
    }
  })
})
