import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../../../../../../../../../layers/volunteers/server/api/editions/[id]/volunteers/applications/index.post'

const prismaMock = (globalThis as any).prisma

/**
 * Ce qu'on renseigne dans une candidature remonte au profil, qui fait foi.
 *
 * Sans cette remontée, le profil resterait vide pour tous ceux qui passent par le formulaire de
 * candidature — c'est-à-dire presque tout le monde — et l'information continuerait de vivre
 * dans une copie par édition. C'est précisément ce que ce branchement supprime.
 *
 * La règle est stricte dans l'autre sens : une candidature ne doit JAMAIS écraser ce que la
 * personne a mis dans son profil. Elle ne comble que les vides.
 */

const DEMAIN = new Date(Date.now() + 24 * 3600 * 1000)
const APRES_DEMAIN = new Date(Date.now() + 48 * 3600 * 1000)

const PROFIL_VIDE = {
  id: 1,
  email: 'user@example.com',
  pseudo: 'testuser',
  nom: 'Test',
  prenom: 'User',
  phone: '+33123456789',
  dietaryPreference: 'NONE',
  allergies: null,
  allergySeverity: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
}

const REGLAGES = {
  open: true,
  askDiet: true,
  askAllergies: true,
  // Le contact d'urgence n'est pas exigé par défaut : les éditions qui le réclament rendent
  // la candidature invalide sans lui, ce qui n'a rien à voir avec la remontée qu'on éprouve.
  askEmergencyContact: false,
}

const CANDIDATURE = {
  motivation: 'Je veux aider',
  setupAvailability: true,
  arrivalDateTime: '2026-06-01_morning',
  departureDateTime: APRES_DEMAIN.toISOString(),
}

const postuler = async (
  profil: Record<string, unknown>,
  saisie: Record<string, unknown>,
  reglages: Record<string, unknown> = {}
) => {
  prismaMock.eventVolunteerSettings.findUnique.mockResolvedValue({ ...REGLAGES, ...reglages })
  prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(null)
  prismaMock.user.findUnique.mockResolvedValue(profil)
  prismaMock.editionVolunteerApplication.create.mockResolvedValue({ id: 1, userId: 1 })
  prismaMock.user.update.mockResolvedValue({})
  global.readBody.mockResolvedValue({ ...CANDIDATURE, ...saisie })
  await handler({ context: { user: profil } } as any)
}

/** Ce qui a été écrit sur le profil, ou `null` si le profil n'a pas été touché. */
const ecritureProfil = () => prismaMock.user.update.mock.calls.at(-1)?.[0]?.data ?? null

describe('Candidature bénévole — remontée vers le profil', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn()
    global.getRouterParam = vi.fn().mockReturnValue('1')
    prismaMock.volunteerTeam.findMany.mockResolvedValue([])
    void DEMAIN
  })

  it('remonte régime, allergies et contact d’urgence quand le profil les ignore', async () => {
    await postuler(PROFIL_VIDE, {
      dietaryPreference: 'VEGAN',
      allergies: 'Arachides',
      allergySeverity: 'SEVERE',
      emergencyContactName: 'Camille Dupont',
      emergencyContactPhone: '+33612345678',
    })

    expect(ecritureProfil()).toMatchObject({
      dietaryPreference: 'VEGAN',
      allergies: 'Arachides',
      allergySeverity: 'SEVERE',
      emergencyContactName: 'Camille Dupont',
      emergencyContactPhone: '+33612345678',
    })
  })

  it('porte au profil la correction de l’intéressé', async () => {
    // Le formulaire a été pré-rempli depuis le profil : ce qui revient EST sa déclaration.
    // Se contenter de combler les vides annulait silencieusement toute correction — le profil
    // gardait l'ancienne valeur et, faisant foi à la lecture, la modification n'apparaissait
    // nulle part. Défaut livré puis corrigé.
    await postuler(
      {
        ...PROFIL_VIDE,
        dietaryPreference: 'VEGETARIAN',
        allergies: 'Gluten',
        allergySeverity: 'LIGHT',
      },
      // Gravité modérée : au-delà, le contact d'urgence devient obligatoire et la candidature
      // serait rejetée pour une raison étrangère à ce qu'on éprouve ici.
      { dietaryPreference: 'VEGAN', allergies: 'Arachides', allergySeverity: 'MODERATE' }
    )

    expect(ecritureProfil()).toMatchObject({
      dietaryPreference: 'VEGAN',
      allergies: 'Arachides',
      allergySeverity: 'MODERATE',
    })
  })

  it('n’écrit rien quand la saisie répète ce que le profil sait déjà', async () => {
    await postuler(
      {
        ...PROFIL_VIDE,
        dietaryPreference: 'VEGAN',
        allergies: 'Arachides',
        allergySeverity: 'LIGHT',
      },
      // La gravité accompagne l'allergie : le point d'API l'exige dès qu'une allergie est
      // décrite, indépendamment de la remontée qu'on éprouve.
      { dietaryPreference: 'VEGAN', allergies: 'Arachides', allergySeverity: 'LIGHT' }
    )
    const ecriture = ecritureProfil() ?? {}
    expect(ecriture).not.toHaveProperty('dietaryPreference')
    expect(ecriture).not.toHaveProperty('allergies')
  })

  it('ne touche pas au profil quand la candidature n’apporte rien', async () => {
    await postuler(PROFIL_VIDE, {})
    expect(ecritureProfil()).toBeNull()
  })

  it("n'enregistre pas ce que l'édition ne demande pas", async () => {
    // L'ancienne écriture sur la candidature filtrait déjà par les questions activées. Perdre
    // ce filtre en passant au profil aurait permis d'y déposer des informations qu'aucun
    // formulaire n'avait montrées. Relevé en relecture, pas en production.
    await postuler(
      PROFIL_VIDE,
      { dietaryPreference: 'VEGAN', emergencyContactName: 'Camille' },
      { askDiet: false, askEmergencyContact: false }
    )
    const ecriture = ecritureProfil() ?? {}
    expect(ecriture).not.toHaveProperty('dietaryPreference')
    expect(ecriture).not.toHaveProperty('emergencyContactName')
  })

  it('ne prend pas « aucun régime » pour une déclaration', async () => {
    await postuler(PROFIL_VIDE, { dietaryPreference: 'NONE' })
    expect(ecritureProfil() ?? {}).not.toHaveProperty('dietaryPreference')
  })
})
