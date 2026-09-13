import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../../../../server/utils/permissions/edition-permissions', () => ({
  getEditionWithPermissions: vi.fn(),
  canManageStock: vi.fn(() => true),
  canAccessStock: vi.fn(async () => true),
}))

import { getEditionWithPermissions } from '#server/utils/permissions/edition-permissions'
import creerReservation from '../../../../../../../layers/stock/server/api/editions/[id]/stock-items/[itemId]/reservations.post'
import planningDuGroupe from '../../../../../../../layers/stock/server/api/editions/[id]/stock-groups/[groupId]/planning.get'
import modifierGroupe from '../../../../../../../layers/stock/server/api/editions/[id]/stock-groups/[groupId]/index.put'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma
const mockEdition = getEditionWithPermissions as ReturnType<typeof vi.fn>

/** Le groupe que la garde lit, à travers l'objet. */
const groupeDeLObjet = (reservationsEnabled: boolean) =>
  prismaMock.stockItem.findFirst.mockResolvedValue({
    group: { id: 7, reservationsEnabled },
  })

/**
 * Tout le matériel ne se réserve pas : un groupe déclare s'il gère les réservations, et le défaut
 * est NON.
 *
 * ⚠️ Ces tests portent sur le SERVEUR, et c'est tout l'enjeu. Ce dépôt a déjà connu un réglage qui
 * promettait de cacher et ne cachait qu'à l'affichage, l'API rendant tout (`visibilite-equipes.ts`).
 * Vérifier le refus à l'endpoint, et non à l'écran, est le seul contrôle qui vaille.
 */
describe('les réservations par groupe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Sans édition, les endpoints s'arrêtent sur « Édition non trouvée » avant d'atteindre la
    // garde : le test passerait au vert sans avoir rien vérifié.
    mockEdition.mockResolvedValue({ id: 1, stockEnabled: true })
    global.getRouterParam = vi.fn((_e: any, nom: string) => (nom === 'itemId' ? '3' : '7'))
    global.readBody = vi.fn().mockResolvedValue({})
  })

  const evenement = { context: { params: { id: '1' }, user: { id: 10 } } }

  describe('créer une réservation sur un objet', () => {
    it('refuse quand le groupe ne gère pas les réservations', async () => {
      groupeDeLObjet(false)

      await expect(creerReservation(evenement as any)).rejects.toMatchObject({ statusCode: 403 })
      expect(prismaMock.stockReservation.create).not.toHaveBeenCalled()
    })

    it('refuse aussi quand le groupe n’a rien configuré', async () => {
      // Une absence de réglage ne doit pas ouvrir ce qu'un réglage fermerait.
      prismaMock.stockItem.findFirst.mockResolvedValue({ group: { id: 7 } })

      await expect(creerReservation(evenement as any)).rejects.toMatchObject({ statusCode: 403 })
    })
  })

  describe('le calendrier du groupe', () => {
    it('est refusé sur un groupe qui ne gère pas les réservations', async () => {
      // Il ne montre que des réservations : sur un tel groupe, il n'aurait rien à afficher, et le
      // laisser répondre donnerait à croire que la fonctionnalité existe.
      prismaMock.stockGroup.findFirst.mockResolvedValue({ reservationsEnabled: false })

      await expect(planningDuGroupe(evenement as any)).rejects.toMatchObject({ statusCode: 403 })
    })
  })

  describe('fermer les réservations d’un groupe', () => {
    beforeEach(() => {
      prismaMock.stockGroup.findFirst.mockResolvedValue({ id: 7, editionId: 1 })
      prismaMock.stockGroup.update.mockResolvedValue({ id: 7, reservationsEnabled: false })
    })

    it('est refusé tant qu’il en reste, en disant combien', async () => {
      // Décidé : on ne masque pas des réservations en les gardant en base — des gens compteraient
      // sur du matériel qui ne s'affiche plus nulle part. Le refus, lui, se voit et se répare.
      global.readBody = vi.fn().mockResolvedValue({ reservationsEnabled: false })
      prismaMock.stockReservation.count.mockResolvedValue(4)

      await expect(modifierGroupe(evenement as any)).rejects.toMatchObject({ statusCode: 409 })
      expect(prismaMock.stockGroup.update).not.toHaveBeenCalled()
    })

    it('est accepté quand il n’en reste plus', async () => {
      global.readBody = vi.fn().mockResolvedValue({ reservationsEnabled: false })
      prismaMock.stockReservation.count.mockResolvedValue(0)

      await modifierGroupe(evenement as any)

      expect(prismaMock.stockGroup.update.mock.calls.at(-1)![0].data.reservationsEnabled).toBe(
        false
      )
    })

    it('n’exige rien pour OUVRIR les réservations', async () => {
      // Ouvrir ne retire rien à personne : compter avant serait une requête pour rien.
      global.readBody = vi.fn().mockResolvedValue({ reservationsEnabled: true })

      await modifierGroupe(evenement as any)

      expect(prismaMock.stockReservation.count).not.toHaveBeenCalled()
      expect(prismaMock.stockGroup.update.mock.calls.at(-1)![0].data.reservationsEnabled).toBe(true)
    })

    it('ne touche pas au réglage quand le corps n’en parle pas', async () => {
      // Renommer un groupe ne doit pas rouvrir ni fermer ses réservations au passage.
      global.readBody = vi.fn().mockResolvedValue({ name: 'Sonorisation' })

      await modifierGroupe(evenement as any)

      expect(prismaMock.stockGroup.update.mock.calls.at(-1)![0].data).not.toHaveProperty(
        'reservationsEnabled'
      )
    })
  })
})
