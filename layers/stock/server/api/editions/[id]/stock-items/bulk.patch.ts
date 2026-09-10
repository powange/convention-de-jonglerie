import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { erreurOrdreEmprunt } from '#server/utils/emprunt-stock'
import { changementsEnLot } from '#server/utils/modification-lot-stock'
import {
  canManageStock,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { assertResponsablesDeLEdition } from '#server/utils/personnes-edition'
import { MESSAGE_QUANTITE_MAX, QUANTITE_MAX_STOCK } from '#server/utils/quantite-stock'
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
  // Les deux jalons d'un emprunt : aller le chercher, puis le rapporter. En lot parce que le
  // camion revient d'un bloc, et qu'ouvrir quinze fiches pour cocher quinze cases n'a pas de sens.
  pickedUpAt: z.string().datetime().nullable().optional(),
  returnedAt: z.string().datetime().nullable().optional(),
  /**
   * Le comptage d'inventaire : une valeur par objet, et non la même pour tous.
   *
   * C'est ce qui distingue ce champ de tous les autres du lot. Une séance de comptage écrit
   * trente valeurs différentes en une fois, et les écrire une par une laisserait un inventaire à
   * moitié saisi si le réseau lâche au milieu — ce qui arrive, on compte dans un hangar.
   *
   * `null` efface le comptage : la ligne redevient « jamais comptée », qui n'est pas « comptée à
   * zéro ».
   */
  comptage: z
    .array(
      z.object({
        id: z.number().int().positive(),
        finalQuantity: z
          .number()
          .int()
          .min(0)
          .max(QUANTITE_MAX_STOCK, MESSAGE_QUANTITE_MAX)
          .nullable(),
      })
    )
    .max(200)
    .optional(),
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
      // Les jalons de chaque objet : la règle d'ordre se juge sur l'état APRÈS écriture, il faut
      // donc savoir où en est chacun.
      select: { id: true, isExternalLoan: true, pickedUpAt: true, returnedAt: true },
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

    // Un responsable désigné doit être de l'édition : c'était la seule référence du module
    // qui n'était pas confrontée à elle. Voir `personnes-edition`.
    await assertResponsablesDeLEdition(editionId, edition.conventionId, [
      data.pickupResponsibleId,
      data.returnResponsibleId,
    ])

    await assertTagsBelongToEdition(editionId, [
      ...(data.addTagIds ?? []),
      ...(data.removeTagIds ?? []),
    ])

    // Ce que la demande écrit vraiment — d'un côté les champs de tout le matériel, de l'autre ceux
    // du seul matériel emprunté. La règle est éprouvée à part : cf. `modification-lot-stock`.
    const { communs, emprunt } = changementsEnLot(data)

    // L'emprunt se déroule dans l'ordre : récupéré, puis rendu. Chaque objet est jugé sur son
    // propre état — une sélection mêle souvent du matériel déjà récupéré et du matériel qui ne
    // l'est pas. Un seul refus arrête tout le lot : appliquer la moitié d'une demande laisserait
    // une sélection dans deux états sans dire lequel est lequel.
    if (data.pickedUpAt !== undefined || data.returnedAt !== undefined) {
      for (const objet of objets) {
        if (!objet.isExternalLoan) continue
        const erreur = erreurOrdreEmprunt(objet, {
          ...(data.pickedUpAt !== undefined
            ? { pickedUpAt: data.pickedUpAt ? new Date(data.pickedUpAt) : null }
            : {}),
          ...(data.returnedAt !== undefined
            ? { returnedAt: data.returnedAt ? new Date(data.returnedAt) : null }
            : {}),
        })
        if (erreur) throw createError({ status: 400, message: erreur })
      }
    }

    const idsEmpruntes = objets.filter((o) => o.isExternalLoan).map((o) => o.id)
    const aAjouter = Array.from(new Set(data.addTagIds ?? []))
    const aRetirer = Array.from(new Set(data.removeTagIds ?? []))

    // Les objets comptés doivent eux aussi appartenir à l'édition. Ils viennent de la même page
    // que `itemIds`, mais rien ne l'impose au point d'API — et une vérification qui repose sur
    // les bonnes manières de l'appelant n'en est pas une.
    const idsComptes = (data.comptage ?? []).map((entree) => entree.id)
    if (idsComptes.length > 0 && !idsComptes.every((id) => itemIds.includes(id))) {
      throw createError({
        status: 400,
        message: 'Certains objets comptés ne font pas partie de la sélection',
      })
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(communs).length > 0) {
        await tx.stockItem.updateMany({ where: { id: { in: itemIds } }, data: communs })
      }

      if (Object.keys(emprunt).length > 0 && idsEmpruntes.length > 0) {
        await tx.stockItem.updateMany({ where: { id: { in: idsEmpruntes } }, data: emprunt })
      }

      // Une écriture par objet, mais dans la même transaction : tout le comptage passe, ou rien.
      // Un inventaire à moitié écrit serait pire que pas d'inventaire du tout — on ne saurait pas
      // quelles caisses ont été comptées.
      for (const entree of data.comptage ?? []) {
        await tx.stockItem.update({
          where: { id: entree.id },
          data: { finalQuantity: entree.finalQuantity },
        })
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
      /** Combien de comptages ont été écrits : l'écran peut le confirmer. */
      comptages: idsComptes.length,
    })
  },
  { operationName: 'BulkUpdateStockItems' }
)
