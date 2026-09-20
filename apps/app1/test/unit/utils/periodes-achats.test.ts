import { describe, expect, it } from 'vitest'

import {
  PERIODES_DACHAT,
  indicesDansLesPeriodes,
  periodeDunInstant,
  serieSurIndices,
} from '../../../../../layers/ticketing/app/utils/periodes-achats'

/**
 * Le découpage des achats de billets en trois périodes.
 *
 * Ce que ces tests protègent est un chiffre qu'on lit pour décider d'une campagne : « combien de
 * billets se sont vendus sur place ? ». Deux erreurs coûtent, et aucune ne se voit à l'écran —
 * borner « avant » à la fenêtre de montage, ce qui amputerait le décompte de tout ce qui s'est
 * vendu les mois précédents ; et désynchroniser les séries parallèles, ce qui attribuerait des
 * ventes à la mauvaise tranche.
 */

const BORNES = { debut: '2026-05-15T00:00:00Z', fin: '2026-05-18T00:00:00Z' }

describe('periodeDunInstant', () => {
  it('situe une vente des mois précédents dans « avant »', () => {
    // Le cas que la version bornée au montage perdait : la billetterie ouvre en janvier.
    expect(periodeDunInstant('2026-01-10T12:00:00Z', BORNES)).toBe('avant')
  })

  it('range le montage dans « avant », puisqu’il précède l’événement', () => {
    expect(periodeDunInstant('2026-05-14T08:00:00Z', BORNES)).toBe('avant')
  })

  it('compte le premier instant de l’édition comme « pendant »', () => {
    // La borne de début appartient à l'édition : une vente à l'ouverture des portes s'est bien
    // faite sur place.
    expect(periodeDunInstant('2026-05-15T00:00:00Z', BORNES)).toBe('pendant')
  })

  it('bascule dans « après » au dernier instant, pas une tranche plus tard', () => {
    // La frontière où ce genre de découpage se trompe d'une tranche. La borne de fin est aussi le
    // début du démontage : elle appartient à l'après.
    expect(periodeDunInstant('2026-05-17T23:59:59Z', BORNES)).toBe('pendant')
    expect(periodeDunInstant('2026-05-18T00:00:00Z', BORNES)).toBe('apres')
  })

  it('range le démontage et la suite dans « après »', () => {
    expect(periodeDunInstant('2026-05-19T10:00:00Z', BORNES)).toBe('apres')
    expect(periodeDunInstant('2026-09-01T10:00:00Z', BORNES)).toBe('apres')
  })

  it('range tout instant dans une période, et une seule', () => {
    // L'invariant qui fait tenir le total : aucune vente ne doit disparaître du découpage ni y
    // être comptée deux fois.
    for (let jours = -200; jours <= 200; jours++) {
      const quand = new Date(Date.parse(BORNES.debut) + jours * 24 * 3600 * 1000)
      const periode = periodeDunInstant(quand, BORNES)
      expect(PERIODES_DACHAT).toContain(periode)
    }
  })

  it('rend null plutôt qu’une période inventée', () => {
    expect(periodeDunInstant(null, BORNES)).toBeNull()
    expect(periodeDunInstant('pas une date', BORNES)).toBeNull()
    expect(periodeDunInstant('2026-05-15', { debut: null, fin: BORNES.fin })).toBeNull()
    expect(periodeDunInstant('2026-05-15', { debut: BORNES.debut, fin: '' })).toBeNull()
  })
})

describe('indicesDansLesPeriodes', () => {
  const TRANCHES = [
    '2026-01-10T00:00:00Z', // 0 — avant
    '2026-05-14T00:00:00Z', // 1 — avant (montage)
    '2026-05-16T00:00:00Z', // 2 — pendant
    '2026-05-19T00:00:00Z', // 3 — après (démontage)
  ]

  it('ne garde que les périodes demandées', () => {
    expect(indicesDansLesPeriodes(TRANCHES, BORNES, ['pendant'])).toEqual([2])
    expect(indicesDansLesPeriodes(TRANCHES, BORNES, ['avant'])).toEqual([0, 1])
    expect(indicesDansLesPeriodes(TRANCHES, BORNES, ['apres'])).toEqual([3])
  })

  it('cumule plusieurs périodes sans les réordonner', () => {
    expect(indicesDansLesPeriodes(TRANCHES, BORNES, ['apres', 'avant'])).toEqual([0, 1, 3])
  })

  it('garde tout quand les trois sont demandées', () => {
    expect(indicesDansLesPeriodes(TRANCHES, BORNES, PERIODES_DACHAT)).toEqual([0, 1, 2, 3])
  })

  it('ne garde rien quand la sélection est vide', () => {
    // Décocher toutes les périodes est un choix de l'utilisateur, pas une donnée manquante.
    expect(indicesDansLesPeriodes(TRANCHES, BORNES, [])).toEqual([])
  })

  it('garde TOUT quand les bornes de l’édition sont illisibles', () => {
    // Un graphique complet assorti d'un filtre sans effet se remarque ; un graphique vide, lui,
    // se lit comme « aucune vente » — un chiffre faux que rien ne signale.
    expect(indicesDansLesPeriodes(TRANCHES, { debut: null, fin: null }, ['pendant'])).toEqual([
      0, 1, 2, 3,
    ])
  })

  it('ignore une période inconnue au lieu de tout garder', () => {
    expect(indicesDansLesPeriodes(TRANCHES, BORNES, ['n’importe quoi'])).toEqual([])
  })
})

describe('serieSurIndices', () => {
  it('découpe une série dans l’ordre des rangs', () => {
    expect(serieSurIndices([0, 2], [10, 20, 30])).toEqual([10, 30])
  })

  it('découpe plusieurs séries EXACTEMENT de la même façon', () => {
    // Le point de passer par des index : quatre séries parallèles découpées séparément se
    // désynchroniseraient à la première divergence, et les ventes changeraient de tranche.
    const indices = [1, 3]
    expect(serieSurIndices(indices, [1, 2, 3, 4])).toEqual([2, 4])
    expect(serieSurIndices(indices, [10, 20, 30, 40])).toEqual([20, 40])
  })

  it('ignore un rang hors de la série plutôt que d’y glisser un trou', () => {
    expect(serieSurIndices([0, 9], [5, 6])).toEqual([5])
  })
})
