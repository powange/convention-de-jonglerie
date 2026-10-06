import { describe, expect, it } from 'vitest'

import {
  regrouperLesSectionsParCommande,
  type SectionDeFiche,
} from '../../../../../layers/ticketing/app/utils/sections-de-la-fiche'

/**
 * Réunir les sections d'une fiche à plusieurs titres.
 *
 * ⚠️ POURQUOI CES TESTS. L'erreur que ce module corrige ne lève rien : elle AFFICHE la même
 * commande cinq fois. Tout compile, tout est vert, et c'est l'utilisateur qui s'en aperçoit en
 * faisant défiler la fiche. Une erreur de maille — la ligne confondue avec la commande — ne se
 * voit qu'à l'écran, ou ici.
 */

const billet = (ligne: number, commande: number): SectionDeFiche => ({
  type: 'ticket',
  commande,
  preselection: [ligne],
})

describe('les billets d’une même commande', () => {
  it('⚠️ LE CAS SIGNALÉ : cinq billets d’une commande donnent UNE section', () => {
    /*
     * Relevé sur une personne réelle : une commande de cinq billets, et une candidature de
     * bénévole. La fiche montrait la commande cinq fois, puisque chaque LIGNE ouvrait une section
     * affichant la commande ENTIÈRE.
     */
    const sections = regrouperLesSectionsParCommande([
      billet(1, 100),
      billet(2, 100),
      billet(3, 100),
      billet(4, 100),
      billet(5, 100),
      { type: 'volunteer', preselection: undefined },
    ])

    expect(sections).toHaveLength(2)
    expect(sections[0]!.type).toBe('ticket')
    expect(sections[1]!.type).toBe('volunteer')
  })

  it('et leurs cinq lignes forment la présélection de cette section', () => {
    // Sans quoi la section s'ouvrirait sur une commande dont AUCUNE ligne n'est cochée : il
    // faudrait les retrouver à la main dans une liste qui peut en compter dix.
    const sections = regrouperLesSectionsParCommande([
      billet(1, 100),
      billet(2, 100),
      billet(3, 100),
    ])

    expect(sections[0]!.preselection).toEqual([1, 2, 3])
  })

  it('deux commandes DIFFÉRENTES restent deux sections', () => {
    // Deux achats distincts de la même personne : deux commandes, deux acheteurs possibles, deux
    // statuts. Les réunir masquerait l'une des deux.
    const sections = regrouperLesSectionsParCommande([billet(1, 100), billet(2, 200)])

    expect(sections).toHaveLength(2)
  })

  it('ne compte pas deux fois une ligne qui arriverait en double', () => {
    const sections = regrouperLesSectionsParCommande([billet(7, 100), billet(7, 100)])

    expect(sections[0]!.preselection).toEqual([7])
  })
})

describe('ce qui ne se regroupe pas', () => {
  it('les bénévoles, artistes et organisateurs restent chacun leur section', () => {
    /*
     * Ce sont des objets entiers, pas des lignes d'un ensemble. Les réunir n'aurait aucun sens, et
     * il n'y a de toute façon rien pour les réunir : ils ne portent pas de commande.
     */
    const sections = regrouperLesSectionsParCommande([
      { type: 'volunteer' },
      { type: 'artist' },
      { type: 'organizer' },
    ])

    expect(sections).toHaveLength(3)
  })

  it('⚠️ deux sections SANS commande ne sont pas « la même commande »', () => {
    // Le piège de la clé absente : `undefined === undefined`. Les réunir ferait disparaître une
    // commande de la fiche, qu'on ne validerait jamais.
    const sections = regrouperLesSectionsParCommande([
      { type: 'ticket', preselection: [1] },
      { type: 'ticket', preselection: [2] },
    ])

    expect(sections).toHaveLength(2)
  })
})

describe('la forme rendue', () => {
  it('conserve l’ordre d’arrivée, la PREMIÈRE section de chaque commande faisant foi', () => {
    /*
     * Garder la dernière donnerait le même affichage, mais déplacerait la commande dans la fiche
     * selon l'ordre des résultats de recherche : l'écran changerait d'une recherche à l'autre
     * sans raison visible.
     */
    const sections = regrouperLesSectionsParCommande([
      { type: 'volunteer' },
      billet(1, 100),
      { type: 'organizer' },
      billet(2, 100),
    ])

    expect(sections.map((s) => s.type)).toEqual(['volunteer', 'ticket', 'organizer'])
  })

  it('retire `commande`, qui ne servait qu’au regroupement', () => {
    // Laissée en place, Vue la poserait en attribut inconnu sur l'élément racine du composant.
    const sections = regrouperLesSectionsParCommande([billet(1, 100)])

    expect(sections[0]).not.toHaveProperty('commande')
  })

  it('laisse passer le reste sans y toucher', () => {
    const sections = regrouperLesSectionsParCommande([
      { type: 'ticket', commande: 100, preselection: [1], isRefunded: true, participant: { a: 1 } },
    ])

    expect(sections[0]!.isRefunded).toBe(true)
    expect(sections[0]!.participant).toEqual({ a: 1 })
  })

  it('rend une liste vide sur une entrée vide', () => {
    expect(regrouperLesSectionsParCommande([])).toEqual([])
  })
})
