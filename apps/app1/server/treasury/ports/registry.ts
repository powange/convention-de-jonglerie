/**
 * Câblage du layer trésorerie pour app1 (contrat d'hôte, cf. layers/treasury/server/ports/types.ts) :
 * l'édition et la convention qui porte son plan comptable ; les organisateurs sont ceux de la
 * convention.
 */
import type { TreasuryPorts } from '#treasury/server/ports/types'

const ports: TreasuryPorts = {
  edition: {
    lire: (editionId) =>
      prisma.edition.findUnique({
        where: { id: editionId },
        select: {
          id: true,
          conventionId: true,
          currency: true,
          cashFloatCount: true,
          cashFloatCountedAt: true,
        },
      }),
    async enregistrerComptageDuFonds(editionId, comptage) {
      await prisma.edition.update({ where: { id: editionId }, data: comptage })
    },
  },
  organisateurs: {
    async estOrganisateur(edition, userId) {
      return !!(await prisma.conventionOrganizer.findFirst({
        where: { conventionId: edition.conventionId, userId },
        select: { userId: true },
      }))
    },
    async comptesDesOrganisateurs(edition) {
      const organisateurs = await prisma.conventionOrganizer.findMany({
        where: { conventionId: edition.conventionId },
        select: { userId: true },
      })
      return organisateurs.map((o) => o.userId)
    },
  },
}

export function useTreasuryPorts(): TreasuryPorts {
  return ports
}
