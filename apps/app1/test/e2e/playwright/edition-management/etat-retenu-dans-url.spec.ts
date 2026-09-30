import { expect, test } from '@nuxt/test-utils/playwright'

import { loadState } from '../helpers'

/**
 * Ce qu'on a réglé survit à un rechargement, et tient dans un lien.
 *
 * ⚠️ POURQUOI UN NAVIGATEUR, ET PAS SEULEMENT DES TESTS UNITAIRES. Les fonctions de lecture et
 * d'écriture de l'URL sont éprouvées à part, et c'est là que vit la règle. Mais elles ne disent
 * rien de la seule chose qui compte pour l'utilisateur : que le RÉGLAGE revienne. Entre les deux
 * il y a un `watch`, un `router.replace`, et l'ordre dans lequel l'écran se monte — trois choses
 * qu'aucun test unitaire ne traverse.
 *
 * Deux défauts que seul ce parcours attrape :
 *   • l'écran écrit bien le paramètre mais ne le RELIT pas au montage (ou le relit avant que la
 *     donnée dont il dépend soit arrivée) : l'adresse est juste, l'écran repart de zéro ;
 *   • le `watch` part au montage avec la valeur d'arrivée et EFFACE le paramètre du lien qu'on
 *     vient d'ouvrir — c'est exactement ce que la garde « ne naviguer que si l'adresse change »
 *     empêche, et rien d'autre ne le vérifierait.
 */

test.describe.serial("L'état réglé est retenu dans l'adresse", () => {
  test('la billetterie externe garde l’onglet porté par l’adresse', async ({ page, goto }) => {
    /*
     * Cet écran était le SEUL des cinquante-sept écrans de gestion à perdre un onglet au
     * rechargement (mesuré le 1er octobre 2026).
     *
     * 📍 CE QUE CE TEST NE VÉRIFIE PAS, ET POURQUOI. Il ne vérifie pas QUEL onglet est
     * sélectionné : ces onglets vivent dans une MODALE PLEIN ÉCRAN et n'existent qu'une fois les
     * tarifs ou les commandes chargés depuis le prestataire. Sur l'édition de test, rien n'est
     * synchronisé — ni `role="tab"`, ni libellé d'onglet à l'écran. Une première version de ce
     * test cherchait « Tarifs disponibles » et échouait pour cette raison, pas pour un défaut.
     *
     * 🔬 CE QU'IL VÉRIFIE, et c'est là qu'est le risque de régression : que le paramètre SURVIVE
     * au montage. Un `watch` qui part avec la valeur d'arrivée effacerait l'onglet du lien qu'on
     * vient d'ouvrir — c'est ce que la garde « ne naviguer que si l'adresse change » empêche, et
     * rien d'autre ne le vérifierait.
     */
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/ticketing/external?onglet=participants`, {
      waitUntil: 'hydration',
    })

    // L'écran s'affiche : ni page blanche, ni erreur d'hydratation sur un paramètre inattendu.
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })

    await expect
      .poll(() => new URL(page.url()).searchParams.get('onglet'), { timeout: 10000 })
      .toBe('participants')
  })

  test('un onglet inconnu dans l’adresse n’empêche pas l’écran de s’afficher', async ({
    page,
    goto,
  }) => {
    /*
     * ⚠️ L'écran affiche le panneau dont la valeur correspond à l'onglet actif. Transmettre un nom
     * inconnu — une adresse bricolée, ou celle d'une version où un onglet s'appelait autrement —
     * ouvrirait un écran où aucun panneau ne s'affiche. La lecture se replie donc sur l'onglet
     * d'arrivée, ce qu'un test unitaire vérifie en détail ; ici on vérifie que l'écran tient.
     *
     * 📍 Le paramètre fautif RESTE dans l'adresse, et c'est le bon compromis : le nettoyer
     * imposerait une navigation AU MONTAGE, ce que ce dépôt évite délibérément —
     * `useColonnesDansUrl` porte le souvenir d'une navigation parasite à chaque ouverture de
     * tableau, qui tombait en pleine hydratation et faisait échouer des tests de bout en bout.
     * Il est donc inerte plutôt qu'effacé, et le prochain changement d'onglet le remplace.
     */
    const { editionId } = loadState()

    await goto(`/editions/${editionId}/gestion/ticketing/external?onglet=nexiste-pas`, {
      waitUntil: 'hydration',
    })

    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
    expect(new URL(page.url()).searchParams.get('onglet')).toBe('nexiste-pas')
  })

  test('les candidatures reviennent sur le classement qu’on avait choisi', async ({
    page,
    goto,
  }) => {
    /*
     * ⚠️ PLUS QU'UNE COMMODITÉ SUR CET ÉCRAN-LÀ : la liste est paginée PAR LE SERVEUR. Reclasser
     * par nom puis recharger ne remettait pas seulement l'ordre d'avant — cela changeait QUELLES
     * candidatures s'affichent sur la page courante. On croyait revenir à ce qu'on regardait, et
     * l'on regardait autre chose.
     *
     * Le tri était le seul réglage de cet écran à ne pas survivre : statut, provenance, équipes,
     * présence, recherche, page et colonnes masquées y étaient déjà.
     *
     * ⚠️⚠️ CE TEST A DÛ ÊTRE RÉÉCRIT, ET C'EST LA LEÇON. Sa première version se contentait de
     * vérifier que `?tri=nom` FIGURE ENCORE dans l'adresse après le montage. Elle était
     * CREUSE : rien n'écrit l'URL au montage, donc le paramètre y survit même si personne ne le
     * lit. Le sabotage — remettre le tri en dur à sa valeur d'arrivée — la laissait au VERT.
     *
     * 🔬 On mesure donc la REQUÊTE réellement envoyée au serveur : c'est elle qui décide de l'ordre
     * ET du contenu de la page. Le même sabotage la fait tomber, puisque la requête repart alors
     * sur `createdAt`/`desc`.
     */
    const { editionId } = loadState()

    // L'attente est posée AVANT la navigation : la requête part au montage du tableau.
    const requete = page.waitForRequest(
      (req) =>
        req.url().includes(`/api/editions/${editionId}/volunteers/applications`) &&
        req.url().includes('sortField='),
      { timeout: 20000 }
    )

    await goto(`/editions/${editionId}/gestion/volunteers/applications?tri=nom`, {
      waitUntil: 'hydration',
    })

    const parametres = new URL((await requete).url()).searchParams
    expect(parametres.get('sortField')).toBe('nom')
    expect(parametres.get('sortDir')).toBe('asc')

    // Et l'adresse garde le classement, pour que le lien reste exact. Le socle partagé l'écrit en
    // une clé signée : `nom` croissant, `-nom` décroissant.
    await expect
      .poll(() => new URL(page.url()).searchParams.get('tri'), { timeout: 15000 })
      .toBe('nom')
  })
})
