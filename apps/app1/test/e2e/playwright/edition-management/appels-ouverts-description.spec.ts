import { expect, test } from '@nuxt/test-utils/playwright'

import {
  createShowCall,
  deleteShowCall,
  loadState,
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
const NOM = `Appel E2E description ${Date.now()}`
const DESCRIPTION = '## Conditions\n\n**Scène ouverte** en juillet :performing_arts:'

test.describe.serial('Appels ouverts — description sans balisage', () => {
  test.describe.configure({ timeout: 120000 })

  let editionId: string
  let showCallId: string | null = null

  test('prépare un appel public avec une description en markdown', async ({ page }) => {
    editionId = String(loadState().editionId)
    await updateEdition(page, editionId, { artistsEnabled: true })

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

  test('affiche un extrait texte, et aucun marqueur markdown', async ({ page, goto }) => {
    await goto('/shows-call/open', { waitUntil: 'hydration' })

    const carte = page.locator('div', { hasText: NOM }).last()
    await expect(carte).toBeVisible({ timeout: 25000 })

    /*
     * L'extrait attendu : les blocs de premier niveau joints par ` · `, le gras retiré, le
     * raccourci d'emoji converti. Sans séparateur, « Conditions Scène ouverte… » se lirait comme
     * une phrase mal formée.
     */
    await expect(carte).toContainText('Conditions · Scène ouverte en juillet 🎭', {
      timeout: 20000,
    })

    /*
     * ⚠️ LE TÉMOIN NÉGATIF. Interpoler la description brute contiendrait AUSSI « Scène ouverte » :
     * sans ces trois assertions, le test passerait au-dessus du défaut qu'il doit attraper.
     */
    const texte = (await carte.textContent()) ?? ''
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
    } finally {
      await page.close()
    }
  })
})
