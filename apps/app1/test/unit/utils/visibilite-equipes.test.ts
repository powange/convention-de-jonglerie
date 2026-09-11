import { describe, expect, it } from 'vitest'

import {
  equipeVisiblePour,
  filtreDesEquipesVisibles,
  voitLesEquipesCachees,
  VUE_DE_CANDIDATURE,
  type DemandeurDEquipes,
} from '../../../../../layers/volunteers/server/utils/visibilite-equipes'

/**
 * `isVisibleToVolunteers` promettait de cacher une équipe et ne la cachait qu'à l'affichage :
 * l'API rendait tout, et le filtre vivait dans le navigateur. Le nom et la description d'une équipe
 * qu'on ne voulait pas montrer se lisaient dans la réponse, par n'importe quel compte connecté.
 */
const demandeur = (champs: Partial<DemandeurDEquipes> = {}): DemandeurDEquipes => ({
  estGestionnaire: false,
  estBenevoleAccepte: false,
  ...champs,
})

describe('voitLesEquipesCachees', () => {
  it('refuse un simple curieux', () => {
    expect(voitLesEquipesCachees(demandeur())).toBe(false)
  })

  it('accorde au gestionnaire', () => {
    // C'est lui qui décide lesquelles sont cachées : il lui faut bien les avoir sous les yeux.
    expect(voitLesEquipesCachees(demandeur({ estGestionnaire: true }))).toBe(true)
  })

  it('accorde au bénévole accepté', () => {
    // Le réglage dit « visible lors de la candidature » : il vise le futur candidat, pas la
    // personne déjà dans l'organisation. Sans cette exception, un bénévole affecté à un créneau
    // d'une équipe cachée ne verrait plus son propre service.
    expect(voitLesEquipesCachees(demandeur({ estBenevoleAccepte: true }))).toBe(true)
  })
})

describe('filtreDesEquipesVisibles', () => {
  it('restreint aux équipes visibles pour un candidat', () => {
    expect(filtreDesEquipesVisibles(demandeur())).toEqual({ isVisibleToVolunteers: true })
  })

  it('ne restreint rien pour un gestionnaire', () => {
    expect(filtreDesEquipesVisibles(demandeur({ estGestionnaire: true }))).toEqual({})
  })

  it('ne restreint rien pour un bénévole accepté', () => {
    expect(filtreDesEquipesVisibles(demandeur({ estBenevoleAccepte: true }))).toEqual({})
  })

  it('rend un objet fusionnable sans clause parasite', () => {
    // Le filtre est répandu dans un `where` : une clé de trop y ajouterait une condition muette.
    expect(Object.keys(filtreDesEquipesVisibles(demandeur()))).toEqual(['isVisibleToVolunteers'])
    expect(Object.keys(filtreDesEquipesVisibles(demandeur({ estGestionnaire: true })))).toEqual([])
  })
})

describe('equipeVisiblePour', () => {
  it('cache une équipe marquée invisible à un candidat', () => {
    expect(equipeVisiblePour({ isVisibleToVolunteers: false }, demandeur())).toBe(false)
  })

  it('montre une équipe ordinaire à un candidat', () => {
    expect(equipeVisiblePour({ isVisibleToVolunteers: true }, demandeur())).toBe(true)
  })

  it('montre tout au gestionnaire et au bénévole accepté', () => {
    const cachee = { isVisibleToVolunteers: false }

    expect(equipeVisiblePour(cachee, demandeur({ estGestionnaire: true }))).toBe(true)
    expect(equipeVisiblePour(cachee, demandeur({ estBenevoleAccepte: true }))).toBe(true)
  })

  it('traite une équipe sans le champ comme visible', () => {
    // C'est la valeur par défaut de la colonne : une équipe ordinaire ne doit pas disparaître au
    // motif qu'une requête a oublié de sélectionner ce champ.
    expect(equipeVisiblePour({}, demandeur())).toBe(true)
    expect(equipeVisiblePour({ isVisibleToVolunteers: null }, demandeur())).toBe(true)
    expect(equipeVisiblePour({ isVisibleToVolunteers: undefined }, demandeur())).toBe(true)
  })
})

describe('VUE_DE_CANDIDATURE', () => {
  it('ne voit aucune équipe cachée', () => {
    // C'est le plancher : un visiteur sans session y retombe, et le formulaire de candidature la
    // demande explicitement pour qu'un aperçu d'organisateur montre ce que le candidat verra.
    expect(voitLesEquipesCachees(VUE_DE_CANDIDATURE)).toBe(false)
    expect(filtreDesEquipesVisibles(VUE_DE_CANDIDATURE)).toEqual({ isVisibleToVolunteers: true })
  })

  it('n’accorde jamais rien de plus que le demandeur réel', () => {
    // Le paramètre qui la demande vient du client : il doit pouvoir restreindre, jamais ouvrir.
    for (const estGestionnaire of [false, true]) {
      for (const estBenevoleAccepte of [false, true]) {
        const reel = voitLesEquipesCachees({ estGestionnaire, estBenevoleAccepte })

        expect(voitLesEquipesCachees(VUE_DE_CANDIDATURE) && !reel).toBe(false)
      }
    }
  })
})
