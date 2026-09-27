import { describe, it, expect, beforeEach, vi } from 'vitest'

import { validateTeamPreferences } from '../../../../server/utils/editions/volunteers/applications'

const prismaMock = (globalThis as any).prisma

/**
 * Le serveur refuse une équipe hors des périodes de présence du candidat.
 *
 * Le formulaire ne propose déjà que les équipes dont une période recoupe les disponibilités
 * annoncées. Redire la règle ici n'est pas une redondance : sans ce refus, celle du navigateur ne
 * serait que décorative — une candidature écrite à la main, ou construite avant que le candidat ne
 * change ses disponibilités, placerait quelqu'un dans une équipe qui n'existe pas quand il est là.
 *
 * C'est l'asymétrie client/serveur que ce même formulaire a déjà connue sur le téléphone, et qui
 * avait coûté au candidat un aller-retour pour un refus ne désignant aucun champ.
 *
 * ⚠️ `validateTeamPreferences` n'avait AUCUN test avant ce lot, non plus que `validateAvailability`.
 */

const ACCUEIL = {
  id: 'accueil',
  name: 'Accueil',
  coversSetup: false,
  coversEvent: true,
  coversTeardown: false,
}
const CHANTIER = {
  id: 'chantier',
  name: 'Chantier',
  coversSetup: true,
  coversEvent: false,
  coversTeardown: true,
}

const candidature = (p: Record<string, unknown>) =>
  ({
    setupAvailability: false,
    eventAvailability: false,
    teardownAvailability: false,
    ...p,
  }) as never

describe('validateTeamPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.volunteerTeam.findMany.mockResolvedValue([ACCUEIL, CHANTIER])
  })

  it('accepte une équipe qui recoupe les disponibilités', async () => {
    const erreurs = await validateTeamPreferences(
      candidature({ teamPreferences: ['accueil'], eventAvailability: true }),
      42,
      true
    )

    expect(erreurs).toEqual([])
  })

  it('refuse une équipe hors des périodes de présence, en la nommant', async () => {
    // Le nom, pas l'identifiant : c'est ce que l'organisateur ou le candidat lira.
    const erreurs = await validateTeamPreferences(
      candidature({ teamPreferences: ['chantier'], eventAvailability: true }),
      42,
      true
    )

    expect(erreurs).toHaveLength(1)
    expect(erreurs[0]).toContain('Chantier')
  })

  it('suffit d’une période commune, même si l’équipe en couvre d’autres', async () => {
    // « Chantier » couvre montage et démontage ; venir au seul démontage suffit.
    const erreurs = await validateTeamPreferences(
      candidature({ teamPreferences: ['chantier'], teardownAvailability: true }),
      42,
      true
    )

    expect(erreurs).toEqual([])
  })

  it('signale séparément un identifiant d’équipe inconnu', async () => {
    // La garde d'appartenance qui existait déjà ne doit pas être noyée par la nouvelle.
    const erreurs = await validateTeamPreferences(
      candidature({ teamPreferences: ['fantome'], eventAvailability: true }),
      42,
      true
    )

    expect(erreurs.some((e) => e.includes('Équipes invalides'))).toBe(true)
  })

  it('cumule les deux reproches quand les deux s’appliquent', async () => {
    const erreurs = await validateTeamPreferences(
      candidature({ teamPreferences: ['fantome', 'chantier'], eventAvailability: true }),
      42,
      true
    )

    expect(erreurs).toHaveLength(2)
  })

  it('ne vérifie rien quand l’édition ne demande pas de préférences d’équipe', async () => {
    const erreurs = await validateTeamPreferences(
      candidature({ teamPreferences: ['chantier'], eventAvailability: true }),
      42,
      false
    )

    expect(erreurs).toEqual([])
    expect(prismaMock.volunteerTeam.findMany).not.toHaveBeenCalled()
  })

  it('ne vérifie rien quand aucune équipe n’est choisie', async () => {
    const erreurs = await validateTeamPreferences(
      candidature({ teamPreferences: [], eventAvailability: true }),
      42,
      true
    )

    expect(erreurs).toEqual([])
    expect(prismaMock.volunteerTeam.findMany).not.toHaveBeenCalled()
  })

  it('demande bien les périodes à la base, sans quoi le refus serait aveugle', async () => {
    // Sans ces trois colonnes dans le `select`, toutes les équipes paraîtraient ne rien couvrir et
    // le point d'API refuserait TOUT — un défaut plus visible, mais tout aussi réel.
    await validateTeamPreferences(
      candidature({ teamPreferences: ['accueil'], eventAvailability: true }),
      42,
      true
    )

    expect(prismaMock.volunteerTeam.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          coversSetup: true,
          coversEvent: true,
          coversTeardown: true,
        }),
      })
    )
  })
})
