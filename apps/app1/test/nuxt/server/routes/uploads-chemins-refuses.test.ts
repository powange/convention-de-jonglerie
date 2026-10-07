import { describe, it, expect, beforeEach, vi } from 'vitest'

const canManageTreasuryByIdMock = vi.hoisted(() => vi.fn())
const canManageArtistsByIdMock = vi.hoisted(() => vi.fn())
const getAuthSessionMock = vi.hoisted(() => vi.fn())

vi.mock('../../../../server/utils/permissions/edition-permissions', () => ({
  canManageTreasuryById: canManageTreasuryByIdMock,
  canManageArtistsById: canManageArtistsByIdMock,
}))
vi.mock('../../../../server/utils/session-helpers', () => ({
  getAuthSession: getAuthSessionMock,
}))

const handler = (await import('../../../../server/routes/uploads/[...path].get')).default

/**
 * Les chemins que la route REFUSE avant même de chercher un fichier.
 *
 * ## Pourquoi ce fichier existe
 *
 * Cette couverture vivait sur `server/api/uploads/[...path].get.ts`, un SECOND gestionnaire de
 * fichiers, public et sans garde, qui doublait celui-ci. Il est supprimé — il ne lisait que
 * `public/uploads`, vide dans l'image, et rendait 404 en production là où celui-ci rend 200.
 *
 * ⚠️ Ses tests de traversée de chemin, eux, n'avaient AUCUN équivalent ici. Supprimer le fichier
 * sans les porter aurait retiré la seule preuve que `../` est refusé, sans qu'aucun test ne
 * devienne rouge. C'est précisément la perte de couverture qui ne se voit pas.
 *
 * ## Ce que chaque cas doit prouver
 *
 * Pas seulement le refus, mais qu'il arrive AVANT tout le reste : ni session consultée, ni disque
 * touché. Un refus prononcé plus tard serait fonctionnellement correct et pourtant plus fragile —
 * c'est l'ordre qui garantit qu'aucun chemin fabriqué n'atteint le système de fichiers.
 */
describe('route /uploads/** — les chemins refusés d’emblée', () => {
  const evenement = (path: string | undefined) =>
    ({
      context: { params: path === undefined ? {} : { path } },
      node: { req: { headers: {}, method: 'GET' }, res: {} },
    }) as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('la traversée de chemin', () => {
    const FABRIQUES = [
      ['remonter d’un cran', '../../../etc/passwd'],
      ['remonter depuis un dossier légitime', 'editions/22/../../../etc/passwd'],
      ['à la mode Windows', '..\\..\\..\\windows\\system32\\config\\sam'],
      ['un `..` glissé au milieu', 'conventions/1/../../../../root/.ssh/id_rsa'],
      // `//` est refusé aussi : selon la normalisation, un double séparateur peut repartir de la
      // racine du système de fichiers au lieu du dossier des dépôts.
      ['un double séparateur', 'editions//22/affiche.jpg'],
      ['un chemin absolu déguisé', '//etc/passwd'],
    ] as const

    it.each(FABRIQUES)('refuse %s', async (_nom, chemin) => {
      await expect(handler(evenement(chemin))).rejects.toThrow('Access denied')
    })

    it('refuse AVANT de consulter la session ou le disque', async () => {
      /*
       * L'assertion qui rend ces cas non creux. Un `../` finit de toute façon sur un fichier
       * absent, donc en 404 : vérifier le seul rejet laisserait le test vert avec la protection
       * retirée. Ce qui la distingue, c'est que le refus tombe avant tout le reste.
       */
      await expect(handler(evenement('../../../etc/passwd'))).rejects.toThrow('Access denied')

      expect(getAuthSessionMock).not.toHaveBeenCalled()
      expect(canManageTreasuryByIdMock).not.toHaveBeenCalled()
      expect(canManageArtistsByIdMock).not.toHaveBeenCalled()
    })

    it('refuse même un `..` sur un chemin de justificatif', async () => {
      // Le domaine protégé ne change rien : la traversée est examinée d'abord, et c'est voulu —
      // la garde n'a pas à se prononcer sur un chemin qui n'aurait jamais dû être accepté.
      await expect(
        handler(evenement('conventions/1/editions/22/treasury/../../../../etc/passwd'))
      ).rejects.toThrow('Access denied')

      expect(getAuthSessionMock).not.toHaveBeenCalled()
    })
  })

  describe('le chemin absent', () => {
    it('refuse un chemin vide', async () => {
      await expect(handler(evenement(''))).rejects.toThrow('Path is required')
    })

    it('refuse un chemin non fourni', async () => {
      await expect(handler(evenement(undefined))).rejects.toThrow('Path is required')
    })
  })

  describe('ce qui n’est pas refusé d’emblée', () => {
    it('laisse passer un chemin ordinaire, qui finit en 404 faute de fichier', async () => {
      /*
       * Le témoin négatif de tout ce fichier : sans lui, une route qui refuserait TOUT passerait
       * chacun des cas ci-dessus. Le message distingue les deux refus — « File not found » et non
       * « Access denied ».
       */
      await expect(handler(evenement('editions/22/jamais-deposee.jpg'))).rejects.toThrow(
        'File not found'
      )
    })
  })
})
