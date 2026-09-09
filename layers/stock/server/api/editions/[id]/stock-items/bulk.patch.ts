import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { changementsEnLot } from '#server/utils/modification-lot-stock'
import {
  canManageStock,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateReservationLocation } from '#server/utils/stock-helpers'
import { assertTagsBelongToEdition } from '#server/utils/stock-tags-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'

/**
 * Chaque champ est **facultatif** : absent, il n'est pas touché. C'est ce qui distingue « laisser
 * tel quel » de « vider », que l'écran exprime par une case à cocher devant chaque champ. Sans
 * cette distinction, modifier le seul groupe effacerait l'emplacement de toute la sélection.
 *
 * `null` veut donc dire « vider », et l'absence « ne pas y toucher ».
 */
const bodySchema = z.object({
  itemIds: z.array(z.number().int().positive()).min(1).max(200),
  stockGroupId: z.number().int().positive().optional(),
  location: z.string().trim().max(200).nullable().optional(),
  zoneId: z.number().int().positive().nullable().optional(),
  markerId: z.number().int().positive().nullable().optional(),
  ownerContact: z.string().trim().max(500).nullable().optional(),
  returnDueAt: z.string().datetime().nullable().optional(),
  pickupLocation: z.string().trim().max(500).nullable().optional(),
  pickupResponsibleId: z.number().int().positive().nullable().optional(),
  pickupContact: z.string().trim().max(500).nullable().optional(),
  returnLocation: z.string().trim().max(500).nullable().optional(),
  returnResponsibleId: z.number().int().positive().nullable().optional(),
  returnContact: z.string().trim().max(500).nullable().optional(),
  // Ajouts et retraits séparés : remplacer la liste ferait perdre les tags que chaque objet porte
  // déjà et qu'on ne voulait pas toucher.
  addTagIds: z.array(z.number().int().positive()).optional(),
  removeTagIds: z.array(z.number().int().positive()).optional(),
})

/**
 * PATCH /api/editions/[id]/stock-items/bulk
 *
 * Applique les mêmes changements à plusieurs objets, en une transaction. Un identifiant étranger
 * à l'édition fait échouer l'ensemble : mieux vaut ne rien modifier que la moitié d'une sélection,
 * sans savoir laquelle.
 *
 * Les champs propres à l'emprunt ne s'appliquent qu'au matériel effectivement prêté. Les poser
 * ailleurs créerait des données que rien n'affiche — la fiche masque ce bloc hors emprunt.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!canManageStock(edition, user)) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const body = await readBody(event)
    let data: z.infer<typeof bodySchema>
    try {
      data = bodySchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) handleValidationError(error)
      throw error
    }

    const itemIds = Array.from(new Set(data.itemIds))

    // Tous les objets doivent appartenir à cette édition : sans ce contrôle, un identifiant
    // emprunté ailleurs se modifierait avec la permission d'ici.
    const objets = await prisma.stockItem.findMany({
      where: { id: { in: itemIds }, group: { editionId } },
      select: { id: true, isExternalLoan: true },
    })
    if (objets.length !== itemIds.length) {
      throw createError({
        status: 400,
        message: "Certains objets n'appartiennent pas à cette édition",
      })
    }

    if (data.stockGroupId !== undefined) {
      const groupeCible = await prisma.stockGroup.findFirst({
        where: { id: data.stockGroupId, editionId },
        select: { id: true },
      })
      if (!groupeCible) {
        throw createError({
          status: 400,
          message: "Le groupe cible n'appartient pas à cette édition",
        })
      }
    }

    const toucheEmplacement =
      data.location !== undefined || data.zoneId !== undefined || data.markerId !== undefined
    if (toucheEmplacement) {
      if (data.zoneId && data.markerId) {
        throw createError({
          status: 400,
          message: 'Un emplacement ne peut pas être à la fois une zone et un marqueur',
        })
      }
      await validateReservationLocation(
        { zoneId: data.zoneId ?? null, markerId: data.markerId ?? null },
        editionId
      )
    }

    await assertTagsBelongToEdition(editionId, [
      ...(data.addTagIds ?? []),
      ...(data.removeTagIds ?? []),
    ])

    // Ce que la demande écrit vraiment — d'un côté les champs de tout le matériel, de l'autre ceux
    // du seul matériel emprunté. La règle est éprouvée à part : cf. `modification-lot-stock`.
    const { communs, emprunt } = changementsEnLot(data)

    const idsEmpruntes = objets.filter((o) => o.isExternalLoan).map((o) => o.id)
    const aAjouter = Array.from(new Set(data.addTagIds ?? []))
    const aRetirer = Array.from(new Set(data.removeTagIds ?? []))

    await prisma.$transaction(async (tx) => {
      if (Object.keys(communs).length > 0) {
        await tx.stockItem.updateMany({ where: { id: { in: itemIds } }, data: communs })
      }

      if (Object.keys(emprunt).length > 0 && idsEmpruntes.length > 0) {
        await tx.stockItem.updateMany({ where: { id: { in: idsEmpruntes } }, data: emprunt })
      }

      if (aRetirer.length > 0) {
        await tx.stockTagAssignment.deleteMany({
          where: { stockItemId: { in: itemIds }, tagId: { in: aRetirer } },
        })
      }

      if (aAjouter.length > 0) {
        // `skipDuplicates` plutôt qu'un relevé préalable : reposer un tag déjà présent ne doit
        // rien changer, et la contrainte d'unicité dit déjà ce qui existe.
        await tx.stockTagAssignment.createMany({
          data: itemIds.flatMap((stockItemId) => aAjouter.map((tagId) => ({ stockItemId, tagId }))),
          skipDuplicates: true,
        })
      }
    })

    return createSuccessResponse({
      modifies: itemIds.length,
      /** Combien d'objets étaient concernés par les champs d'emprunt : l'écran peut le rappeler. */
      empruntsModifies: Object.keys(emprunt).length > 0 ? idsEmpruntes.length : 0,
    })
  },
  { operationName: 'BulkUpdateStockItems' }
)
