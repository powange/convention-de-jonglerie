import { describe, it, expect } from 'vitest'

import {
  resumerRepas,
  lignesDeParticipants,
  type RepasDeRestauration,
  type ParticipantDeRepas,
} from '../../../../../layers/meals/app/utils/restauration-pdf'

/**
 * La fiche de restauration.
 *
 * Ce qui se teste ici n'est pas la mise en page mais ce qui SORT : un régime qu'on oublie de
 * compter devient une personne qui ne mange pas, et une gravité d'allergie qu'on perd en route
 * peut envoyer quelqu'un à l'hôpital. Une fiche imprimée ne se rattrape pas.
 */

function personne(p: Partial<ParticipantDeRepas> = {}): ParticipantDeRepas {
  return { type: 'volunteer', nom: 'Martin', prenom: 'Camille', ...p }
}

function repas(p: Partial<RepasDeRestauration> = {}): RepasDeRestauration {
  return {
    mealType: 'LUNCH',
    phases: ['EVENT'],
    totalParticipants: 0,
    volunteerCount: 0,
    artistCount: 0,
    ticketParticipantCount: 0,
    organizerCount: 0,
    participants: [],
    ...p,
  }
}

describe('resumerRepas', () => {
  it('rend les clés du type de repas et de ses phases', () => {
    const r = resumerRepas(repas({ mealType: 'BREAKFAST', phases: ['SETUP', 'EVENT'] }))
    expect(r.cleTypeRepas).toBe('gestion.meals.breakfast')
    expect(r.clesPhases).toEqual(['common.setup', 'common.event'])
  })

  it("rend la valeur brute quand le type n'est pas connu", () => {
    // Mieux vaut une fiche qui affiche « BRUNCH » qu'une fiche qui affiche une case vide.
    const r = resumerRepas(repas({ mealType: 'BRUNCH', phases: ['INCONNUE'] }))
    expect(r.cleTypeRepas).toBe('BRUNCH')
    expect(r.clesPhases).toEqual(['INCONNUE'])
  })

  it('annonce toujours les bénévoles et les artistes, même à zéro', () => {
    // Une fiche qui tait une population laisse croire qu'on a oublié de la compter.
    const r = resumerRepas(repas({ volunteerCount: 0, artistCount: 0 }))
    expect(r.populations).toEqual([
      { cle: 'gestion.meals.count_volunteers', nombre: 0 },
      { cle: 'gestion.meals.count_artists', nombre: 0 },
    ])
  })

  it("n'annonce les billets et les organisateurs que s'il y en a", () => {
    const sans = resumerRepas(repas({ ticketParticipantCount: 0, organizerCount: 0 }))
    expect(sans.populations).toHaveLength(2)

    const avec = resumerRepas(repas({ ticketParticipantCount: 3, organizerCount: 1 }))
    expect(avec.populations.map((p) => p.cle)).toEqual([
      'gestion.meals.count_volunteers',
      'gestion.meals.count_artists',
      'gestion.meals.count_participants',
      'gestion.meals.count_organizers',
    ])
  })

  it('compte « sans régime » et « régime absent » ensemble', () => {
    // NONE vient de l'énumération des comptes, l'absence vient de la billetterie, qui n'en a pas.
    // Les séparer ferait deux lignes pour une seule réalité, et le total ne tomberait plus juste.
    const r = resumerRepas(
      repas({
        participants: [
          personne({ dietaryPreference: 'NONE' }),
          personne({ dietaryPreference: null }),
          personne({}),
        ],
      })
    )
    expect(r.regimes).toEqual([{ cle: 'gestion.meals.diet_none', nombre: 3 }])
  })

  it('garde un ordre fixe et omet les régimes absents', () => {
    const r = resumerRepas(
      repas({
        participants: [
          personne({ dietaryPreference: 'VEGAN' }),
          personne({ dietaryPreference: 'VEGETARIAN' }),
          personne({ dietaryPreference: 'VEGAN' }),
        ],
      })
    )
    // L'ordre ne suit pas les données : il est fixe, pour qu'on parcoure la fiche sans la relire.
    expect(r.regimes).toEqual([
      { cle: 'gestion.meals.diet_vegetarian', nombre: 1 },
      { cle: 'gestion.meals.diet_vegan', nombre: 2 },
    ])
  })

  it('ne compte après spectacle que les artistes', () => {
    const r = resumerRepas(
      repas({
        participants: [
          personne({ type: 'artist', afterShow: true }),
          personne({ type: 'artist', afterShow: false }),
          // Un bénévole marqué « après spectacle » n'a pas de sens : il ne doit pas compter.
          personne({ type: 'volunteer', afterShow: true }),
        ],
      })
    )
    expect(r.apresSpectacle).toBe(1)
  })

  it('retient les allergies, leur gravité et le contact d’urgence', () => {
    const r = resumerRepas(
      repas({
        participants: [
          personne({
            prenom: 'Sam',
            nom: 'Bakker',
            allergies: ' arachide ',
            allergySeverity: 'CRITICAL',
            emergencyContactPhone: '0600000000',
          }),
          personne({ allergies: '   ' }),
          personne({ allergies: null }),
        ],
      })
    )
    expect(r.allergies).toEqual([
      {
        nom: 'Sam Bakker',
        allergies: 'arachide',
        cleGravite: 'gestion.meals.severity_critical',
        telephoneUrgence: '0600000000',
      },
    ])
  })

  it('connaît les quatre gravités, CRITICAL comprise', () => {
    // L'énumération AllergySeverity en porte quatre. En perdre une l'efface de la fiche — et
    // c'est précisément la plus grave qui décide si une erreur de service devient un accident.
    for (const [gravite, cle] of [
      ['LIGHT', 'gestion.meals.severity_light'],
      ['MODERATE', 'gestion.meals.severity_moderate'],
      ['SEVERE', 'gestion.meals.severity_severe'],
      ['CRITICAL', 'gestion.meals.severity_critical'],
    ] as const) {
      const r = resumerRepas(
        repas({ participants: [personne({ allergies: 'lait', allergySeverity: gravite })] })
      )
      expect(r.allergies[0]?.cleGravite).toBe(cle)
    }
  })

  it('accepte une allergie sans gravité renseignée', () => {
    const r = resumerRepas(repas({ participants: [personne({ allergies: 'gluten' })] }))
    expect(r.allergies[0]?.cleGravite).toBeNull()
  })
})

describe('lignesDeParticipants', () => {
  it('laisse la colonne régime vide pour « sans régime particulier »', () => {
    // Ce qui doit sauter aux yeux, c'est l'exception — pas la mention répétée sur chaque ligne.
    const lignes = lignesDeParticipants(
      repas({
        participants: [
          personne({ dietaryPreference: 'NONE' }),
          personne({ dietaryPreference: null }),
          personne({ dietaryPreference: 'VEGAN' }),
        ],
      })
    )
    expect(lignes.map((l) => l.cleRegime)).toEqual([null, null, 'gestion.meals.diet_vegan'])
  })

  it('rend la clé du type de personne pour les quatre populations', () => {
    const lignes = lignesDeParticipants(
      repas({
        participants: [
          personne({ type: 'volunteer' }),
          personne({ type: 'artist' }),
          personne({ type: 'participant' }),
          personne({ type: 'organizer' }),
        ],
      })
    )
    expect(lignes.map((l) => l.cleType)).toEqual([
      'gestion.meals.person_type.volunteer',
      'gestion.meals.person_type.artist',
      'gestion.meals.person_type.participant',
      'gestion.meals.person_type.organizer',
    ])
  })

  it('ne marque « après spectacle » que pour un artiste', () => {
    const lignes = lignesDeParticipants(
      repas({
        participants: [
          personne({ type: 'artist', afterShow: true }),
          personne({ type: 'volunteer', afterShow: true }),
          personne({ type: 'artist', afterShow: null }),
        ],
      })
    )
    expect(lignes.map((l) => l.apresSpectacle)).toEqual([true, false, false])
  })

  it('vide une allergie qui ne contient que des espaces', () => {
    const lignes = lignesDeParticipants(
      repas({ participants: [personne({ allergies: '  ' }), personne({ allergies: ' soja ' })] })
    )
    expect(lignes.map((l) => l.allergies)).toEqual([null, 'soja'])
  })

  it('garde l’ordre reçu', () => {
    // Le serveur a déjà trié ; réordonner ici ferait diverger la fiche de l'écran.
    const lignes = lignesDeParticipants(
      repas({
        participants: [personne({ nom: 'Zola' }), personne({ nom: 'Adam' })],
      })
    )
    expect(lignes.map((l) => l.nom)).toEqual(['Zola', 'Adam'])
  })
})
