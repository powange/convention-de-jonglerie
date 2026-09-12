import { describe, expect, it } from 'vitest'

import {
  editionVisiblePubliquement,
  filtreStatutEdition,
  STATUTS_VISIBLES_PUBLIQUEMENT,
  TOUS_LES_STATUTS_DEDITION,
  type StatutEdition,
} from '../../../server/utils/visibilite-edition'

/** Les quatre valeurs de l'enum Prisma `EditionStatus`, dans l'ordre où le schéma les déclare. */
const TOUS: StatutEdition[] = ['PLANNED', 'PUBLISHED', 'OFFLINE', 'CANCELLED']

describe('editionVisiblePubliquement', () => {
  it('cache les éditions hors ligne, et elles seules', () => {
    // « Hors ligne » veut dire « complète mais volontairement cachée » : c'est le seul statut que
    // ses organisateurs ont choisi de soustraire au public.
    expect(TOUS.filter(editionVisiblePubliquement)).toEqual(['PLANNED', 'PUBLISHED', 'CANCELLED'])
  })

  it('montre une édition annulée', () => {
    // Une annulation doit rester lisible par ceux qui avaient prévu de venir : la cacher les
    // laisserait devant une page introuvable, sans savoir pourquoi.
    expect(editionVisiblePubliquement('CANCELLED')).toBe(true)
  })

  it('refuse un statut inconnu plutôt que de le laisser passer', () => {
    // Mieux vaut cacher une édition qu'on aurait dû montrer que l'inverse : un enum qui bouge ne
    // doit pas rendre public ce que personne n'a décidé de publier.
    for (const valeur of ['DRAFT', 'published', '', null, undefined, 0, {}]) {
      expect(editionVisiblePubliquement(valeur)).toBe(false)
    }
  })
})

describe('filtreStatutEdition', () => {
  it('écarte les éditions cachées par défaut', () => {
    expect(filtreStatutEdition().in).not.toContain('OFFLINE')
    expect(filtreStatutEdition().in).toEqual([...STATUTS_VISIBLES_PUBLIQUEMENT])
  })

  it('les inclut quand l’appelant dit en avoir le droit', () => {
    expect(filtreStatutEdition(true).in).toEqual([...TOUS_LES_STATUTS_DEDITION])
    expect([...filtreStatutEdition(true).in].sort()).toEqual([...TOUS].sort())
  })

  it('rend un tableau neuf à chaque appel', () => {
    // Prisma reçoit ce tableau ; s'il était partagé, un appelant qui le trie ou y pousse une
    // valeur changerait ce que voient tous les autres.
    const premier = filtreStatutEdition()
    premier.in.push('OFFLINE')

    expect(filtreStatutEdition().in).not.toContain('OFFLINE')
    expect([...STATUTS_VISIBLES_PUBLIQUEMENT]).not.toContain('OFFLINE')
  })
})
