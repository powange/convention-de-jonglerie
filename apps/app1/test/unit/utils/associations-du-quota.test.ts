import { describe, it, expect } from 'vitest'

import {
  associationsDuQuota,
  FAMILLES_DU_QUOTA,
} from '../../../../../layers/ticketing/app/utils/associations-du-quota'

/**
 * Ce qu'une suppression de quota emporte — constat F3.
 *
 * ## Le défaut
 *
 * Six tables de liaison portent `onDelete: Cascade` vers `TicketingQuota` : tarifs, options,
 * champs personnalisés, organisateurs, équipes de bénévoles, spectacles. Supprimer un quota posé
 * sur douze cibles les effaçait **toutes**, et la confirmation ne nommait que le quota —
 * **six cascades, zéro mot** — pour une action **irréversible**.
 *
 * ## ⚠️ LES DEUX DÉFAUTS QUE CES CAS COUVRENT, et aucun ne se voit à la relecture
 *
 * **Annoncer une famille à zéro** (« 0 tarif ») est du bruit, et du bruit dans une confirmation de
 * suppression fait douter du reste du message. **Oublier une famille peuplée** est pire : on
 * efface ce qu'on n'avait pas vu, sans retour possible.
 */
const vide = {
  tiers: 0,
  options: 0,
  customFields: 0,
  organizers: 0,
  volunteers: 0,
  artists: 0,
}

describe('associationsDuQuota', () => {
  it('rend un total NUL quand le quota n’est posé sur rien', () => {
    // Le cas le plus courant juste après la création : l'appelant garde alors le libellé simple.
    expect(associationsDuQuota(vide)).toEqual({ total: 0, familles: [] })
  })

  it('⚠️ N’ANNONCE PAS UNE FAMILLE À ZÉRO', () => {
    const { familles } = associationsDuQuota({ ...vide, tiers: 2 })

    expect(familles).toEqual([{ cle: 'delete_links_tiers', nombre: 2 }])
  })

  it('⚠️ COMPTE LES SIX FAMILLES — aucune n’est oubliée', () => {
    /*
     * L'ASSERTION QUI PORTE LE LOT. Oublier une famille efface en silence ce que la personne
     * n'avait pas vu. Les six valeurs sont DISTINCTES : avec le même nombre partout, une famille
     * lue deux fois ou lue à la place d'une autre serait indiscernable.
     */
    const { total, familles } = associationsDuQuota({
      tiers: 1,
      options: 2,
      customFields: 3,
      organizers: 4,
      volunteers: 5,
      artists: 6,
    })

    expect(total).toBe(21)
    expect(familles.map((f) => f.nombre)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('⚠️ SUIT L’ORDRE DE LECTURE, du plus structurant au plus particulier', () => {
    // Le tarif décide qui peut acheter ; un spectacle ne concerne qu'un numéro. Quelqu'un qui
    // s'arrête à la première ligne doit avoir lu la plus lourde.
    const { familles } = associationsDuQuota({
      tiers: 1,
      options: 1,
      customFields: 1,
      organizers: 1,
      volunteers: 1,
      artists: 1,
    })

    expect(familles.map((f) => f.cle)).toEqual([
      'delete_links_tiers',
      'delete_links_options',
      'delete_links_custom_fields',
      'delete_links_organizers',
      'delete_links_volunteers',
      'delete_links_artists',
    ])
  })

  it('tolère un `_count` absent — la liste peut venir d’un point d’API plus ancien', () => {
    /*
     * Un client ouvert sur une version antérieure de la réponse ne porte pas `_count`. Lire
     * `undefined` comme « rien à annoncer » est le défaut honnête : on retombe sur le libellé
     * simple, au lieu d'afficher « NaN association(s) ».
     */
    expect(associationsDuQuota(undefined)).toEqual({ total: 0, familles: [] })
    expect(associationsDuQuota(null)).toEqual({ total: 0, familles: [] })
    expect(associationsDuQuota({})).toEqual({ total: 0, familles: [] })
  })

  it('⚠️ LES SIX FAMILLES DU CODE SONT CELLES DU SCHÉMA', () => {
    /*
     * LA GARDE DE LA LISTE. Une septième table de liaison ajoutée au schéma avec
     * `onDelete: Cascade` ne serait pas annoncée, et la confirmation sous-estimerait ce qu'elle
     * efface. Ce cas ne peut pas lire le schéma — il fige le nombre, pour que l'écart se discute.
     */
    expect(FAMILLES_DU_QUOTA).toHaveLength(6)
    expect(new Set(FAMILLES_DU_QUOTA.map((f) => f.champ)).size).toBe(6)
  })
})
