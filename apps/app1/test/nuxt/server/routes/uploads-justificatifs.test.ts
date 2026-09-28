import { describe, it, expect, beforeEach, vi } from 'vitest'

const canManageTreasuryByIdMock = vi.hoisted(() => vi.fn())
const getAuthSessionMock = vi.hoisted(() => vi.fn())

vi.mock('../../../../server/utils/permissions/edition-permissions', () => ({
  canManageTreasuryById: canManageTreasuryByIdMock,
}))
vi.mock('../../../../server/utils/session-helpers', () => ({
  getAuthSession: getAuthSessionMock,
}))

const handler = (await import('../../../../server/routes/uploads/[...path].get')).default

/**
 * Qui peut lire un justificatif de trésorerie ?
 *
 * Cette route sert tout `/uploads/**` et n'est PAS sous `/api/` : le middleware d'authentification
 * ne la voit pas. Tout ce qu'elle servait était donc public dès qu'on connaissait l'URL — acceptable
 * pour l'affiche d'une édition, faite pour être vue, mais pas pour une pièce comptable. Une facture
 * porte un RIB, un remboursement porte le nom d'un bénévole, et l'URL circule : copie d'écran,
 * historique partagé, lien collé dans une discussion.
 *
 * Refus en **404** et non en 403 : un 403 confirmerait l'existence du fichier, donc celle de la
 * pièce, à quelqu'un qui n'a pas à le savoir.
 *
 * ## CE QUE CE FICHIER NE TESTE PAS, ET POURQUOI
 *
 * Le cas « le fichier est bien servi » n'y est pas. Il demanderait de remplacer le `stat` de
 * `node:fs/promises`, et ce mock **n'a aucun effet sur cette route** : dans l'environnement Nuxt,
 * elle passe par une transformation serveur où les modules natifs sont externalisés, si bien que le
 * vrai `stat` continue d'être appelé — sur un fichier absent, donc un 404. C'est-à-dire le code que
 * rend aussi un refus de la garde : les deux causes deviennent indistinguables, et un test qui ne
 * sait pas les séparer ne prouve rien. (Constaté : `stat` remplacé côté test, jamais appelé côté
 * route, les deux spécificateurs `fs/promises` et `node:fs/promises` essayés.)
 *
 * Ce qui reste testable est précisément ce qui compte : le REFUS, et le fait que la garde ne
 * s'applique qu'aux chemins de trésorerie. Ce second point se vérifie sans servir aucun fichier —
 * il suffit de constater qu'aucune session n'est même demandée.
 */
describe('route /uploads/** — les justificatifs de trésorerie', () => {
  const evenement = (path: string) =>
    ({
      context: { params: { path } },
      node: { req: { headers: {} } },
    }) as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('le dossier définitif d’une édition', () => {
    const CHEMIN = 'conventions/7/editions/21/treasury/facture-a1b2c3d4.pdf'

    it('refuse un visiteur anonyme', async () => {
      getAuthSessionMock.mockResolvedValue(null)

      await expect(handler(evenement(CHEMIN))).rejects.toThrow('File not found')

      /*
       * L'assertion qui rend ce test non creux.
       *
       * Sans la garde, cette route rend DÉJÀ 404 pour ce chemin, faute de fichier réel : vérifier le
       * seul refus laisserait le test vert avec la garde retirée. Ce qui distingue les deux, c'est
       * que la garde interroge la session. Éprouvé en la retirant : ce test tombe alors, et lui
       * seul le dirait.
       */
      expect(getAuthSessionMock).toHaveBeenCalled()
      // Le droit, en revanche, n'est pas interrogé : sans session, il n'y a personne à interroger.
      expect(canManageTreasuryByIdMock).not.toHaveBeenCalled()
    })

    it('refuse un utilisateur connecté sans droit sur la trésorerie', async () => {
      getAuthSessionMock.mockResolvedValue({ user: { id: 42 } })
      canManageTreasuryByIdMock.mockResolvedValue(false)

      await expect(handler(evenement(CHEMIN))).rejects.toThrow('File not found')
      // L'édition contrôlée est bien celle du chemin — 21, et non la convention 7.
      expect(canManageTreasuryByIdMock).toHaveBeenCalledWith(21, 42, expect.anything())
    })

    it('laisse passer la garde quand le droit est accordé', async () => {
      getAuthSessionMock.mockResolvedValue({ user: { id: 42 } })
      canManageTreasuryByIdMock.mockResolvedValue(true)

      // La suite échoue faute de fichier réel sur le disque, ce qui ne nous regarde pas ici : ce
      // qu'on vérifie, c'est que la garde a interrogé le droit au lieu de refuser d'emblée.
      await handler(evenement(CHEMIN)).catch(() => undefined)

      expect(canManageTreasuryByIdMock).toHaveBeenCalledWith(21, 42, expect.anything())
    })
  })

  describe('le dépôt temporaire', () => {
    // Un justificatif y séjourne le temps de remplir le formulaire : il est tout aussi lisible que
    // dans le dossier définitif, et doit donc être gardé de la même façon.
    const CHEMIN = 'temp/treasury/21/ticket-a1b2c3d4.jpg'

    it('refuse un visiteur anonyme', async () => {
      getAuthSessionMock.mockResolvedValue(null)

      await expect(handler(evenement(CHEMIN))).rejects.toThrow('File not found')
      // Même remarque que pour le dossier définitif : c'est l'interrogation de la session qui
      // prouve que la garde s'est appliquée, le 404 seul ne prouverait rien.
      expect(getAuthSessionMock).toHaveBeenCalled()
    })

    it('contrôle l’édition portée par le chemin temporaire', async () => {
      getAuthSessionMock.mockResolvedValue({ user: { id: 42 } })
      canManageTreasuryByIdMock.mockResolvedValue(true)

      await handler(evenement(CHEMIN)).catch(() => undefined)

      expect(canManageTreasuryByIdMock).toHaveBeenCalledWith(21, 42, expect.anything())
    })
  })

  describe('les autres dossiers, qui ne changent pas', () => {
    /*
     * La contrepartie indispensable. Si cette garde débordait, elle casserait toutes les images
     * publiques du site — affiches d'édition, logos de convention, images de spectacle — pour des
     * visiteurs qui n'ont aucun compte.
     *
     * Constaté sans servir aucun fichier : aucune session n'est demandée, donc aucun droit exigé.
     */
    const cheminsPublics = [
      'conventions/7/editions/21/affiche-a1b2c3d4.jpg',
      'conventions/7/logo-a1b2c3d4.png',
      'shows/12/image-a1b2c3d4.jpg',
      'profiles/42/avatar-a1b2c3d4.jpg',
      // Un dossier nommé `treasury` ailleurs n'ouvre pas la garde non plus : elle reconnaît une
      // forme de chemin, elle ne devine pas sur un mot.
      'treasury/ailleurs/fichier.jpg',
    ]

    it.each(cheminsPublics)('ne demande aucune session pour %s', async (chemin) => {
      getAuthSessionMock.mockResolvedValue(null)

      await handler(evenement(chemin)).catch(() => undefined)

      expect(getAuthSessionMock).not.toHaveBeenCalled()
      expect(canManageTreasuryByIdMock).not.toHaveBeenCalled()
    })
  })

  describe('les gardes qui existaient déjà', () => {
    it('refuse un chemin qui remonte', async () => {
      await expect(handler(evenement('conventions/../../etc/passwd'))).rejects.toThrow(
        'Access denied'
      )
    })

    it('refuse un chemin vide', async () => {
      await expect(handler({ context: { params: {} } } as any)).rejects.toThrow('Path is required')
    })

    it('refuse avant même de regarder la session', async () => {
      // L'ordre compte : un chemin qui remonte ne doit pas traverser la garde de trésorerie, d'où
      // elle pourrait tirer un identifiant d'édition trompeur.
      await handler(evenement('conventions/7/editions/21/treasury/../../../etc/passwd')).catch(
        () => undefined
      )

      expect(getAuthSessionMock).not.toHaveBeenCalled()
    })
  })
})
