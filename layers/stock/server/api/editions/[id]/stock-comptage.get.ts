import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getEditionWithPermissions } from '#server/utils/permissions/edition-permissions'
import { canAccessStock } from '#server/utils/stock-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/stock-comptage
 *
 * Le recomptage de fin d'édition, tous groupes confondus.
 *
 * Comme `stock-loans`, cette liste traverse les groupes là où le reste du module s'organise par
 * groupe. La raison est la même : la question « qu'est-ce qu'on rachète ? » ne se pose jamais
 * groupe par groupe, et y répondre obligeait à ouvrir chaque groupe et à faire la somme de tête.
 *
 * ⚠️ On rend TOUT le matériel de l'édition, y compris ce qui est complet, et non les seuls
 * manquants. Deux raisons :
 *
 * 1. L'écran permet de compter sur place. Un objet qu'on vient de compter juste change d'onglet
 *    une fois le comptage ENREGISTRÉ ; s'il avait été filtré côté serveur, corriger une faute de
 *    frappe demanderait de recharger la page pour le voir revenir.
 * 2. Le total des objets de l'édition est ce qui donne son sens au nombre de non-comptés — savoir
 *    qu'il reste 40 objets à compter sur 45 change la lecture d'une liste de rachat.
 *
 * Le tri et le classement restent côté écran : la règle vit dans `manquants-stock`, elle y est
 * éprouvée, et la dédoubler ici la ferait diverger. On rend les faits, pas leur lecture — même
 * choix que pour les emprunts.
 *
 * Accessible à qui peut consulter le stock. Enregistrer un comptage, en revanche, passe par
 * `stock-items/bulk.patch`, qui exige le droit de gestion : lire ce qui manque et le corriger ne
 * sont pas le même geste.
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

    const items = await prisma.stockItem.findMany({
      where: { group: { editionId } },
      select: {
        id: true,
        name: true,
        // La description accompagne le nom dans une infobulle : compter du matériel demande
        // souvent de savoir de quoi il s'agit exactement — « les câbles XLR, pas les jack ».
        description: true,
        quantity: true,
        finalQuantity: true,
        group: { select: { id: true, name: true } },
        // Les tags servent à filtrer la séance de comptage — « on fait la cuisine aujourd'hui »,
        // « on ne s'occupe que du fragile ». La couleur voyage avec : on reconnaît un tag à sa
        // pastille avant d'en lire le nom, et le même rendu sert sur toutes les pages du module.
        tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
      },
      orderBy: [{ group: { displayOrder: 'asc' } }, { displayOrder: 'asc' }, { name: 'asc' }],
    })

    return createSuccessResponse({ items })
  },
  { operationName: 'GetStockComptage' }
)
