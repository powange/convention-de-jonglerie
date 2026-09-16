import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  articlesARemettreActifs,
  exigerArticlesARemettreActifs,
} from '../../../../server/utils/ticketing/handout-items-actifs'

/**
 * L'interrupteur « articles à remettre », et ce qu'il coupe.
 *
 * Il ne rangeait que l'entrée de menu : la page de configuration restait accessible par son
 * adresse, les points d'API acceptaient les écritures, et le guichet continuait de réclamer des
 * articles. Un interrupteur qui ne coupe rien invite à croire que la fonctionnalité est éteinte
 * alors qu'elle tourne.
 *
 * ⚠️ C'est un écart ASSUMÉ avec le reste du projet : aucun autre module ne refuse ses pages ni
 * ses points d'API quand son drapeau est éteint.
 */
const trouverEdition = vi.fn()

vi.stubGlobal('prisma', { edition: { findUnique: trouverEdition } })
vi.stubGlobal('createError', (options: { status: number; message: string }) => {
  const erreur = new Error(options.message) as Error & { status: number }
  erreur.status = options.status
  return erreur
})

describe('articlesARemettreActifs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rend vrai quand l’édition l’active', async () => {
    trouverEdition.mockResolvedValue({ ticketingHandoutItemsEnabled: true })

    expect(await articlesARemettreActifs(21)).toBe(true)
  })

  it('rend faux quand l’édition l’éteint', async () => {
    trouverEdition.mockResolvedValue({ ticketingHandoutItemsEnabled: false })

    expect(await articlesARemettreActifs(21)).toBe(false)
  })

  it('rend VRAI pour une édition introuvable', async () => {
    // Rendre faux transformerait un 404 en 403 trompeur : l'absence d'édition est déjà traitée
    // par les contrôles de droits des points d'API.
    trouverEdition.mockResolvedValue(null)

    expect(await articlesARemettreActifs(999)).toBe(true)
  })

  it('n’interroge que le drapeau, pas toute l’édition', async () => {
    trouverEdition.mockResolvedValue({ ticketingHandoutItemsEnabled: true })

    await articlesARemettreActifs(21)

    expect(trouverEdition).toHaveBeenCalledWith({
      where: { id: 21 },
      select: { ticketingHandoutItemsEnabled: true },
    })
  })
})

describe('exigerArticlesARemettreActifs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('laisse passer quand la fonctionnalité est active', async () => {
    trouverEdition.mockResolvedValue({ ticketingHandoutItemsEnabled: true })

    await expect(exigerArticlesARemettreActifs(21)).resolves.toBeUndefined()
  })

  it('REFUSE en 403 quand elle est éteinte', async () => {
    trouverEdition.mockResolvedValue({ ticketingHandoutItemsEnabled: false })

    await expect(exigerArticlesARemettreActifs(21)).rejects.toMatchObject({
      status: 403,
    })
  })
})
