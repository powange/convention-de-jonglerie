/**
 * Câblage du layer trésorerie pour FLOWVENT (contrat d'hôte, cf. layers/treasury/server/ports/types.ts ;
 * app1 a le sien). L'événement porte lui-même son plan comptable (`conventionId` = son id) ; ses
 * organisateurs sont son propriétaire et les organisateurs déclarés. Pas de devise par événement :
 * l'euro par défaut.
 */
import type { TreasuryPorts } from '#treasury/server/ports/types'

const ports: TreasuryPorts = {
  edition: {
    async lire(editionId) {
      const e = await prisma.event.findUnique({
        where: { id: editionId },
        select: { id: true, cashFloatCount: true, cashFloatCountedAt: true },
      })
      return e ? { ...e, conventionId: e.id, currency: null } : null
    },
    async enregistrerComptageDuFonds(editionId, comptage) {
      await prisma.event.update({ where: { id: editionId }, data: comptage })
    },
  },
  organisateurs: {
    async estOrganisateur(edition, userId) {
      return (await this.comptesDesOrganisateurs(edition)).includes(userId)
    },
    async comptesDesOrganisateurs(edition) {
      const [evenement, organisateurs] = await Promise.all([
        prisma.event.findUnique({ where: { id: edition.id }, select: { ownerId: true } }),
        prisma.editionOrganizer.findMany({
          where: { editionId: edition.id },
          select: { organizer: { select: { userId: true } } },
        }),
      ])
      return [
        ...new Set([
          ...(evenement ? [evenement.ownerId] : []),
          ...organisateurs.map((o) => o.organizer.userId),
        ]),
      ]
    },
  },
}

export function useTreasuryPorts(): TreasuryPorts {
  return ports
}
