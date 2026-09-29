import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

// Le module que `#imports` réexporte, et le point de simulation que le dépôt emploie déjà
// (cf. `auth/reset-password.test.ts`). Simuler `#imports` lui-même écraserait les autres stubs
// posés par `test/setup.ts` — un fichier de tests a déjà été perdu ainsi.
vi.mock('nuxt-auth-utils', () => ({
  clearUserSession: vi.fn(),
}))

import { clearUserSession } from 'nuxt-auth-utils'

import handler from '../../../../../server/api/profile/delete-account.delete'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Supprimer son propre compte — un point d'API qui n'avait aucun test.
 *
 * Ce qu'il porte n'est pas anodin : une suppression définitive, gardée par trois contrôles qui
 * peuvent chacun disparaître sans que rien ne le signale. Un pseudo de confirmation qui cesserait
 * d'être comparé laisserait n'importe quel clic effacer un compte ; et la session laissée ouverte
 * après la suppression rendrait la page suivante incohérente — un utilisateur connecté sans compte.
 *
 * ⚠️ La session se simule sur `nuxt-auth-utils` et NON sur `#imports` : `test/setup.ts` remplace
 * déjà ce dernier en entier, et un second `vi.mock('#imports')` local écraserait ses autres stubs —
 * un fichier de tests a déjà été perdu pour cette raison.
 */

const MOI = 42

const compte = {
  id: MOI,
  pseudo: 'jongleur',
  email: 'jongleur@exemple.test',
  isGlobalAdmin: false,
}

const evenement = { context: { user: { id: MOI } } }

const supprimer = async (corps: Record<string, unknown>) => {
  global.readBody = vi.fn().mockResolvedValue(corps)
  return handler(evenement as any)
}

describe('DELETE /api/profile/delete-account', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.user.findUnique.mockResolvedValue(compte)
    prismaMock.user.delete.mockResolvedValue(compte)
  })

  it('refuse sans pseudo de confirmation', async () => {
    await expect(supprimer({})).rejects.toMatchObject({ statusCode: 400 })
    expect(prismaMock.user.delete).not.toHaveBeenCalled()
  })

  it('refuse un pseudo qui ne correspond pas', async () => {
    // La confirmation existe pour qu'un clic seul ne suffise pas : c'est le seul garde-fou entre
    // l'utilisateur et une suppression définitive.
    await expect(supprimer({ confirmPseudo: 'Jongleur' })).rejects.toMatchObject({
      statusCode: 400,
    })
    expect(prismaMock.user.delete).not.toHaveBeenCalled()
  })

  it('refuse un administrateur global', async () => {
    // Se retirer soi-même les droits d'administration laisserait la plateforme sans personne pour
    // les rendre. Le refus est délibéré, et il doit survivre aux remaniements.
    prismaMock.user.findUnique.mockResolvedValue({ ...compte, isGlobalAdmin: true })

    await expect(supprimer({ confirmPseudo: 'jongleur' })).rejects.toMatchObject({
      statusCode: 403,
    })
    expect(prismaMock.user.delete).not.toHaveBeenCalled()
  })

  it('refuse un compte introuvable', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    await expect(supprimer({ confirmPseudo: 'jongleur' })).rejects.toMatchObject({
      statusCode: 404,
    })
    expect(prismaMock.user.delete).not.toHaveBeenCalled()
  })

  it('supprime le compte ET ferme la session', async () => {
    const reponse: any = await supprimer({ confirmPseudo: 'jongleur' })

    expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { id: MOI } })
    // Les deux, et pas seulement le premier : une session laissée ouverte sur un compte effacé
    // rend la page suivante incohérente, et rien à l'écran n'en donnerait la cause.
    expect(clearUserSession).toHaveBeenCalled()
    expect(reponse.data).toMatchObject({ deleted: true })
  })
})
