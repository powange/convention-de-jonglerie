/**
 * Câblage du layer carte pour app1 : la carte appartient à une ÉDITION (cf.
 * layers/map/server/ports/types.ts ; Flowvent fournit le sien, sur ses événements).
 */
import type { MapPorts } from '#map/server/ports/types'

const ports: MapPorts = {
  lireDrapeaux: (editionId) =>
    prisma.edition.findUnique({
      where: { id: editionId },
      select: { id: true, siteMapEnabled: true, mapPublic: true },
    }),
  async lireNom(editionId) {
    const e = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { name: true, convention: { select: { name: true } } },
    })
    return e ? e.name || e.convention.name : null
  },
  enregistrerVisibilite: (editionId, mapPublic) =>
    prisma.edition.update({
      where: { id: editionId },
      data: { mapPublic },
      select: { id: true, mapPublic: true },
    }),
  enregistrerCarteExterne: (editionId, carte) =>
    prisma.edition.update({
      where: { id: editionId },
      data: { externalMapProvider: carte.provider, externalMapRef: carte.ref },
      select: { id: true, externalMapProvider: true, externalMapRef: true },
    }),
}

export function useMapPorts(): MapPorts {
  return ports
}
