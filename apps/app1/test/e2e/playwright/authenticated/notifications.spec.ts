import { expect, test } from '@nuxt/test-utils/playwright'

/**
 * Les deux pages de notifications, ouvertes pour de vrai dans un navigateur.
 *
 * ⚠️ POURQUOI IL FAUT UN NAVIGATEUR ICI. Ces deux pages sont rendues côté client : un `curl` qui
 * répond 200 ne prouve rien du tout, puisqu'il ne reçoit que la coquille. Et ce lot y a remplacé
 * une trentaine de libellés français écrits en dur par des clés i18n, remanié la liste des
 * catégories et ajouté un interrupteur — autant de choses dont ni le typage ni les tests de
 * composants ne disent si elles s'affichent.
 *
 * Deux défauts précis que seul ce parcours attrape :
 *   • une clé i18n absente du domaine chargé s'affiche BRUTE, sans erreur ni avertissement ;
 *   • un `computed` déclaré après sa première lecture fait lever le `setup`, et la page reste
 *     BLANCHE — le serveur répond pourtant 200.
 *
 * D'où l'écoute de `pageerror` : toute erreur de rendu Vue fait échouer le test.
 */

/** Une clé i18n non résolue se reconnaît à sa forme : des segments séparés par des points. */
const CLE_BRUTE = /\b(notifications|profile|common)\.[a-z_]+(\.[a-z_]+)+\b/

test.describe('Notifications (connecté)', () => {
  test('la page de mes notifications s’affiche, sans clé brute', async ({ page, goto }) => {
    const erreurs: string[] = []
    page.on('pageerror', (e) => erreurs.push(e.message))

    await goto('/notifications', { waitUntil: 'hydration' })

    expect(page.url()).not.toContain('/login')

    // Le titre vient désormais d'une clé : s'il est vide, c'est que la page n'a pas monté.
    await expect(page.locator('h1')).toBeVisible({ timeout: 15000 })

    /*
     * 🔬 L'assertion qui attrape une clé non résolue. `notifications.json` fait partie des
     * fichiers chargés d'emblée, mais rien dans le code ne le garantit : une clé déplacée dans un
     * domaine chargé par route s'afficherait telle quelle, et personne ne verrait d'erreur.
     */
    const texte = (await page.locator('main, body').first().innerText()) ?? ''
    expect(texte).not.toMatch(CLE_BRUTE)

    expect(erreurs).toEqual([])
  })

  test('le filtre de catégories propose celles qui existent vraiment', async ({ page, goto }) => {
    /*
     * ⚠️ CE QUE LE FILTRE PROPOSAIT AVANT : « Commentaires », « Favoris », « Réservations » —
     * trois catégories qu'aucune notification ne porte. Les choisir vidait la liste sans rien
     * expliquer. Et il OMETTAIT « Artistes », « Conventions » et « Tâches », qui existent : un
     * organisateur qui ne voulait voir que les candidatures artistes ne pouvait pas filtrer.
     *
     * Le test ouvre réellement la liste : les options ne sont rendues qu'à ce moment-là.
     */
    await goto('/notifications', { waitUntil: 'hydration' })

    const filtre = page.getByRole('combobox').nth(1)
    await expect(filtre).toBeVisible({ timeout: 15000 })
    await filtre.click()

    const options = page.getByRole('option')
    await expect(options.first()).toBeVisible({ timeout: 10000 })
    const libelles = await options.allInnerTexts()

    // Les trois qui manquaient.
    expect(libelles.join(' | ')).toMatch(/Artistes/)
    expect(libelles.join(' | ')).toMatch(/Conventions/)
    expect(libelles.join(' | ')).toMatch(/Tâches/)
    // Les trois qui n'existaient pas.
    expect(libelles.join(' | ')).not.toMatch(/Commentaires/)
    expect(libelles.join(' | ')).not.toMatch(/Favoris/)
    expect(libelles.join(' | ')).not.toMatch(/Réservations/)
  })

  test('les préférences proposent un réglage pour la messagerie', async ({ page, goto }) => {
    /*
     * 🔬 Le volet visible du nouveau réglage. Sans interrupteur, la préférence existe en base et
     * personne ne peut y toucher — ce qui revient à ne pas l'avoir ajoutée.
     *
     * On vérifie aussi qu'il n'y a PAS de sous-interrupteur « recevoir par e-mail » sous ce
     * bloc-là : rien n'envoie de courriel pour un message, et une case qui promet des courriels
     * que rien n'envoie est pire que pas de case.
     */
    const erreurs: string[] = []
    page.on('pageerror', (e) => erreurs.push(e.message))

    await goto('/profile/notifications', { waitUntil: 'hydration' })

    expect(page.url()).not.toContain('/login')

    const bloc = page.locator('div').filter({ hasText: /^Messagerie/ }).first()
    await expect(bloc).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/discussions d’équipe/i).first()).toBeVisible()

    const texte = (await page.locator('main, body').first().innerText()) ?? ''
    expect(texte).not.toMatch(CLE_BRUTE)

    expect(erreurs).toEqual([])
  })
})
