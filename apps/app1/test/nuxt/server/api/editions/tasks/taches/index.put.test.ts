import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetEditionWithPermissions = vi.hoisted(() => vi.fn())
const mockCanManageTasks = vi.hoisted(() => vi.fn())
const mockAssertAssignees = vi.hoisted(() => vi.fn())

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  getEditionWithPermissions: mockGetEditionWithPermissions,
  canManageTasks: mockCanManageTasks,
}))
vi.mock('#server/utils/tasks-helpers', () => ({
  assertAssigneesAreAssignable: mockAssertAssignees,
  canCommentTask: vi.fn(),
}))
vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))
vi.mock('#server/utils/validation-schemas', () => ({
  handleValidationError: (e: unknown) => {
    throw e
  },
}))
vi.mock('#server/utils/notification-service', () => ({
  NotificationHelpers: { taskAssigned: vi.fn() },
  safeNotify: vi.fn(),
}))

const prismaMock = (globalThis as any).prisma
const mockUser = { id: 1, pseudo: 'testuser' }
const mockEdition = {
  id: 1,
  name: 'E',
  convention: { id: 10, name: 'C', authorId: 200, organizers: [] },
  organizerPermissions: [],
}
import handler from '../../../../../../../../../layers/tasks/server/api/editions/[id]/tasks/[taskId]/index.put'

const evenement = (body: unknown) => ({
  context: { params: { id: '1', taskId: '5' }, user: mockUser },
  __body: body,
})

/**
 * Modifier une tâche : statut, échéance, assignés, groupe.
 *
 * C'est le point le plus chargé du module. Ce qui s'y vérifie : on ne déplace pas une tâche vers
 * le groupe d'une AUTRE édition, et les assignés restent contrôlés.
 */
describe('PUT /api/editions/[id]/tasks/[taskId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEditionWithPermissions.mockResolvedValue(mockEdition)
    mockCanManageTasks.mockReturnValue(true)
    mockAssertAssignees.mockResolvedValue(undefined)
    prismaMock.task.findFirst.mockReset()
    prismaMock.taskGroup.findFirst.mockReset()
    prismaMock.task.update.mockReset()
    prismaMock.taskTag.findMany.mockReset()
    prismaMock.taskTagAssignment.deleteMany.mockReset()
    prismaMock.taskTagAssignment.createMany.mockReset()
    /*
     * ⚠️ `tagAssignments` EST OBLIGATOIRE DANS LE JEU D'ESSAI : l'omettre ne rend pas une liste
     * vide, cela fait LEVER sur `existing.tagAssignments.map(...)` dès qu'un déplacement est
     * demandé — et l'échec parle alors d'un `map` sur `undefined`, jamais de tags. Deux tags du
     * groupe 2, celui que la tâche quitte.
     */
    prismaMock.task.findFirst.mockResolvedValue({
      id: 5,
      taskGroupId: 2,
      title: 'T',
      assignments: [],
      tagAssignments: [{ tagId: 31 }, { tagId: 32 }],
    })
    prismaMock.taskGroup.findFirst.mockResolvedValue({ id: 3 })
    prismaMock.task.update.mockResolvedValue({ id: 5, status: 'DONE', assignments: [] })
    ;(globalThis as any).readBody = vi.fn(async (e: any) => e.__body)
  })

  it('met à jour la tâche', async () => {
    const result: any = await handler(evenement({ status: 'DONE' }) as any)
    expect(result.success).toBe(true)
    expect(prismaMock.task.update).toHaveBeenCalled()
  })

  it("refuse un groupe cible d'une autre édition", async () => {
    prismaMock.taskGroup.findFirst.mockResolvedValue(null)
    await expect(handler(evenement({ taskGroupId: 999 }) as any)).rejects.toThrow(
      "Le groupe cible n'appartient pas à cette édition"
    )
    expect(prismaMock.task.update).not.toHaveBeenCalled()
  })

  it('vérifie les assignés proposés', async () => {
    await handler(evenement({ assigneeIds: [4] }) as any)
    expect(mockAssertAssignees).toHaveBeenCalledWith(1, [4])
  })

  it('rejette une tâche introuvable', async () => {
    prismaMock.task.findFirst.mockResolvedValue(null)
    await expect(handler(evenement({ status: 'DONE' }) as any)).rejects.toThrow('Tâche introuvable')
  })

  it("n'écrit rien sans le droit de gérer les tâches", async () => {
    mockCanManageTasks.mockReturnValue(false)
    await expect(handler(evenement({ status: 'DONE' }) as any)).rejects.toThrow(
      'Droits insuffisants'
    )
    expect(prismaMock.task.update).not.toHaveBeenCalled()
  })
  /**
   * ⚠⚠ DÉPLACER UNE TÂCHE ÉTIQUETÉE — constat B1.
   *
   * La modale envoie TOUJOURS `tagIds`, pré-rempli depuis les étiquettes de la tâche, et y ajoute
   * `taskGroupId` au déplacement. Le handler retirait d'office les tags de l'ancien groupe puis
   * validait quand même `tagIds` contre le groupe CIBLE — c'est-à-dire exactement ce qu'il venait
   * de décider de jeter. Un tag étant scopé à son groupe, la réponse était un 400 garanti : une
   * tâche étiquetée était indéplaçable, et le message parlait de tags alors qu'on avait choisi un
   * groupe.
   *
   * 📍 CE QUE CES CAS VÉRIFIENT, ET POURQUOI ILS NE SONT PAS CREUX. Le bouchon central IGNORE
   * le `where` : rendre des lignes depuis `taskTag.findMany` ne prouve donc rien sur ce qui a été
   * DEMANDÉ. C'est la forme de l'appel — les identifiants soumis à la garde, et le groupe contre
   * lequel elle les mesure — qui porte la preuve, et un témoin négatif garde l'autre moitié : un
   * tag étranger aux deux groupes doit toujours être refusé.
   */
  describe('déplacement vers un autre groupe', () => {
    const deplacement = (tagIds: number[]) => evenement({ taskGroupId: 3, tagIds })

    it('⚠️ EMPORTE LA TÂCHE AVEC SES ANCIENS TAGS DANS LE CORPS, et les retire', async () => {
      const resultat: any = await handler(deplacement([31, 32]) as any)

      expect(resultat.success).toBe(true)
      // La garde n'est pas même interrogée : il n'y a rien à écrire, donc rien à valider.
      expect(prismaMock.taskTag.findMany).not.toHaveBeenCalled()
      expect(prismaMock.taskTagAssignment.deleteMany).toHaveBeenCalledWith({
        where: { taskId: 5, tagId: { in: [31, 32] } },
      })
      expect(prismaMock.taskTagAssignment.createMany).not.toHaveBeenCalled()
      expect(prismaMock.task.update).toHaveBeenCalled()
    })

    it('garde un tag DU GROUPE CIBLE, lui, et le valide contre ce groupe', async () => {
      /*
       * LE TÉMOIN POSITIF. Sans lui, retirer la validation ENTIÈRE satisferait le cas précédent —
       * et l'on pourrait alors poser sur une tâche le tag d'un groupe quelconque, ce que le
       * scopage des tags interdit.
       */
      prismaMock.taskTag.findMany.mockResolvedValue([{ id: 77 }])

      const resultat: any = await handler(deplacement([31, 77]) as any)

      expect(resultat.success).toBe(true)
      // Seul 77 est soumis à la garde : 31 part avec l'ancien groupe.
      expect(prismaMock.taskTag.findMany).toHaveBeenCalledWith({
        where: { id: { in: [77] }, taskGroupId: 3 },
        select: { id: true },
      })
      expect(prismaMock.taskTagAssignment.createMany).toHaveBeenCalledWith({
        data: [{ taskId: 5, tagId: 77 }],
        skipDuplicates: true,
      })
    })

    it('refuse toujours un tag étranger aux deux groupes', async () => {
      // La garde ne retrouve pas le tag demandé dans le groupe cible.
      prismaMock.taskTag.findMany.mockResolvedValue([])

      await expect(handler(deplacement([31, 999]) as any)).rejects.toThrow(
        "Certains tags n'appartiennent pas à ce groupe"
      )
      expect(prismaMock.task.update).not.toHaveBeenCalled()
    })
  })

  it('hors déplacement, un tag ajouté est validé contre le groupe de la tâche', async () => {
    /*
     * LE SECOND TÉMOIN, et il garde le chemin ORDINAIRE. Le correctif ne touche que la branche du
     * déplacement ; si quelqu'un la généralisait, poser un tag sur une tâche qui ne bouge pas
     * cesserait d'être contrôlé — et c'est le cas le plus fréquent de ce point d'API.
     */
    prismaMock.taskTag.findMany.mockResolvedValue([{ id: 41 }])

    await handler(evenement({ tagIds: [31, 41] }) as any)

    expect(prismaMock.taskTag.findMany).toHaveBeenCalledWith({
      where: { id: { in: [41] }, taskGroupId: 2 },
      select: { id: true },
    })
    // 32 n'est plus coché : il est retiré, et 31 conservé.
    expect(prismaMock.taskTagAssignment.deleteMany).toHaveBeenCalledWith({
      where: { taskId: 5, tagId: { in: [32] } },
    })
  })
})
