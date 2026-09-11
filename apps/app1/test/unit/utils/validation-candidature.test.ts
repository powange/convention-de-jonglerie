import { describe, expect, it } from 'vitest'

import {
  auMoinsUnePresence,
  candidatureEnvoyable,
  contactDUrgenceExige,
  manquementDuChamp,
  manquementsDeLaCandidature,
  MOTIVATION_MAX,
  type SaisieCandidature,
} from '../../../../../layers/volunteers/app/utils/validation-candidature'

/**
 * Dix règles vivaient dans autant de `computed` du formulaire, mêlant ce qui est invalide, ce que
 * le serveur a refusé, et ce qu'il convient d'afficher à cet instant. Seule la première est une
 * règle du domaine. Une validation qui dérive se voit tard : le formulaire accepte un envoi que le
 * serveur refuse, et c'est le candidat qui en fait les frais.
 */
const saisieComplete = (champs: Partial<SaisieCandidature> = {}): SaisieCandidature => ({
  phone: '0600000000',
  firstName: 'Marie',
  lastName: 'Dupont',
  eventAvailability: true,
  arrivalDateTime: '2026-07-01_morning',
  departureDateTime: '2026-07-04_evening',
  ...champs,
})

const champs = (saisie: SaisieCandidature, reglages = {}) =>
  manquementsDeLaCandidature(saisie, reglages).map((m) => m.champ)

describe('manquementsDeLaCandidature', () => {
  it('ne reproche rien à une candidature complète', () => {
    expect(manquementsDeLaCandidature(saisieComplete())).toEqual([])
    expect(candidatureEnvoyable(saisieComplete())).toBe(true)
  })

  it('exige le téléphone, le prénom et le nom', () => {
    expect(champs(saisieComplete({ phone: '', firstName: '  ', lastName: null }))).toEqual([
      'phone',
      'firstName',
      'lastName',
    ])
  })

  it('ne se laisse pas satisfaire par des espaces', () => {
    // Un champ rempli d'espaces passait pour rempli si l'on testait seulement sa longueur.
    expect(champs(saisieComplete({ firstName: '   ' }))).toContain('firstName')
  })

  it('exige au moins une période de présence', () => {
    const sansPresence = saisieComplete({
      eventAvailability: false,
      setupAvailability: false,
      teardownAvailability: false,
    })

    expect(champs(sansPresence)).toContain('availability')
  })

  it('refuse une motivation trop longue, et accepte la limite exacte', () => {
    expect(champs(saisieComplete({ motivation: 'a'.repeat(MOTIVATION_MAX) }))).not.toContain(
      'motivation'
    )
    expect(champs(saisieComplete({ motivation: 'a'.repeat(MOTIVATION_MAX + 1) }))).toContain(
      'motivation'
    )
  })

  it('porte la limite dans le message de la motivation', () => {
    const [manquement] = manquementsDeLaCandidature(
      saisieComplete({ motivation: 'a'.repeat(MOTIVATION_MAX + 1) })
    )

    expect(manquement).toMatchObject({
      cle: 'validation.motivation_too_long',
      params: { max: MOTIVATION_MAX },
    })
  })
})

describe('la sévérité d’allergie', () => {
  it('n’est exigée que si une allergie est déclarée', () => {
    // La demander à tout le monde ferait répondre « aucune » à une question non posée.
    expect(champs(saisieComplete())).not.toContain('allergySeverity')
    expect(champs(saisieComplete({ allergies: 'arachides' }))).toContain('allergySeverity')
  })

  it('est satisfaite dès qu’un niveau est choisi', () => {
    expect(
      champs(saisieComplete({ allergies: 'arachides', allergySeverity: 'LIGHT' }))
    ).not.toContain('allergySeverity')
  })
})

describe('contactDUrgenceExige', () => {
  it('suffit d’une des deux raisons', () => {
    // La sévérité d'allergie arrive résolue : quels niveaux l'exigent est décidé une seule fois,
    // par `requiresEmergencyContact`, et en redire la liste ici recréerait la duplication que ce
    // module existe pour supprimer.
    expect(contactDUrgenceExige({ askEmergencyContact: true })).toBe(true)
    expect(contactDUrgenceExige({ severiteExigeUnContact: true })).toBe(true)
    expect(contactDUrgenceExige({ askEmergencyContact: true, severiteExigeUnContact: true })).toBe(
      true
    )
  })

  it('n’exige rien sans raison', () => {
    expect(contactDUrgenceExige({})).toBe(false)
    expect(contactDUrgenceExige()).toBe(false)
  })

  it('entraîne l’exigence des deux champs de contact', () => {
    const critique = saisieComplete({ emergencyContactName: '', emergencyContactPhone: '' })

    expect(champs(critique, { severiteExigeUnContact: true })).toEqual(
      expect.arrayContaining(['emergencyContactName', 'emergencyContactPhone'])
    )
  })

  it('ne réclame rien quand le contact n’est pas exigé', () => {
    const sansContact = champs(
      saisieComplete({ emergencyContactName: '', emergencyContactPhone: '' })
    )

    expect(sansContact).not.toContain('emergencyContactName')
    expect(sansContact).not.toContain('emergencyContactPhone')
  })

  it('se satisfait d’un contact renseigné', () => {
    const renseigne = saisieComplete({
      emergencyContactName: 'Jean',
      emergencyContactPhone: '0600000000',
    })

    expect(champs(renseigne, { askEmergencyContact: true })).toEqual([])
  })
})

describe('les dates', () => {
  it('exige l’arrivée dès qu’une présence est annoncée', () => {
    expect(champs(saisieComplete({ arrivalDateTime: null }))).toContain('arrivalDateTime')
  })

  it('n’exige pas de départ pour qui ne vient qu’au montage', () => {
    // Il a bien une date d'arrivée, et repart quand il veut.
    const montageSeul = saisieComplete({
      setupAvailability: true,
      eventAvailability: false,
      teardownAvailability: false,
      departureDateTime: null,
    })

    expect(champs(montageSeul)).not.toContain('departureDateTime')
    expect(champs(montageSeul)).not.toContain('arrivalDateTime')
  })

  it('exige le départ pour l’événement comme pour le démontage', () => {
    expect(champs(saisieComplete({ departureDateTime: null }))).toContain('departureDateTime')
    expect(
      champs(
        saisieComplete({
          eventAvailability: false,
          teardownAvailability: true,
          departureDateTime: '',
        })
      )
    ).toContain('departureDateTime')
  })

  it('n’exige aucune date quand aucune présence n’est cochée', () => {
    // Sinon le formulaire reprocherait trois choses là où une seule est en cause.
    const rien = champs(
      saisieComplete({
        eventAvailability: false,
        arrivalDateTime: null,
        departureDateTime: null,
      })
    )

    expect(rien).toEqual(['availability'])
  })
})

describe('auMoinsUnePresence', () => {
  it('accepte n’importe laquelle des trois', () => {
    expect(auMoinsUnePresence({ setupAvailability: true })).toBe(true)
    expect(auMoinsUnePresence({ eventAvailability: true })).toBe(true)
    expect(auMoinsUnePresence({ teardownAvailability: true })).toBe(true)
  })

  it('refuse une saisie vide', () => {
    expect(auMoinsUnePresence({})).toBe(false)
  })
})

describe('manquementDuChamp', () => {
  it('retrouve le manquement d’un champ', () => {
    const manquements = manquementsDeLaCandidature(saisieComplete({ phone: '' }))

    expect(manquementDuChamp(manquements, 'phone')?.cle).toBe('validation.phone_required')
    expect(manquementDuChamp(manquements, 'lastName')).toBeUndefined()
  })
})

describe('l’ordre des manquements', () => {
  it('suit la descente du formulaire', () => {
    // C'est l'ordre dans lequel les messages remontent : le premier doit désigner le premier champ
    // fautif en descendant la page, pas un champ situé plus bas.
    const tout = champs(
      saisieComplete({
        phone: '',
        firstName: '',
        motivation: 'a'.repeat(MOTIVATION_MAX + 1),
        eventAvailability: false,
        arrivalDateTime: null,
        departureDateTime: null,
      })
    )

    expect(tout).toEqual(['phone', 'firstName', 'motivation', 'availability'])
  })
})
