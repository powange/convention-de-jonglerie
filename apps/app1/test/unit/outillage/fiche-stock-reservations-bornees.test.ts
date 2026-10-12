import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * La fiche d'un objet de stock ne charge plus toutes ses réservations — constat E3.
 *
 * ## Le défaut
 *
 * Le point d'API du détail incluait `reservations` **sans `take` ni `where`**, alors que son
 * propre commentaire annonçait « ses réservations actives et futures ». Il n'en rend plus que la
 * première page, plus le total ; les suivantes viennent d'un point d'API dédié.
 *
 * 📍 **Mesuré avant d'y toucher : 0 réservation en base de développement.** Ce n'est donc pas la
 * correction d'une panne mais une échéance — et l'historique est **paginé** plutôt que borné aux
 * réservations à venir, parce que cet écran montre délibérément tout le passé. C'est la décision
 * prise le 12/10 entre trois branches : ne rien faire, paginer, ou borner.
 *
 * ## ⚠️⚠️ CE QUE CETTE GARDE N'EST PAS
 *
 * Une garde de **source**. Le découpage lui-même est l'affaire de la base, et le mock Prisma du
 * dépôt ignore `where`, `skip` et `take` : les cas montés du point d'API vérifient donc la FORME
 * de la requête, et ceux-ci vérifient que la fiche la BORNE et que l'écran sait paginer. Aucun des
 * deux ne prouve ce qui s'affiche.
 */
const RACINE = path.resolve(__dirname, '../../../../..')
const lire = (relatif: string) => fs.readFileSync(path.resolve(RACINE, relatif), 'utf8')

const DETAIL = 'layers/stock/server/api/editions/[id]/stock-items/[itemId]/index.get.ts'
const PAGE = 'layers/stock/app/pages/editions/[id]/gestion/stock/items/[itemId].vue'
const PARTAGE = 'layers/stock/server/utils/reservations-de-la-fiche.ts'
const API = 'layers/stock/server/api/editions/[id]/stock-items/[itemId]/reservations.get.ts'

/** Le code d'un fichier, commentaires retirés — ceux de HTML compris. */
const sansCommentaires = (relatif: string): string =>
  lire(relatif)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('stock — la fiche borne ses réservations', () => {
  it('le détail ne lit plus qu’une page', () => {
    // ⚠️ Le retrait des commentaires n'est pas décoratif : le fichier EXPLIQUE, en citant `take`,
    // qu'il n'en avait pas. Les compter accuserait celui qui a fait le travail.
    expect(sansCommentaires(DETAIL)).toContain('take: RESERVATIONS_PAR_PAGE')
  })

  it('le détail rend le total, sans ramener les lignes', () => {
    // 📍 Sans ce total, l'écran ne saurait pas qu'il existe une suite — et la pagination
    // n'apparaîtrait jamais, quel que soit le nombre de réservations.
    expect(sansCommentaires(DETAIL)).toContain('_count: { select: { reservations: true } }')
  })

  it('les deux points d’API EMPLOIENT la définition partagée', () => {
    /*
     * Deux définitions divergeraient, et la page 2 finirait par afficher autre chose que la
     * page 1 — ou, pire, par exposer un champ que celle-ci cachait.
     *
     * ⚠️⚠️ ON VÉRIFIE L'EMPLOI, PAS LA MENTION, et c'est un sabotage qui l'a imposé : remplacer
     * `include: reservationDeLaFicheSelect` par un objet écrit sur place laissait ce cas VERT,
     * l'`import` suffisant à satisfaire un `toContain` sur le nom. Le sabotage avait d'ailleurs
     * fait fuiter `email: true` dans le détail, sans qu'un seul cas ne bronche.
     */
    const partage = sansCommentaires(PARTAGE)
    expect(partage).toContain('export const reservationDeLaFicheSelect')
    expect(partage).toContain('export const RESERVATIONS_PAR_PAGE')
    for (const fichier of [DETAIL, API]) {
      expect(sansCommentaires(fichier), fichier).toContain('include: reservationDeLaFicheSelect')
    }
  })

  it('aucun des trois fichiers ne rend l’adresse e-mail', () => {
    /*
     * ⚠️ La fiche est ouverte à qui peut consulter le stock, responsables d'équipe bénévole
     * compris — lesquels n'ont pas à connaître l'adresse des autres participants.
     *
     * 📍 Les TROIS fichiers, et non le seul fichier partagé : c'est précisément en écrivant un
     * select sur place, dans le détail, qu'un sabotage a fait passer `email: true` — et le cas qui
     * ne regardait que la définition partagée ne l'a pas vu.
     */
    expect(sansCommentaires(PARTAGE)).toContain('emailHash: true')
    for (const fichier of [PARTAGE, DETAIL, API]) {
      expect(sansCommentaires(fichier), fichier).not.toMatch(/\bemail: true/)
    }
  })

  it('l’écran pagine, et sur le modèle que le composant attend', () => {
    /*
     * 📍 `page`, et NON `model-value` : le modèle de `UPagination` s'appelle `page` et émet
     * `update:page`. Un `:model-value` serait accepté sans erreur et IGNORÉ — la pagination
     * s'afficherait, resterait sur la page 1, et ne changerait rien. C'est le défaut le plus
     * discret de ce lot, et aucun test de rendu ne le dirait non plus.
     */
    const page = sansCommentaires(PAGE)
    expect(page).toContain(':page="pageDesReservations"')
    expect(page).toContain('@update:page="allerALaPageDesReservations"')
    expect(page).not.toContain('@update:model-value="allerALaPageDesReservations"')
  })

  it('l’écran affiche la page chargée, et non plus la liste du détail', () => {
    // La signature du défaut : `item.reservations` lu directement dans le gabarit, qui ne verrait
    // jamais les pages suivantes.
    const page = sansCommentaires(PAGE)
    expect(page).toContain('v-for="r in reservationsAffichees"')
    expect(page).not.toContain('v-for="r in item.reservations"')
  })

  it('le total de l’écran a un repli sur la première page', () => {
    // 📍 Sans ce repli, une réponse d'un serveur plus ancien — ou un bouchon de test incomplet —
    // ferait afficher « aucune réservation » sous une liste qui en montre vingt.
    expect(sansCommentaires(PAGE)).toContain('item.value?.reservations?.length ?? 0')
  })
})
