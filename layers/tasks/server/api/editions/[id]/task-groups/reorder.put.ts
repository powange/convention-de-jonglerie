import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageTasks,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'

const bodySchema = z.object({
  /** Les identifiants dans leur nouvel ordre. */
  orderedIds: z.array(z.number().int().positive()).min(1).max(500),
})

/**
 * PUT /api/editions/[id]/task-groups/reorder
 *
 * Réordonne les groupes de tâches : chaque identifiant reçoit un `displayOrder` égal à son rang
 * dans le tableau.
 *
 * `TaskGroup.displayOrder` existait depuis l'origine — la création plaçait déjà le nouveau groupe
 * en dernier, et le point de modification acceptait le champ — mais rien ne permettait de le
 * changer depuis l'interface. L'ordre était donc figé sur celui de la création, et sur une édition
 * qui accumule des groupes au fil des mois, le plus utile finissait en bas.
 *
 * `PUT` et `orderedIds`, comme la FAQ, les zones, les marqueurs, les quotas et les tarifs. Le
 * réordonnancement des TÂCHES dans un groupe, lui, est en `POST` avec `taskIds` : c'est
 * l'exception du dépôt, et ce n'est pas elle qu'il fallait imiter.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!canManageTasks(edition, user)) {
      throw createError({
        status: 403,
        message: "Vous n'êtes pas autorisé à gérer les tâches de cette édition",
      })
    }

    const body = await readBody(event)
    let data: z.infer<typeof bodySchema>
    try {
      data = bodySchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) handleValidationError(error)
      throw error
    }

    // Tous les groupes nommés appartiennent-ils à CETTE édition ?
    //
    // Sans ce contrôle, un corps de requête forgé réordonnerait les groupes d'une autre convention.
    // La comparaison des longueurs rejette aussi les doublons, que `findMany` dédoublonne : un
    // `orderedIds` contenant deux fois le même identifiant produirait sinon un ordre incohérent.
    const groups = await prisma.taskGroup.findMany({
      where: { id: { in: data.orderedIds }, editionId },
      select: { id: true, displayOrder: true },
    })
    if (groups.length !== data.orderedIds.length) {
      throw createError({
        status: 400,
        message: "Certains groupes n'appartiennent pas à cette édition",
      })
    }

    // On n'écrit que ce qui CHANGE : déplacer un groupe d'un rang n'en dérange que deux. La
    // position actuelle vient de la vérification ci-dessus, donc sans requête supplémentaire.
    const positionActuelle = new Map(groups.map((g) => [g.id, g.displayOrder]))
    const aEcrire = data.orderedIds
      .map((id, index) => ({ id, index }))
      .filter(({ id, index }) => positionActuelle.get(id) !== index)

    if (aEcrire.length > 0) {
      // Défense en profondeur : `updateMany` redit `editionId` dans chaque écriture, si bien qu'une
      // ligne qui aurait changé d'édition entre la vérification et l'écriture ne serait pas touchée.
      await prisma.$transaction(
        aEcrire.map(({ id, index }) =>
          prisma.taskGroup.updateMany({
            where: { id, editionId },
            data: { displayOrder: index },
          })
        )
      )
    }

    return createSuccessResponse({ reordered: aEcrire.length })
  },
  { operationName: 'ReorderTaskGroups' }
)
