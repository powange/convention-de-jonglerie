import { describe, expect, it } from 'vitest'

import {
  avecCoequipiers,
  coequipiersSelect,
} from '../../../../../layers/volunteers/server/utils/coequipiers-creneau'

describe('coéquipiers d’un créneau', () => {
  describe('coequipiersSelect', () => {
    it('exclut l’intéressé de sa propre liste', () => {
      // Se voir soi-même parmi « les autres » n'apprend rien et fausse le décompte affiché.
      expect(coequipiersSelect(42).where).toEqual({ userId: { not: 42 } })
    })

    it('trie par pseudo, pour que la liste ne change pas d’ordre d’un chargement à l’autre', () => {
      expect(coequipiersSelect(42).orderBy).toEqual({ user: { pseudo: 'asc' } })
    })
  })

  describe('avecCoequipiers', () => {
    it('remplace la table de liaison par les bénévoles eux-mêmes', () => {
      const creneau = {
        id: 'c1',
        title: 'Accueil',
        assignments: [{ user: { id: 1, pseudo: 'Alice' } }, { user: { id: 2, pseudo: 'Bob' } }],
      }

      const rendu = avecCoequipiers(creneau)

      expect(rendu).toEqual({
        id: 'c1',
        title: 'Accueil',
        coVolunteers: [
          { id: 1, pseudo: 'Alice' },
          { id: 2, pseudo: 'Bob' },
        ],
      })
      // `assignments` laissé tel quel laisserait croire que l'intéressé y figure.
      expect('assignments' in rendu).toBe(false)
    })

    it('rend une liste vide pour un créneau tenu seul', () => {
      expect(avecCoequipiers({ id: 'c1', assignments: [] }).coVolunteers).toEqual([])
    })
  })
})
