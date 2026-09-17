import { describe, expect, it } from 'vitest'

import {
  niveauDeVisibilite,
  planningVisiblePour,
  PLANNING_NON_PUBLIE,
} from '../../../../../layers/volunteers/server/utils/publication-plannings'

/**
 * Un responsable construit ses plannings par itérations. Tant que ce travail était immédiatement
 * visible, un bénévole accepté voyait apparaître puis disparaître des services au fil de la
 * journée, et notait des horaires qui n'existeraient plus le lendemain.
 *
 * La décision tient en deux lignes ; ce sont ses bords qui comptent, et c'est ce que ces tests
 * tiennent — notamment le défaut en l'absence de réglage, où se joue la différence entre « on a
 * oublié de configurer » et « c'est ouvert à tout le monde ».
 */
describe('planningVisiblePour', () => {
  describe('un gestionnaire', () => {
    it('voit le planning même non publié', () => {
      // C'est son écran de travail : sans cela, le réglage masquerait le planning à celui-là même
      // qui le construit, et il n'aurait aucun moyen de le relire avant de le publier.
      expect(planningVisiblePour({ estGestionnaire: true, planningPublie: false })).toBe(true)
    })

    it('le voit aussi quand l’édition n’a rien configuré', () => {
      for (const reglage of [undefined, null, false, true])
        expect(planningVisiblePour({ estGestionnaire: true, planningPublie: reglage })).toBe(true)
    })
  })

  describe('un bénévole', () => {
    it('ne voit rien tant que le planning n’est pas publié', () => {
      expect(planningVisiblePour({ estGestionnaire: false, planningPublie: false })).toBe(false)
    })

    it('voit le planning une fois publié', () => {
      expect(planningVisiblePour({ estGestionnaire: false, planningPublie: true })).toBe(true)
    })

    it('ne voit rien quand l’édition n’a jamais rien configuré', () => {
      // Le point le plus important du fichier. Une absence de réglage ne doit pas ouvrir ce qu'un
      // réglage fermerait : le défaut du schéma est `false`, et une règle de visibilité qui
      // s'ouvre par défaut en cas de donnée manquante est une règle qui ne protège pas.
      for (const absence of [undefined, null])
        expect(planningVisiblePour({ estGestionnaire: false, planningPublie: absence })).toBe(false)
    })

    it('n’accepte que le booléen vrai, pas ce qui lui ressemble', () => {
      // Le réglage vient de la base ou d'une réponse d'API ; une valeur « à peu près vraie »
      // — la chaîne `"false"`, par exemple — ne doit pas ouvrir le planning.
      for (const valeur of ['true', 'false', 1, 0, '', {}] as unknown[])
        expect(
          planningVisiblePour({
            estGestionnaire: false,
            planningPublie: valeur as boolean,
          })
        ).toBe(false)
    })
  })
})

describe('PLANNING_NON_PUBLIE', () => {
  it('est un code stable, que l’écran peut reconnaître', () => {
    // Comme `SWAPS_DISABLED` pour les échanges : l'écran doit distinguer « rien à afficher » de
    // « pas encore publié » pour en dire la raison, sans comparer des messages traduits.
    expect(PLANNING_NON_PUBLIE).toBe('PLANNING_NOT_PUBLISHED')
  })
})

/**
 * Le troisième niveau : le responsable d'équipe.
 *
 * Il relit le planning pendant qu'il se construit pour donner son avis avant publication — il est
 * associé au travail, pas soumis à son résultat. D'où un niveau à lui : ses équipes en détail, le
 * reste en anonyme.
 */
describe('niveauDeVisibilite', () => {
  it('rend « complet » à un gestionnaire, publié ou non', () => {
    expect(niveauDeVisibilite({ estGestionnaire: true, planningPublie: false })).toBe('complet')
    expect(niveauDeVisibilite({ estGestionnaire: true, planningPublie: true })).toBe('complet')
  })

  it('rend « partiel » — et NON « complet » — à un bénévole sur un planning publié', () => {
    // Le durcissement : la publication donne l'ACCÈS au planning, pas les noms de toutes les
    // équipes. Elle rendait jusqu'ici tous les noms à tout bénévole accepté.
    expect(niveauDeVisibilite({ estGestionnaire: false, planningPublie: true })).toBe('partiel')
  })

  it('rend « partiel » au responsable d’équipe tant que ce n’est pas publié', () => {
    expect(
      niveauDeVisibilite({
        estGestionnaire: false,
        planningPublie: false,
        estResponsableDEquipe: true,
      })
    ).toBe('partiel')
  })

  it('ne donne au responsable RIEN DE PLUS qu’au bénévole une fois publié', () => {
    // La responsabilité gouverne QUAND on voit, l'appartenance QUI on voit. Une fois publié, la
    // responsabilité n'apporte donc plus rien : les deux sont au même niveau.
    const commun = { estGestionnaire: false, planningPublie: true }

    expect(niveauDeVisibilite({ ...commun, estResponsableDEquipe: true })).toBe(
      niveauDeVisibilite({ ...commun, estResponsableDEquipe: false })
    )
  })

  it('seul le gestionnaire obtient « complet »', () => {
    // C'est désormais la seule porte vers les noms de toutes les équipes.
    for (const planningPublie of [true, false]) {
      for (const estResponsableDEquipe of [true, false]) {
        expect(
          niveauDeVisibilite({ estGestionnaire: false, planningPublie, estResponsableDEquipe })
        ).not.toBe('complet')
      }
    }
    expect(niveauDeVisibilite({ estGestionnaire: true, planningPublie: false })).toBe('complet')
  })

  it('rend « aucun » à un bénévole ordinaire', () => {
    expect(niveauDeVisibilite({ estGestionnaire: false, planningPublie: false })).toBe('aucun')
    expect(
      niveauDeVisibilite({
        estGestionnaire: false,
        planningPublie: false,
        estResponsableDEquipe: false,
      })
    ).toBe('aucun')
  })

  it('rend « aucun » quand l’édition n’a jamais rien configuré', () => {
    // Une absence ne doit pas ouvrir ce qu'un réglage fermerait.
    expect(niveauDeVisibilite({ estGestionnaire: false })).toBe('aucun')
  })
})

describe('planningVisiblePour et le troisième niveau', () => {
  it('reste vrai pour un responsable, qui voit quelque chose', () => {
    // Les surfaces qui posent encore la question en booléen ne doivent pas lui fermer la porte.
    expect(
      planningVisiblePour({
        estGestionnaire: false,
        planningPublie: false,
        estResponsableDEquipe: true,
      })
    ).toBe(true)
  })
})
