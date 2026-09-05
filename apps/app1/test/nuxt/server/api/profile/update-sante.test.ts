import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import handler from '../../../../../server/api/profile/update.put'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Régime, allergies et contact d'urgence portés par le PROFIL.
 *
 * Ce fichier vise le vrai point d'API, à la différence de `update.put.test.ts` qui réimplémente
 * le handler à la main : celui-là éprouve une copie de la logique et resterait vert quoi qu'on
 * change dans `update.put.ts`.
 *
 * Le point délicat est l'écriture conditionnelle. Le profil est modifiable depuis plusieurs
 * écrans, et tous n'envoient pas les mêmes champs ; écrire systématiquement effacerait les
 * informations qu'un écran ignore — une allergie perdue parce qu'on a changé de pseudo ailleurs.
 */

const UTILISATEUR = {
  id: 1,
  email: 'test@example.com',
  pseudo: 'testuser',
  profilePicture: null,
}

const BASE = { email: UTILISATEUR.email, pseudo: UTILISATEUR.pseudo }

const appeler = async (corps: Record<string, unknown>) => {
  global.readBody = vi.fn().mockResolvedValue({ ...BASE, ...corps })
  return handler({ context: { user: UTILISATEUR } } as any)
}

/** Les données réellement écrites en base lors du dernier appel. */
const donneesEcrites = () => prismaMock.user.update.mock.calls.at(-1)[0].data

describe('PUT /api/profile/update — santé et contact d’urgence', () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockReset()
    prismaMock.user.update.mockReset()
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.user.update.mockResolvedValue({ id: 1, ...BASE })
  })

  it('enregistre les cinq informations', async () => {
    await appeler({
      dietaryPreference: 'VEGAN',
      allergies: 'Arachides',
      allergySeverity: 'SEVERE',
      emergencyContactName: 'Camille Dupont',
      emergencyContactPhone: '+33612345678',
    })

    expect(donneesEcrites()).toMatchObject({
      dietaryPreference: 'VEGAN',
      allergies: 'Arachides',
      allergySeverity: 'SEVERE',
      emergencyContactName: 'Camille Dupont',
      emergencyContactPhone: '+33612345678',
    })
  })

  it("n'efface rien quand la requête ne mentionne pas ces champs", async () => {
    await appeler({ nom: 'Nouveau nom' })

    const donnees = donneesEcrites()
    for (const champ of [
      'dietaryPreference',
      'allergies',
      'allergySeverity',
      'emergencyContactName',
      'emergencyContactPhone',
    ]) {
      expect(donnees, `${champ} ne devrait pas figurer dans l'écriture`).not.toHaveProperty(champ)
    }
  })

  it('efface une valeur quand elle est explicitement vidée', async () => {
    await appeler({ allergies: null, allergySeverity: null, emergencyContactName: null })

    expect(donneesEcrites()).toMatchObject({
      allergies: null,
      allergySeverity: null,
      emergencyContactName: null,
    })
  })

  it('rejette un numéro de contact d’urgence qui n’existe pas', async () => {
    // Huit chiffres en France : la forme d'un numéro sans en être un.
    await expect(appeler({ emergencyContactPhone: '+3312345678' })).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('rejette une description d’allergies démesurée', async () => {
    await expect(appeler({ allergies: 'a'.repeat(1001) })).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('rejette un régime inconnu', async () => {
    await expect(appeler({ dietaryPreference: 'CARNIVORE' })).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('rend les cinq champs pour que l’écran se recharge sans deviner', async () => {
    await appeler({ dietaryPreference: 'VEGETARIAN' })

    const { select } = prismaMock.user.update.mock.calls.at(-1)[0]
    expect(select).toMatchObject({
      dietaryPreference: true,
      allergies: true,
      allergySeverity: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
    })
  })
})
