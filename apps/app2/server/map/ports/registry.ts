/**
 * Câblage du layer carte pour Flowvent : la carte appartient à un ÉVÉNEMENT (cf.
 * layers/map/server/ports/types.ts ; app1 fournit le sien, sur ses éditions).
 */
import type { MapPorts } from '#map/server/ports/types'

const ports: MapPorts = {
  lireDrapeaux: (editionId) =>
    prisma.event.findUnique({
      where: { id: editionId },
      select: { id: true, siteMapEnabled: true, mapPublic: true },
    }),
  enregistrerVisibilite: (editionId, mapPublic) =>
    prisma.event.update({
      where: { id: editionId },
      data: { mapPublic },
      select: { id: true, mapPublic: true },
    }),
  enregistrerCarteExterne: (editionId, carte) =>
    prisma.event.update({
      where: { id: editionId },
      data: { externalMapProvider: carte.provider, externalMapRef: carte.ref },
      select: { id: true, externalMapProvider: true, externalMapRef: true },
    }),
}

export function useMapPorts(): MapPorts {
  return ports
}
