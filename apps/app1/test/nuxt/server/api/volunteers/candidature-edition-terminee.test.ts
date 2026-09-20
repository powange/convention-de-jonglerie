import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../../../../../../../layers/volunteers/server/api/editions/[id]/volunteers/applications/index.post'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Le serveur refuse une candidature sur une édition terminée.
 *
 * La règle elle-même est couverte ailleurs (`test/unit/utils/visibilite-benevoles.test.ts`). Ce
 * qui se vérifie ici est qu'elle est appliquée **par le serveur**, et pas seulement par l'écran :
 * un formulaire de candidature peut rester ouvert dans un onglet des semaines durant, et la page
 * qui l'entoure ne sera pas rechargée avant l'envoi.
 *
 * Le refus doit aussi tomber AVANT toute écriture — une candidature enregistrée sur une édition
 * passée n'a aucun écran pour la traiter, et personne ne la verra jamais.
 */

const JOUR = 24 * 60 * 60 * 1000
const MOI = { id: 42, email: 'benevole@exemple.fr', pseudo: 'camille' }

/** Les réglages tels que l'endpoint les sélectionne, réduits à ce que la garde consulte. */
const reglages = (champs: Record<string, unknown> = {}) => ({
  open: true,
  teardownEndDate: new Date(Date.now() + 14 * JOUR),
  event: { edition: { endDate: new Date(Date.now() + 10 * JOUR) } },
  askDiet: false,
  askAllergies: false,
  askTimePreferences: false,
  askTeamPreferences: false,
  askPets: false,
  askMinors: false,
  askVehicle: false,
  askEmergencyContact: false,
  askCompanion: false,
  askAvoidList: false,
  askSkills: false,
  askExperience: false,
  ...champs,
})

describe('POST .../volunteers/applications — une édition terminée ne recrute plus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn().mockReturnValue('1')
    global.readBody = vi.fn().mockResolvedValue({ motivation: 'Je veux aider' })
    prismaMock.eventVolunteerSettings.findUnique.mockResolvedValue(reglages())
    prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(null)
  })

  const candidater = () => handler({ context: { user: MOI } } as any)

  it('refuse quand le démontage est fini, et n’écrit rien', async () => {
    // Les DEUX dates sont derrière nous : la règle retient délibérément la plus tardive, si
    // bien qu'une fin d'édition encore à venir tiendrait le recrutement ouvert — et ce serait
    // le bon comportement, un démontage saisi avant la fin de l'événement étant une erreur.
    prismaMock.eventVolunteerSettings.findUnique.mockResolvedValue(
      reglages({
        teardownEndDate: new Date(Date.now() - 2 * JOUR),
        event: { edition: { endDate: new Date(Date.now() - 5 * JOUR) } },
      })
    )

    await expect(candidater()).rejects.toThrow('Recrutement fermé')
    expect(prismaMock.editionVolunteerApplication.create).not.toHaveBeenCalled()
  })

  it('refuse sur la seule date de fin d’édition quand aucun démontage n’est déclaré', async () => {
    prismaMock.eventVolunteerSettings.findUnique.mockResolvedValue(
      reglages({
        teardownEndDate: null,
        event: { edition: { endDate: new Date(Date.now() - 10 * JOUR) } },
      })
    )

    await expect(candidater()).rejects.toThrow('Recrutement fermé')
    expect(prismaMock.editionVolunteerApplication.create).not.toHaveBeenCalled()
  })

  it('accepte encore pendant le démontage', async () => {
    // Le cas que la règle doit surtout préserver : une édition recrute pendant le montage,
    // pendant l'événement ET pendant le démontage. Fermer trop tôt coûte des bénévoles.
    prismaMock.eventVolunteerSettings.findUnique.mockResolvedValue(
      reglages({
        teardownEndDate: new Date(Date.now() + JOUR),
        event: { edition: { endDate: new Date(Date.now() - 2 * JOUR) } },
      })
    )

    // Le parcours complet écrit en base et dépasse le périmètre de ce test ; ce qui compte est
    // que la garde laisse passer, donc que l'échec, s'il y en a un, ne soit plus celui-là.
    await expect(candidater()).rejects.not.toThrow('Recrutement fermé')
  })

  it('reste ouvert si la fin d’édition est à venir, même démontage saisi avant', async () => {
    // Le pendant du test précédent, et la raison pour laquelle il porte deux dates : une saisie
    // incohérente ne doit pas couper le recrutement PENDANT l'événement.
    prismaMock.eventVolunteerSettings.findUnique.mockResolvedValue(
      reglages({
        teardownEndDate: new Date(Date.now() - 2 * JOUR),
        event: { edition: { endDate: new Date(Date.now() + 10 * JOUR) } },
      })
    )

    await expect(candidater()).rejects.not.toThrow('Recrutement fermé')
  })

  it('refuse toujours quand l’organisateur a fermé, édition à venir comprise', async () => {
    prismaMock.eventVolunteerSettings.findUnique.mockResolvedValue(reglages({ open: false }))

    await expect(candidater()).rejects.toThrow('Recrutement fermé')
  })
})
