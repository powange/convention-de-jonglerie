import { describe, expect, it } from 'vitest'

import { completerEquipesDepuisCreneaux } from '../../../../../layers/volunteers/app/utils/completer-equipes-du-planning'

/**
 * Les équipes qu'un planning doit montrer.
 *
 * ⚠️ SIGNALÉ PAR L'UTILISATEUR : « une équipe qui, dans la gestion, a été mise comme masquée pour
 * le formulaire de candidature de bénévoles n'est pas présente dans le planning sur la page
 * publique, alors qu'elle devrait y être ».
 *
 * La cause : `/volunteer-teams` écarte ces équipes pour qui n'est ni gestionnaire ni bénévole
 * accepté — c'est voulu, et c'est ce qui empêche de lire leurs noms depuis le formulaire. Mais le
 * planning se servait de cette même liste pour construire ses colonnes, si bien qu'une équipe
 * masquée y perdait la sienne et ses créneaux avec. Le réglage dit « visible lors de la
 * CANDIDATURE » ; il ne dit rien du planning.
 */
describe('completerEquipesDepuisCreneaux', () => {
  it('🔬 ajoute une équipe que seuls les créneaux connaissent', () => {
    // L'assertion qui porte le point : « Sécurité nuit » est absente de la liste de l'API parce
    // qu'elle est masquée au formulaire, mais elle a un créneau dans le planning servi.
    const equipes = completerEquipesDepuisCreneaux(
      [{ id: 'accueil', name: 'Accueil' }],
      [{ team: { id: 'securite', name: 'Sécurité nuit' } }]
    )

    expect(equipes.map((e) => e.id)).toEqual(['accueil', 'securite'])
    expect(equipes.find((e) => e.id === 'securite')).toMatchObject({ name: 'Sécurité nuit' })
  })

  it('🔬 n’invente AUCUNE équipe sans créneau', () => {
    /*
     * ⚠️ LA PROPRIÉTÉ QU'IL NE FAUT PAS PERDRE en corrigeant le défaut. Si cette fonction se
     * mettait à compléter depuis une autre source — la liste complète des équipes, par exemple —,
     * elle rendrait énumérables les équipes que le réglage promet de cacher, et le correctif
     * coûterait plus cher que le défaut. On ne reconstitue que ce que le serveur a DÉJÀ rendu dans
     * les créneaux.
     */
    expect(completerEquipesDepuisCreneaux([{ id: 'accueil', name: 'Accueil' }], [])).toEqual([
      { id: 'accueil', name: 'Accueil' },
    ])
    expect(completerEquipesDepuisCreneaux([], [])).toEqual([])
  })

  it('garde la version COMPLÈTE quand l’API connaît déjà l’équipe', () => {
    /*
     * 📍 Un créneau ne porte qu'une poignée de champs ; la liste de l'API les porte tous. Laisser
     * la version réduite l'emporter ferait disparaître les réglages d'affichage d'une équipe
     * ordinaire — une régression silencieuse sur le cas courant, au prétexte de corriger le rare.
     */
    const equipes = completerEquipesDepuisCreneaux(
      [{ id: 'accueil', name: 'Accueil', isAutonomousTeam: true, description: 'Hall' }],
      [{ team: { id: 'accueil', name: 'Accueil' } }]
    )

    expect(equipes).toHaveLength(1)
    expect(equipes[0]).toMatchObject({ isAutonomousTeam: true, description: 'Hall' })
  })

  it('ne compte une équipe qu’une fois, quel que soit le nombre de créneaux', () => {
    const equipes = completerEquipesDepuisCreneaux(
      [],
      [
        { team: { id: 'securite', name: 'Sécurité nuit' } },
        { team: { id: 'securite', name: 'Sécurité nuit' } },
        { team: { id: 'bar', name: 'Bar' } },
      ]
    )

    expect(equipes.map((e) => e.id)).toEqual(['securite', 'bar'])
  })

  it('traverse les créneaux sans équipe et les listes absentes', () => {
    // Un créneau sans équipe n'appartient à personne : c'est un cas courant, pas une anomalie.
    expect(completerEquipesDepuisCreneaux([], [{ team: null }, {}])).toEqual([])
    expect(completerEquipesDepuisCreneaux(null, null)).toEqual([])
    expect(completerEquipesDepuisCreneaux(undefined, undefined)).toEqual([])
  })
})
