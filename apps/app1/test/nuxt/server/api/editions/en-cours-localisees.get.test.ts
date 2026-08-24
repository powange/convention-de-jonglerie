import { beforeEach, describe, expect, it } from 'vitest'

import handler from '../../../../../server/api/editions/en-cours-localisees.get'

// Mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const MAINTENANT = new Date()
const heures = (n: number) => new Date(MAINTENANT.getTime() + n * 3600 * 1000)

/** Une édition dont l'événement est en cours, montage et démontage déclarés autour. */
const editionEnCours = (surcharges: Record<string, unknown> = {}) => ({
  id: 17,
  name: 'Édition de test',
  latitude: 46.62,
  longitude: 0.31,
  eventId: 170,
  conventionId: 42,
  creatorId: 999,
  startDate: heures(-24),
  endDate: heures(24),
  convention: { name: 'Convention de test', authorId: 998 },
  event: { volunteerSettings: { setupStartDate: heures(-72), teardownEndDate: heures(72) } },
  ...surcharges,
})

const evenement = (userId: number | null) => ({ context: { user: userId ? { id: userId } : null } })

const appeler = async (userId: number | null = null) =>
  (await handler(evenement(userId) as any)) as { editions: any[] }

describe('GET /api/editions/en-cours-localisees', () => {
  beforeEach(() => {
    prismaMock.edition.findMany.mockReset()
    prismaMock.editionVolunteerApplication.findMany.mockReset()
    prismaMock.conventionOrganizer.findMany.mockReset()
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([])
    prismaMock.conventionOrganizer.findMany.mockResolvedValue([])
  })

  it("interroge les trois périodes, et pas seulement l'intervalle des dates publiques", async () => {
    prismaMock.edition.findMany.mockResolvedValue([])
    await appeler()

    // Le montage et le démontage sont facultatifs et indépendants : trois branches distinctes
    // sont nécessaires, un simple intervalle élargi manquerait les éditions qui n'en déclarent
    // qu'un seul. Cette partie du filtrage vit en base — c'est ici qu'on la surveille.
    const { where } = prismaMock.edition.findMany.mock.calls[0][0]
    expect(where.OR).toHaveLength(3)
    expect(JSON.stringify(where.OR)).toContain('setupStartDate')
    expect(JSON.stringify(where.OR)).toContain('teardownEndDate')
    expect(where.status).toEqual({ in: ['PUBLISHED', 'PLANNED'] })
  })

  it("emmène un visiteur sur la page de l'édition pendant l'événement", async () => {
    prismaMock.edition.findMany.mockResolvedValue([editionEnCours()])

    const { editions } = await appeler()
    expect(editions).toHaveLength(1)
    expect(editions[0]).toMatchObject({ periode: 'evenement', destination: '/editions/17' })
  })

  it("n'annonce rien à un visiteur pendant le montage : la convention n'est pas ouverte", async () => {
    prismaMock.edition.findMany.mockResolvedValue([
      editionEnCours({ startDate: heures(24), endDate: heures(72) }),
    ])

    const { editions } = await appeler()
    expect(editions).toEqual([])
  })

  it('emmène un organisateur en gestion pendant le montage', async () => {
    prismaMock.edition.findMany.mockResolvedValue([
      editionEnCours({ startDate: heures(24), endDate: heures(72) }),
    ])
    prismaMock.conventionOrganizer.findMany.mockResolvedValue([{ conventionId: 42 }])

    const { editions } = await appeler(7)
    expect(editions).toHaveLength(1)
    expect(editions[0]).toMatchObject({ periode: 'montage', destination: '/editions/17/gestion' })
  })

  it('emmène un bénévole accepté sur son planning pendant le démontage', async () => {
    prismaMock.edition.findMany.mockResolvedValue([
      editionEnCours({ startDate: heures(-72), endDate: heures(-24) }),
    ])
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([{ eventId: 170 }])

    const { editions } = await appeler(7)
    expect(editions).toHaveLength(1)
    expect(editions[0]).toMatchObject({
      periode: 'demontage',
      destination: '/editions/17/volunteers',
    })
  })

  it("fait primer l'organisateur sur le bénévole", async () => {
    prismaMock.edition.findMany.mockResolvedValue([editionEnCours()])
    prismaMock.conventionOrganizer.findMany.mockResolvedValue([{ conventionId: 42 }])
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([{ eventId: 170 }])

    const { editions } = await appeler(7)
    expect(editions[0].destination).toBe('/editions/17/gestion')
  })

  it("tient le créateur de l'édition et l'auteur de la convention pour des organisateurs", async () => {
    prismaMock.edition.findMany.mockResolvedValue([
      editionEnCours({ startDate: heures(24), endDate: heures(72), creatorId: 7 }),
    ])
    expect((await appeler(7)).editions[0].destination).toBe('/editions/17/gestion')

    prismaMock.edition.findMany.mockResolvedValue([
      editionEnCours({
        startDate: heures(24),
        endDate: heures(72),
        convention: { name: 'Convention de test', authorId: 7 },
      }),
    ])
    expect((await appeler(7)).editions[0].destination).toBe('/editions/17/gestion')
  })

  it("n'interroge pas les rôles quand personne n'est connecté", async () => {
    prismaMock.edition.findMany.mockResolvedValue([editionEnCours()])

    await appeler(null)
    expect(prismaMock.conventionOrganizer.findMany).not.toHaveBeenCalled()
    expect(prismaMock.editionVolunteerApplication.findMany).not.toHaveBeenCalled()
  })

  it("retombe sur le nom de la convention quand l'édition n'en porte pas", async () => {
    prismaMock.edition.findMany.mockResolvedValue([editionEnCours({ name: null })])

    const { editions } = await appeler()
    expect(editions[0].nom).toBe('Convention de test')
  })
})
