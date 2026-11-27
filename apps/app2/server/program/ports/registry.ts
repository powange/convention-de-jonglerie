/**
 * Câblage du layer programme pour Flowvent : les réglages sont portés par l'ÉVÉNEMENT, et il n'y
 * a pas d'ateliers (module workshops non porté) — la frise réunit les représentations de
 * spectacles et les éléments libres. Contrat : layers/program/server/ports/types.ts.
 */
import type { ProgramPorts } from '#program/server/ports/types'

const ports: ProgramPorts = {
  async lireReglages(editionId) {
    const e = await prisma.event.findUnique({
      where: { id: editionId },
      select: {
        programEnabled: true,
        programPagePublic: true,
        artistsEnabled: true,
        siteMapEnabled: true,
        mapPublic: true,
        timezone: true,
      },
    })
    return e ? { ...e, workshopsEnabled: false } : null
  },

  async enregistrerPagePublique(editionId, pagePublique) {
    await prisma.event.update({
      where: { id: editionId },
      data: { programPagePublic: pagePublique },
    })
  },

  // Pas d'ateliers dans Flowvent ; et sans `creerAtelier`, la conversion vers un atelier est refusée.
  lireAteliers: async () => [],
}

export function useProgramPorts(): ProgramPorts {
  return ports
}
