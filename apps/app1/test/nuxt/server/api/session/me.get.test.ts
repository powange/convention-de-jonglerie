import { describe, it, expect, beforeEach, vi } from 'vitest'

// Les mocks DOIVENT précéder l'import du gestionnaire.
vi.mock('../../../../../server/utils/impersonation-helpers', () => ({
  getImpersonationCookie: vi.fn(),
}))

import handler from '../../../../../server/api/session/me.get'
import { getImpersonationCookie } from '../../../../../server/utils/impersonation-helpers'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma
const mockImpersonation = getImpersonationCookie as ReturnType<typeof vi.fn>

const mockEvent = { context: { user: { id: 1 } } }

/** Ce que le `select` du gestionnaire ramène, et donc ce que `SessionMeUser` doit décrire. */
const compteEnBase = {
  id: 1,
  email: 'jean@example.com',
  emailHash: 'abc123',
  pendingEmail: 'nouvelle@example.com',
  pseudo: 'jean',
  nom: null,
  prenom: 'Jean',
  phone: null,
  pronouns: 'il/lui',
  profilePicture: null,
  isGlobalAdmin: false,
  isVolunteer: true,
  isArtist: false,
  isOrganizer: false,
  preferredLanguage: 'fr',
  dietaryPreference: 'NONE',
  allergies: null,
  allergySeverity: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-06-01'),
}

/**
 * Ce point d'API n'avait AUCUN test, alors qu'il est traversé à chaque chargement de page.
 *
 * Il en reçoit en même temps que deux corrections de contrat :
 *
 * - `SessionMeUser` omettait `pendingEmail` et `pronouns`, que le `select` ramène pourtant. Le
 *   client lisait le premier en `(authStore.user as any)?.pendingEmail`, à trois endroits ;
 * - le gestionnaire renvoyait `full || session.user`, un repli **inatteignable** — le middleware
 *   d'authentification refuse déjà la session d'un compte supprimé — et impossible à honorer,
 *   `session.user` n'étant qu'un `SessionUser` aux champs optionnels.
 */
describe('/api/session/me GET', () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockReset()
    mockImpersonation.mockReset().mockResolvedValue(null)
    /*
     * 📍 L'authentification passe par le CONTEXTE, pas par la session scellée.
     *
     * Le gestionnaire employait `requireUserSession` (de `#imports`), que le bouchon global de
     * `test/setup.ts` n'atteint pas pour du code serveur : mes quatre premiers cas tombaient sur
     * « requireUserSession is not a function », et AUCUN test de ce dépôt n'exerce un handler qui
     * l'emploie — c'est pourquoi ce point d'API n'en avait aucun. Il lit désormais le contexte,
     * posé par le middleware, ce qui le rend testable comme tous ses voisins.
     */
  })

  it('rend le compte lu en base, et non celui de la session', async () => {
    prismaMock.user.findUnique.mockResolvedValue(compteEnBase)

    /*
     * 📍 Pas de `.data` ici : ce gestionnaire renvoie un objet NU, là où ses voisins passent par
     * `createSuccessResponse`. Je l'avais supposé enveloppé, et les cas tombaient sur
     * « Cannot read properties of undefined ».
     */
    const resultat: any = await handler(mockEvent as any)

    expect(resultat.user.id).toBe(1)
    expect(resultat.user.pseudo).toBe('jean')
    expect(resultat.impersonation).toBeNull()
  })

  it('📍 porte `pendingEmail`, dont l’absence cassait l’écran du profil', async () => {
    /*
     * Le champ manquait au CONTRAT (`SessionMeUser`) alors que le gestionnaire le renvoie. Sans
     * lui, l'écran du profil ne peut pas rappeler qu'un changement d'adresse est en cours : on
     * tape une nouvelle adresse, on voit l'ancienne revenir au rechargement, et rien ne l'explique.
     */
    prismaMock.user.findUnique.mockResolvedValue(compteEnBase)

    const resultat: any = await handler(mockEvent as any)

    expect(resultat.user.pendingEmail).toBe('nouvelle@example.com')
    expect(resultat.user.pronouns).toBe('il/lui')
  })

  it('⚠️ refuse la session quand le compte n’existe plus en base', async () => {
    /*
     * La branche ajoutée. Elle est inatteignable en pratique — le middleware a déjà refusé la
     * session d'un compte supprimé — mais pas si la suppression survient ENTRE son contrôle et le
     * `findUnique` d'ici. Mieux vaut forcer la reconnexion que rendre un profil amputé.
     */
    prismaMock.user.findUnique.mockResolvedValue(null)

    await expect(handler(mockEvent as any)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('le témoin : rien n’est lu quand le compte est absent', async () => {
    // Sans ce cas, le précédent serait satisfait par un refus survenant APRÈS la composition de
    // la réponse — ce qui laisserait un chemin où `session.user` est encore employé.
    prismaMock.user.findUnique.mockResolvedValue(null)

    await expect(handler(mockEvent as any)).rejects.toBeDefined()
    expect(mockImpersonation).not.toHaveBeenCalled()
  })

  it('rend l’emprunt d’identité en cours quand il y en a un', async () => {
    prismaMock.user.findUnique.mockResolvedValue(compteEnBase)
    mockImpersonation.mockResolvedValue({
      active: true,
      originalUserId: 1,
      originalUserEmail: 'admin@example.com',
      originalUserPseudo: 'admin',
      originalUserNom: null,
      originalUserPrenom: null,
      targetUserId: 1,
      targetUserEmail: 'jean@example.com',
      startedAt: '2026-10-18T12:00:00.000Z',
    })

    const resultat: any = await handler(mockEvent as any)

    // Les noms de champs comptent : le contrat en déclarait deux qui n'existaient nulle part.
    expect(resultat.impersonation.originalUserPseudo).toBe('admin')
    expect(resultat.impersonation.startedAt).toBe('2026-10-18T12:00:00.000Z')
  })
})
