import { describe, expect, it, vi } from 'vitest'

import {
  PILE_COMPAREE,
  PILE_COURANTE,
  basculerLesDeuxEditions,
  jeuCompare,
  jeuCourant,
  motifRaye,
  sansLesJumelles,
  type SerieDeGraphique,
} from '../../../../../layers/ticketing/app/utils/motifs-graphiques'

/**
 * La mise en vis-à-vis de deux éditions dans un même graphique.
 *
 * Ce que ces tests protègent est une lecture qui décide d'achats. Trois erreurs coûtent ici, et
 * toutes trois sont muettes : apparier les séries par POSITION plutôt que par nom, ce qui
 * comparerait les bénévoles d'une année aux artistes de l'autre ; empiler les deux éditions dans
 * la même colonne, ce qui afficherait leur somme comme si c'était un total ; et masquer une
 * catégorie d'un seul côté, ce qui laisserait à l'écran une comparaison qui n'en est plus une.
 */

const SERIE: SerieDeGraphique = {
  cle: 'volunteers',
  label: 'Bénévoles',
  fond: 'rgba(16, 185, 129, 0.8)',
  bordure: 'rgba(16, 185, 129, 1)',
  valeurs: [3, 5],
}

const COMPARAISON = {
  libelle: '2025',
  // `participants` en PREMIER, et c'est délibéré : la série attendue n'est pas celle qu'un
  // appariement positionnel prendrait. Sans cet ordre, le test passerait par accident.
  series: { participants: [100, 200], volunteers: [7, 9] },
}

describe('jeuCourant et jeuCompare', () => {
  it('posent les deux éditions dans des piles DIFFÉRENTES', () => {
    // L'invariant qui fait tenir la lecture : deux piles nommées se dessinent côte à côte. Une
    // seule pile empilerait l'an dernier par-dessus cette année, et la hauteur de la colonne se
    // lirait comme un total — un chiffre faux, deux fois trop grand, et parfaitement plausible.
    expect(jeuCourant(SERIE).stack).toBe(PILE_COURANTE)
    expect(jeuCompare(SERIE, COMPARAISON).stack).toBe(PILE_COMPAREE)
    expect(PILE_COURANTE).not.toBe(PILE_COMPAREE)
  })

  it('apparient les séries par NOM, jamais par position', () => {
    // `participants` vient avant `volunteers` dans l'objet comparé : un appariement positionnel
    // mettrait les participants de 2025 en face des bénévoles de 2026.
    expect(jeuCompare(SERIE, COMPARAISON).data).toEqual([7, 9])
  })

  it('gardent la même couleur des deux côtés', () => {
    // C'est toute la règle : la couleur dit la CATÉGORIE, la texture dit l'ÉDITION. Changer la
    // couleur de l'édition comparée obligerait à lire une légende pour rapprocher deux barres.
    const compare = jeuCompare(SERIE, COMPARAISON)
    expect(compare.borderColor).toBe(SERIE.bordure)
    // Sans `canvas`, le motif retombe sur la couleur pleine plutôt que d'échouer.
    expect(compare.backgroundColor).toBeDefined()
  })

  it('rendent une série VIDE quand l’édition comparée ne porte pas la catégorie', () => {
    // Une catégorie apparue cette année n'a pas d'équivalent l'an dernier. Mieux vaut une barre
    // absente qu'une barre empruntée à une autre série.
    const inedite: SerieDeGraphique = { ...SERIE, cle: 'artists' }
    expect(jeuCompare(inedite, COMPARAISON).data).toEqual([])
  })

  it('portent la même clé, qui apparie les jumelles', () => {
    expect(jeuCourant(SERIE).cle).toBe(jeuCompare(SERIE, COMPARAISON).cle)
  })

  it('nomment l’édition dans le libellé de la jumelle', () => {
    // Le seul endroit où l'infobulle peut lever l'ambiguïté entre les deux barres survolées.
    expect(jeuCompare(SERIE, COMPARAISON).label).toContain('2025')
    expect(jeuCompare(SERIE, COMPARAISON).label).toContain('Bénévoles')
    expect(jeuCourant(SERIE).label).toBe('Bénévoles')
  })

  it('marquent la jumelle, et elle seule', () => {
    expect(jeuCompare(SERIE, COMPARAISON).comparaison).toBe(true)
    expect(jeuCourant(SERIE)).not.toHaveProperty('comparaison')
  })
})

describe('motifRaye', () => {
  it('retombe sur la couleur pleine hors du navigateur', () => {
    // Le rendu serveur n'a pas de `canvas`. Un graphique sans hachures reste un graphique ;
    // une exception au rendu, elle, emporterait la page entière.
    expect(typeof motifRaye('rgba(1, 2, 3, 0.5)')).toBe('string')
  })
})

describe('sansLesJumelles', () => {
  const donnees = { datasets: [{ cle: 'a' }, { cle: 'a', comparaison: true }] }

  it('garde l’édition en cours', () => {
    expect(sansLesJumelles({ datasetIndex: 0 } as LegendeFactice, donnees)).toBe(true)
  })

  it('écarte la jumelle', () => {
    // Doubler la légende n'apprendrait rien : mêmes couleurs, mêmes catégories.
    expect(sansLesJumelles({ datasetIndex: 1 } as LegendeFactice, donnees)).toBe(false)
  })

  it('ne plante pas sur un index absent', () => {
    expect(sansLesJumelles({} as LegendeFactice, donnees)).toBe(true)
  })
})

describe('basculerLesDeuxEditions', () => {
  /** Un graphique réduit à ce que la bascule touche. */
  function grapheFactice() {
    const visible = [true, true, true, true]
    return {
      data: {
        datasets: [
          { cle: 'participants' },
          { cle: 'volunteers' },
          { cle: 'participants', comparaison: true },
          { cle: 'volunteers', comparaison: true },
        ],
      },
      isDatasetVisible: (i: number) => visible[i]!,
      setDatasetVisibility: (i: number, v: boolean) => {
        visible[i] = v
      },
      update: vi.fn(),
      visible,
    }
  }

  it('masque la catégorie dans les DEUX éditions', () => {
    // Le défaut qu'on empêche : la légende ne montrant que l'édition en cours, le comportement
    // par défaut n'aurait masqué que sa pile. Décocher « Bénévoles » aurait laissé les bénévoles
    // de l'an dernier seuls à l'écran, ce qui se lit comme une comparaison alors que ce n'en est
    // plus une.
    const graphe = grapheFactice()
    basculerLesDeuxEditions({}, { datasetIndex: 1 } as LegendeFactice, { chart: graphe as never })
    expect(graphe.visible).toEqual([true, false, true, false])
  })

  it('ne touche pas aux autres catégories', () => {
    const graphe = grapheFactice()
    basculerLesDeuxEditions({}, { datasetIndex: 0 } as LegendeFactice, { chart: graphe as never })
    expect(graphe.visible).toEqual([false, true, false, true])
  })

  it('remet les deux piles quand on re-coche', () => {
    const graphe = grapheFactice()
    const item = { datasetIndex: 1 } as LegendeFactice
    basculerLesDeuxEditions({}, item, { chart: graphe as never })
    basculerLesDeuxEditions({}, item, { chart: graphe as never })
    expect(graphe.visible).toEqual([true, true, true, true])
  })

  it('redessine, sinon rien ne change à l’écran', () => {
    const graphe = grapheFactice()
    basculerLesDeuxEditions({}, { datasetIndex: 0 } as LegendeFactice, { chart: graphe as never })
    expect(graphe.update).toHaveBeenCalled()
  })
})

/** Le strict nécessaire d'un élément de légende, pour ne pas monter tout Chart.js. */
type LegendeFactice = Parameters<typeof sansLesJumelles>[0]
