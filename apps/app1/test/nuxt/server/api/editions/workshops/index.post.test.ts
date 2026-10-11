import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetConfig = vi.hoisted(() => vi.fn())
const mockRequireAuth = vi.hoisted(() => vi.fn())
const mockCanCreate = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/auth-utils', () => ({ requireAuth: mockRequireAuth }))
vi.mock('#server/utils/permissions/workshop-permissions', () => ({
  canCreateWorkshop: mockCanCreate,
}))
vi.mock('#server/workshops/ports/registry', () => ({
  useWorkshopsPorts: () => ({ event: { getConfig: mockGetConfig } }),
}))

import handler from '../../../../../../../../layers/workshops/server/api/editions/[id]/workshops/index.post'

const prismaMock = (globalThis as any).prisma

/**
 * Le LIEU d'un atelier créé par l'API — constat B2.
 *
 * ## Le défaut
 *
 * L'import depuis une affiche ne connaît que des NOMS de lieu : l'IA lit « Salle A » sur l'image,
 * elle n'a aucun identifiant à proposer. Or ce handler ne cherchait le lieu QUE si l'édition
 * autorise la saisie libre. En mode « lieux exclusifs », le nom était donc ignoré **sans un mot**,
 * et l'atelier apparaissait sans lieu.
 *
 * ## ⚠️ CE QUE CES CAS NE PEUVENT PAS PROUVER, et c'est dit plutôt que masqué
 *
 * La comparaison des noms est **insensible à la casse par la collation de la base**
 * (`utf8mb4_unicode_ci`, relevée en base) — pas par le code. Le bouchon central ignorant le
 * `where`, aucun test ne peut le montrer ici : ce qui est vérifiable, c'est la **forme** de la
 * requête et ce que le handler fait de sa réponse.
 *
 * 📍 `validateAndSanitize` et `workshopSchema` ne sont PAS remplacés par des bouchons : c'est le
 * vrai schéma qui tourne, et c'est précisément lui qui faisait disparaître le lieu. Un cas
 * l'exerce directement.
 */
const EDITION = 1
const AUTEUR = { id: 42, pseudo: 'camille' }

/** Dates dans la fenêtre de l'édition : le schéma refuse un atelier hors de ses bornes. */
const config = (locationsFreeInput: boolean) => ({
  found: true,
  enabled: true,
  locationsFreeInput,
  startDate: new Date('2026-07-01T00:00:00Z'),
  endDate: new Date('2026-07-05T23:59:59Z'),
  timezone: 'Europe/Paris',
})

const corps = (extra: Record<string, unknown>) => ({
  title: 'Initiation au bâton du diable',
  description: null,
  startDateTime: '2026-07-02T10:00:00.000Z',
  endDateTime: '2026-07-02T12:00:00.000Z',
  maxParticipants: null,
  ...extra,
})

const evenement = { context: { params: { id: String(EDITION) }, user: AUTEUR } }

const appeler = async (body: Record<string, unknown>) => {
  ;(globalThis as any).readBody = vi.fn(async () => body)
  return (await handler(evenement as any)) as {
    data: { locationId: number | null; locationIgnored: boolean }
  }
}

describe('POST /api/editions/[id]/workshops — le lieu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockReturnValue(AUTEUR)
    mockCanCreate.mockResolvedValue(true)
    mockGetConfig.mockResolvedValue(config(false))
    prismaMock.workshopLocation.findFirst.mockReset()
    prismaMock.workshopLocation.create.mockReset()
    prismaMock.workshop.create.mockReset()
    prismaMock.workshopLocation.findFirst.mockResolvedValue(null)
    // Le handler rend ce que l'écriture renvoie : on lui fait écho du lieu rattaché.
    prismaMock.workshop.create.mockImplementation(async ({ data }: any) => ({
      id: 7,
      ...data,
      creator: AUTEUR,
      location: data.locationId ? { id: data.locationId, name: 'Salle A' } : null,
    }))
  })

  it('⚠️ RATTACHE UN NOM CONNU MÊME EN MODE « LIEUX EXCLUSIFS »', async () => {
    prismaMock.workshopLocation.findFirst.mockResolvedValue({ id: 3 })

    const res = await appeler(corps({ locationName: 'Salle A' }))

    expect(prismaMock.workshopLocation.findFirst).toHaveBeenCalledWith({
      where: { editionId: EDITION, name: 'Salle A' },
      select: { id: true },
    })
    // Aucun lieu n'est CRÉÉ : en mode exclusif, la liste est arrêtée.
    expect(prismaMock.workshopLocation.create).not.toHaveBeenCalled()
    expect(prismaMock.workshop.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ locationId: 3 }) })
    )
    expect(res.data.locationIgnored).toBe(false)
  })

  it('⚠️ LE DIT quand le nom est inconnu et que la liste est arrêtée', async () => {
    const res = await appeler(corps({ locationName: 'Chapiteau du fond' }))

    // L'atelier est créé — son titre et son horaire sont justes —, mais sans lieu…
    expect(prismaMock.workshop.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ locationId: null }) })
    )
    expect(prismaMock.workshopLocation.create).not.toHaveBeenCalled()
    // …et l'appelant est PRÉVENU. L'ancien silence est le défaut même de ce constat.
    expect(res.data.locationIgnored).toBe(true)
  })

  it('crée le lieu quand la saisie libre est ouverte', async () => {
    /*
     * LE TÉMOIN du mode libre. Sans lui, une garde qui refuserait TOUJOURS de créer un lieu
     * satisferait les deux cas précédents — et le mode « saisie libre », qui existe précisément
     * pour cela, ne créerait plus jamais rien.
     */
    mockGetConfig.mockResolvedValue(config(true))
    prismaMock.workshopLocation.create.mockResolvedValue({ id: 9 })

    const res = await appeler(corps({ locationName: '  Chapiteau du fond  ' }))

    // Le nom est ROGNÉ avant écriture : sans cela « Salle A » et « Salle A » feraient deux lieux.
    expect(prismaMock.workshopLocation.create).toHaveBeenCalledWith({
      data: { editionId: EDITION, name: 'Chapiteau du fond' },
    })
    expect(res.data.locationIgnored).toBe(false)
  })

  it('un identifiant de lieu fourni prime, et n’interroge aucun nom', async () => {
    const res = await appeler(corps({ locationId: 5, locationName: 'Salle A' }))

    expect(prismaMock.workshopLocation.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.workshop.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ locationId: 5 }) })
    )
    expect(res.data.locationIgnored).toBe(false)
  })

  it('sans lieu demandé, rien n’est cherché et rien n’est signalé', async () => {
    const res = await appeler(corps({}))

    expect(prismaMock.workshopLocation.findFirst).not.toHaveBeenCalled()
    expect(res.data.locationIgnored).toBe(false)
  })

  it('📍 UNE CLÉ QUE LE SCHÉMA NE CONNAÎT PAS DISPARAÎT EN SILENCE', async () => {
    /*
     * C'est le cœur du constat, et ce cas le montre sur le vrai schéma : la modale d'import
     * envoyait son lieu sous le nom `location`, que `workshopSchema` ne déclare pas. Zod retire la
     * clé sans lever, le handler ne voit aucun lieu, et l'atelier est créé sans le sien — aucune
     * erreur, aucune trace.
     *
     * ⚠️ Ce cas fige donc un comportement de ZOD, pas un souhait : c'est la raison pour laquelle
     * une garde de source vérifie, à part, que les clés envoyées par la modale sont bien celles
     * que le schéma déclare (`test/unit/outillage/corps-atelier-connu-du-schema.test.ts`). Un test
     * du handler ne peut PAS attraper une faute du client.
     */
    const res = await appeler(corps({ location: 'Salle A' }))

    expect(prismaMock.workshopLocation.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.workshop.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ locationId: null }) })
    )
    // Et surtout : RIEN ne signale la perte, puisque le serveur n'a jamais vu de lieu.
    expect(res.data.locationIgnored).toBe(false)
  })
})
