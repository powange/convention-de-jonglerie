import { describe, it, expect, vi, beforeEach } from 'vitest'

import { global } from '../../../../globales-nitro'

// wrapApiHandler et validateEditionId sont auto-importés (Nitro).
vi.hoisted(() => {
  if (!(globalThis as any).wrapApiHandler) {
    ;(globalThis as any).wrapApiHandler = (handler: any) => handler
  }
})

vi.mock('../../../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn(() => ({ id: 1 })),
}))

const canManageMealsById = vi.fn(async () => true)

vi.mock('../../../../../../server/utils/permissions/edition-permissions', () => ({
  canManageMealsById: (...args: unknown[]) => canManageMealsById(...(args as [])),
}))

const getMealParticipants = vi.fn(async () => ({}) as Record<number, unknown[]>)
const getMealTicketParticipants = vi.fn(async () => ({}) as Record<number, unknown[]>)

vi.mock('../../../../../../server/meals/ports/registry', () => ({
  useMealsPorts: vi.fn(() => ({
    artists: { getMealParticipants },
    ticketing: { getMealTicketParticipants },
  })),
}))

import participants from '../../../../../../../../layers/meals/server/api/editions/[id]/meals/participants.get'

const prismaMock = (globalThis as any).prisma

const evenement = { context: { params: { id: '22' }, user: { id: 1 } } }

const REPAS = { id: 1, date: new Date('2026-10-02'), mealType: 'LUNCH', phases: ['EVENT'] }

/** Un profil tel que le point d'API le sélectionne : c'est lui qui porte le régime. */
const profil = (
  id: number,
  nom: string,
  infos: Partial<{ dietaryPreference: string; allergies: string; allergySeverity: string }> = {}
) => ({
  id,
  nom,
  prenom: 'Camille',
  email: `${nom.toLowerCase()}@exemple.fr`,
  phone: null,
  dietaryPreference: 'NONE',
  allergies: null,
  allergySeverity: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  ...infos,
})

const appeler = async () => await participants(evenement as any)

/**
 * Régimes alimentaires de la liste des repas.
 *
 * Deux défauts se cumulaient et faisaient que les trois lignes de la carte « Par régime
 * alimentaire » ne totalisaient pas le nombre de participants annoncé juste au-dessus :
 *
 * — « sans régime particulier » se dit `'NONE'` en base, une valeur et non une absence. Le
 *   compteur « standard » la cherchait dans ce qui est vide, si bien que ces personnes ne
 *   figuraient dans aucune des trois lignes ;
 * — le régime et les allergies des bénévoles étaient lus sur la candidature, dont les colonnes
 *   ont été supprimées une fois le profil devenu seule source. Ils valaient donc `undefined`,
 *   et un bénévole végétarien n'apparaissait plus comme tel.
 */
describe('liste des repas : régimes alimentaires et allergies', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    canManageMealsById.mockResolvedValue(true)
    global.getQuery = vi.fn().mockReturnValue({})

    prismaMock.volunteerMeal.findMany.mockResolvedValue([
      {
        ...REPAS,
        mealSelections: [
          {
            volunteer: {
              user: profil(11, 'Bakker', {
                dietaryPreference: 'VEGETARIAN',
                allergies: 'arachides',
                allergySeverity: 'SEVERE',
              }),
            },
          },
          { volunteer: { user: profil(12, 'Bernard') } },
        ],
      },
    ])

    // Un organisateur végétarien et deux sans régime : ce sont ces deux-là qui disparaissaient.
    prismaMock.editionOrganizer.findMany.mockResolvedValue([
      {
        id: 1,
        mealSelections: [],
        organizer: { user: profil(21, 'Chartier', { dietaryPreference: 'VEGETARIAN' }) },
      },
      { id: 2, mealSelections: [], organizer: { user: profil(22, 'Dubois') } },
      { id: 3, mealSelections: [], organizer: { user: profil(23, 'Evrard') } },
    ])

    getMealParticipants.mockResolvedValue({
      1: [
        {
          userId: 31,
          nom: 'Fabre',
          prenom: 'Alix',
          email: 'fabre@exemple.fr',
          phone: null,
          dietaryPreference: 'VEGAN',
          allergies: null,
          allergySeverity: null,
          afterShow: false,
        },
      ],
    })

    // La billetterie n'a pas d'enum : rien de déclaré vaut `null`, et non `'NONE'`.
    getMealTicketParticipants.mockResolvedValue({
      1: [
        {
          orderItemId: 41,
          lastName: 'Gaudin',
          firstName: 'Sacha',
          email: 'gaudin@exemple.fr',
          dietaryPreference: null,
          allergies: null,
          allergySeverity: null,
        },
      ],
    })
  })

  it('répartit tous les participants entre les trois régimes, sans en perdre aucun', async () => {
    const { stats } = (await appeler()) as any

    expect(stats.total).toBe(7)
    expect(stats.byDiet).toEqual({ VEGETARIAN: 2, VEGAN: 1, standard: 4 })
    expect(stats.byDiet.standard + stats.byDiet.VEGETARIAN + stats.byDiet.VEGAN).toBe(stats.total)
  })

  it('lit le régime du bénévole sur son profil', async () => {
    const { data } = (await appeler()) as any

    const benevoles = data.filter((p: any) => p.type === 'volunteer')
    expect(benevoles).toHaveLength(2)
    expect(benevoles.find((p: any) => p.nom === 'Bakker').dietaryPreference).toBe('VEGETARIAN')
    expect(benevoles.find((p: any) => p.nom === 'Bernard').dietaryPreference).toBe('NONE')
  })

  it('compte les allergies des bénévoles, qui ne remontaient plus', async () => {
    const { stats, data } = (await appeler()) as any

    expect(stats.withAllergies).toBe(1)
    expect(data.find((p: any) => p.nom === 'Bakker')).toMatchObject({
      allergies: 'arachides',
      allergySeverity: 'SEVERE',
    })
  })

  it('demande à la base les champs alimentaires du profil du bénévole', async () => {
    await appeler()

    const [arguments_] = prismaMock.volunteerMeal.findMany.mock.calls[0]
    expect(arguments_.include.mealSelections.include.volunteer.include.user.select).toMatchObject({
      dietaryPreference: true,
      allergies: true,
      allergySeverity: true,
    })
  })
})
