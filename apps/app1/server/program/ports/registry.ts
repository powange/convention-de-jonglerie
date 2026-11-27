/**
 * Câblage du layer programme pour app1 (Juggling Convention) : les réglages sont portés par
 * l'ÉDITION, et les ateliers (module workshops) existent. Contrat :
 * layers/program/server/ports/types.ts ; Flowvent fournit le sien, sur ses événements.
 */
import type { ProgramPorts } from '#program/server/ports/types'

const lieuDeCarte = { select: { id: true, name: true, color: true } }

const ports: ProgramPorts = {
  lireReglages: (editionId) =>
    prisma.edition.findUnique({
      where: { id: editionId },
      select: {
        programEnabled: true,
        programPagePublic: true,
        workshopsEnabled: true,
        artistsEnabled: true,
        siteMapEnabled: true,
        mapPublic: true,
        timezone: true,
      },
    }),

  async enregistrerPagePublique(editionId, pagePublique) {
    await prisma.edition.update({
      where: { id: editionId },
      data: { programPagePublic: pagePublique },
    })
  },

  lireAteliers: (editionId) =>
    prisma.workshop.findMany({
      where: { editionId },
      select: {
        id: true,
        title: true,
        description: true,
        startDateTime: true,
        endDateTime: true,
        location: { select: { name: true, zone: lieuDeCarte, marker: lieuDeCarte } },
      },
    }),

  async creerAtelier(tx, element) {
    // Le lieu d'un workshop est une entité à part, réutilisée d'un workshop à l'autre. On
    // retrouve celui qui porte le même nom plutôt que d'en semer un nouveau à chaque conversion.
    let locationId: number | null = null
    const nomDuLieu = element.locationName?.trim()
    if (nomDuLieu || element.zoneId || element.markerId) {
      const existant = await tx.workshopLocation.findFirst({
        where: {
          editionId: element.editionId,
          ...(nomDuLieu ? { name: nomDuLieu } : {}),
          ...(element.zoneId ? { zoneId: element.zoneId } : {}),
          ...(element.markerId ? { markerId: element.markerId } : {}),
        },
        select: { id: true },
      })
      locationId =
        existant?.id ??
        (
          await tx.workshopLocation.create({
            data: {
              editionId: element.editionId,
              // Un lieu de workshop a besoin d'un nom : à défaut, celui du créneau fait foi.
              name: nomDuLieu || element.title,
              zoneId: element.zoneId,
              markerId: element.markerId,
            },
            select: { id: true },
          })
        ).id
    }
    return tx.workshop.create({
      data: {
        editionId: element.editionId,
        creatorId: element.creatorId,
        title: element.title,
        description: element.description,
        startDateTime: element.startDateTime,
        endDateTime: element.endDateTime,
        locationId,
      },
      select: { id: true },
    })
  },
}

export function useProgramPorts(): ProgramPorts {
  return ports
}
