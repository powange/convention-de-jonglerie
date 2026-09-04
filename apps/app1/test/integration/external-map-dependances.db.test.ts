import { describe, it, expect } from 'vitest'

import { prismaTest } from '../setup-db'

/**
 * L'écran d'import d'une carte externe compte ce qui dépend de chaque zone et de chaque point
 * déjà importés — spectacles, ateliers, stock — pour avertir avant qu'un réimport ne les casse.
 *
 * Ce décompte demandait une relation `shows` qui n'a jamais existé sur aucun des deux modèles :
 * la sélection étant partagée, les DEUX requêtes échouaient, l'endpoint répondait en erreur, et
 * l'avertissement n'a jamais pu s'afficher.
 *
 * Un test d'interface n'aurait rien prouvé : c'est Prisma qui refuse la sélection, et seule une
 * vraie requête le montre.
 */
describe.skipIf(!process.env.TEST_WITH_DB)('Carte externe — décompte des dépendances', () => {
  const selection = {
    id: true,
    _count: {
      select: {
        showPerformances: true,
        workshopLocations: true,
        stockItems: true,
        stockReservations: true,
      },
    },
  } as const

  it('la sélection des zones est acceptée par Prisma', async () => {
    await expect(
      prismaTest.editionZone.findMany({ take: 1, select: selection })
    ).resolves.toBeDefined()
  })

  it('la sélection des points de repère est acceptée par Prisma', async () => {
    await expect(
      prismaTest.editionMarker.findMany({ take: 1, select: selection })
    ).resolves.toBeDefined()
  })

  it('la relation « shows » n’existe sur aucun des deux modèles', async () => {
    // Verrouille la cause plutôt que le seul symptôme : si un jour une relation `shows` apparaît,
    // ce test le signalera et l'on saura reconsidérer le nom retenu ici.
    const fautive = { id: true, _count: { select: { shows: true } } } as any
    await expect(prismaTest.editionZone.findMany({ take: 1, select: fautive })).rejects.toThrow(
      /Unknown field `shows`/
    )
    await expect(prismaTest.editionMarker.findMany({ take: 1, select: fautive })).rejects.toThrow(
      /Unknown field `shows`/
    )
  })
})
