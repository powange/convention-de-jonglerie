import { describe, it, expect } from 'vitest'

import {
  brouillonValide,
  champsRestituables,
  cleBrouillon,
  PEREMPTION_BROUILLON_JOURS,
} from '../../../shared/utils/brouillon-candidature'

const MAINTENANT = new Date('2026-08-23T12:00:00.000Z')
const ilYaJours = (jours: number) =>
  new Date(MAINTENANT.getTime() - jours * 86_400_000).toISOString()

describe('cleBrouillon', () => {
  // Sans l'édition, candidater à une seconde convention proposerait la saisie de la première ;
  // sans l'utilisateur, un appareil familial rendrait à l'un ce que l'autre avait écrit.
  it('distingue les éditions et les utilisateurs', () => {
    expect(cleBrouillon(1, 7)).not.toBe(cleBrouillon(2, 7))
    expect(cleBrouillon(1, 7)).not.toBe(cleBrouillon(1, 8))
  })

  it('reste stable pour un même couple', () => {
    expect(cleBrouillon(1, 7)).toBe(cleBrouillon(1, 7))
  })

  it('supporte un utilisateur inconnu', () => {
    expect(cleBrouillon(1, null)).toContain('anonyme')
  })
})

describe('brouillonValide', () => {
  const brouillon = (enregistreLe: string) => ({ enregistreLe, donnees: { motivation: 'bonjour' } })

  it('accepte un brouillon récent', () => {
    expect(brouillonValide(brouillon(ilYaJours(1)), MAINTENANT)).toBe(true)
  })

  it('accepte un brouillon pile à la limite', () => {
    expect(brouillonValide(brouillon(ilYaJours(PEREMPTION_BROUILLON_JOURS)), MAINTENANT)).toBe(true)
  })

  // Des données de santé n'ont pas à rester indéfiniment sur un ordinateur partagé.
  it('écarte un brouillon périmé', () => {
    expect(brouillonValide(brouillon(ilYaJours(8)), MAINTENANT)).toBe(false)
  })

  it('écarte ce qui n’a pas la forme attendue', () => {
    expect(brouillonValide(null, MAINTENANT)).toBe(false)
    expect(brouillonValide('du texte', MAINTENANT)).toBe(false)
    expect(brouillonValide({ donnees: {} }, MAINTENANT)).toBe(false)
    expect(brouillonValide({ enregistreLe: ilYaJours(1) }, MAINTENANT)).toBe(false)
    expect(brouillonValide({ enregistreLe: 'pas une date', donnees: {} }, MAINTENANT)).toBe(false)
  })

  // Une horloge déréglée ne doit pas faire perdre une saisie en cours.
  it('accepte une date future plutôt que de jeter la saisie', () => {
    const futur = new Date(MAINTENANT.getTime() + 86_400_000).toISOString()
    expect(brouillonValide(brouillon(futur), MAINTENANT)).toBe(true)
  })
})

describe('champsRestituables', () => {
  const reference = {
    motivation: '',
    hasPets: false,
    teamPreferences: [] as string[],
    arrivalDateTime: undefined as string | undefined,
  }

  it('restitue les champs de même forme', () => {
    const retenus = champsRestituables(
      { motivation: 'bonjour', hasPets: true, teamPreferences: ['a'] },
      reference
    )
    expect(retenus).toEqual({ motivation: 'bonjour', hasPets: true, teamPreferences: ['a'] })
  })

  // Un formulaire évolue : un champ disparu ne doit pas revenir par la fenêtre.
  it('écarte un champ que le formulaire ne connaît plus', () => {
    expect(champsRestituables({ champObsolete: 'x' }, reference)).toEqual({})
  })

  it('écarte une valeur dont le type ne correspond plus', () => {
    expect(champsRestituables({ motivation: 42, hasPets: 'oui' }, reference)).toEqual({})
  })

  it('distingue un tableau d’un objet', () => {
    expect(champsRestituables({ teamPreferences: { a: 1 } }, reference)).toEqual({})
  })

  it('accepte une valeur pour un champ dont la référence est indéfinie', () => {
    expect(champsRestituables({ arrivalDateTime: '2026-08-01T10:00' }, reference)).toEqual({
      arrivalDateTime: '2026-08-01T10:00',
    })
  })

  it('laisse passer null et undefined', () => {
    expect(champsRestituables({ motivation: null }, reference)).toEqual({ motivation: null })
  })
})
