import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRequireAdmin = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/admin-auth', () => ({
  requireGlobalAdminWithDbCheck: mockRequireAdmin,
}))

const mockFetchResourceOrFail = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/prisma-helpers', () => ({
  fetchResourceOrFail: mockFetchResourceOrFail,
}))

vi.mock('#server/utils/validation-helpers', () => ({
  validateUserId: () => 426,
  checkEmailUniqueness: vi.fn(),
  checkPseudoUniqueness: vi.fn(),
}))

import modifier from '../../../../../server/api/admin/users/[id].put'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Les informations de santé, modifiables depuis la fiche d'un utilisateur.
 *
 * Elles n'étaient ni rendues ni acceptées par ce point d'API : un administrateur voyait le nom et
 * le téléphone d'une personne, mais pas son allergie — alors que c'est précisément ce qu'on vient
 * corriger quand quelqu'un appelle pour signaler une erreur de saisie.
 *
 * Ce que ces tests tiennent, ce n'est pas le chemin nominal mais les deux règles qui évitent
 * d'abîmer des données que l'intéressé a saisies lui-même : un champ NON TRANSMIS ne doit rien
 * effacer, et une gravité ne survit pas à l'allergie qu'elle qualifiait.
 */
describe('PUT /api/admin/users/[id] — les informations de santé', () => {
  const identite = {
    email: 'a@x.fr',
    pseudo: 'alice',
    prenom: 'Alice',
    nom: 'Martin',
  }

  const donneesEcrites = () => prismaMock.user.update.mock.calls[0]?.[0]?.data ?? {}

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ id: 1, isGlobalAdmin: true })
    mockFetchResourceOrFail.mockResolvedValue({ id: 426, email: 'a@x.fr', pseudo: 'alice' })
    prismaMock.user.update.mockResolvedValue({ id: 426 })
    global.readBody = vi.fn()
  })

  it('enregistre allergie, gravité et téléphone d’urgence', () => {
    global.readBody = vi.fn(async () => ({
      ...identite,
      allergies: '  arachides  ',
      allergySeverity: 'SEVERE',
      emergencyContactPhone: '  +33612345678  ',
    }))

    return modifier({} as any).then(() => {
      const data = donneesEcrites()
      // Rognés, comme le fait le formulaire du profil : un espace collé au début d'une allergie
      // se retrouverait dans la liste imprimée qui part en cuisine.
      expect(data.allergies).toBe('arachides')
      expect(data.allergySeverity).toBe('SEVERE')
      expect(data.emergencyContactPhone).toBe('+33612345678')
    })
  })

  it('N’EFFACE PAS un champ que la requête ne porte pas', () => {
    // La règle qui compte. Sans elle, un appel qui ne transmet que l'identité — une correction de
    // pseudo, par exemple — remettrait à néant une allergie que l'intéressé avait déclarée, sans
    // que personne ne s'en aperçoive avant le service des repas.
    global.readBody = vi.fn(async () => ({ ...identite }))

    return modifier({} as any).then(() => {
      const data = donneesEcrites()
      expect(data).not.toHaveProperty('allergies')
      expect(data).not.toHaveProperty('allergySeverity')
      expect(data).not.toHaveProperty('emergencyContactPhone')
    })
  })

  it('accepte de VIDER un champ transmis à vide', () => {
    // À distinguer du cas précédent : ici l'administrateur efface délibérément. `null` doit
    // arriver en base, sans quoi le champ resterait à sa valeur d'avant.
    global.readBody = vi.fn(async () => ({
      ...identite,
      allergies: '   ',
      emergencyContactPhone: '',
    }))

    return modifier({} as any).then(() => {
      const data = donneesEcrites()
      expect(data.allergies).toBeNull()
      expect(data.emergencyContactPhone).toBeNull()
    })
  })

  it('REFUSE une gravité qui n’est pas un des quatre niveaux', () => {
    global.readBody = vi.fn(async () => ({ ...identite, allergySeverity: 'TRÈS_GRAVE' }))
    return expect(modifier({} as any)).rejects.toThrow()
  })

  it('REFUSE un téléphone d’urgence mal formé', () => {
    // Le même schéma que le profil : un numéro que le formulaire de l'intéressé refuse ne doit
    // pas entrer par la porte de l'administration.
    global.readBody = vi.fn(async () => ({
      ...identite,
      emergencyContactPhone: '06 pas un numéro',
    }))
    return expect(modifier({} as any)).rejects.toThrow()
  })

  it('refuse une description d’allergie démesurée', () => {
    global.readBody = vi.fn(async () => ({ ...identite, allergies: 'a'.repeat(1001) }))
    return expect(modifier({} as any)).rejects.toThrow()
  })
})
