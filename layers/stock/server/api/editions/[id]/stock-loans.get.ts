import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getEditionWithPermissions } from '#server/utils/permissions/edition-permissions'
import { userWithProfileAndGravatarSelect } from '#server/utils/prisma-select-helpers'
import { canAccessStock } from '#server/utils/stock-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/stock-loans
 *
 * Le matériel emprunté à l'extérieur, tous groupes confondus.
 *
 * Cette liste traverse les groupes, là où tout le reste du module s'organise par groupe : un
 * emprunt à récupérer chez le même prêteur peut concerner la sonorisation et la cuisine, et rien
 * ne le montrait — il fallait ouvrir chaque groupe pour s'en apercevoir. C'est ce qui justifie un
 * point d'API à part plutôt qu'un filtre sur celui des groupes, qui charge aussi les réservations,
 * les tags et les emplacements dont cette vue n'a que faire.
 *
 * Le calcul des états reste côté écran : la règle des trois temps vit dans `etat-emprunt`, elle y
 * est éprouvée, et la dédoubler ici la ferait diverger. On rend les faits, pas leur lecture.
 *
 * Accessible à qui peut consulter le stock : un responsable d'équipe a autant besoin de savoir ce
 * qui doit être rapporté que celui qui gère l'inventaire.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!(await canAccessStock(edition, user))) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const loans = await prisma.stockItem.findMany({
      where: { isExternalLoan: true, group: { editionId } },
      select: {
        id: true,
        name: true,
        quantity: true,
        isExternalLoan: true,
        ownerContact: true,
        returnDueAt: true,
        pickedUpAt: true,
        returnedAt: true,
        pickupLocation: true,
        pickupContact: true,
        returnLocation: true,
        returnContact: true,
        pickupResponsible: { select: userWithProfileAndGravatarSelect },
        returnResponsible: { select: userWithProfileAndGravatarSelect },
        group: { select: { id: true, name: true } },
      },
      // Un ordre stable, et rien de plus. Trier par échéance ici placerait les emprunts sans date
      // en tête — MySQL ordonne les valeurs nulles en premier —, soit l'inverse de ce qu'on veut
      // lire. L'ordre d'affichage dépend d'ailleurs de l'état de chaque emprunt, qui se calcule à
      // l'écran : il est décidé là-bas, par `ordonnerEmprunts`.
      orderBy: { name: 'asc' },
    })

    return createSuccessResponse({ loans })
  },
  { operationName: 'GetStockLoans' }
)
