import type { H3Event } from 'h3'

import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageStock,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Les gardes communes aux listes de courses.
 *
 * Sept points d'API touchent ces listes — les créer, les renommer, les supprimer, y ajouter du
 * matériel, cocher, décocher, retirer. Recopier les mêmes huit lignes de contrôle dans chacun,
 * c'est se donner sept occasions d'en oublier une ; et l'expérience de ce dépôt est qu'une règle
 * recopiée finit toujours appliquée à un endroit de moins qu'annoncé.
 */

/**
 * Qui peut toucher aux listes de courses de cette édition.
 *
 * Le droit de GESTION, pas de simple consultation : une liste de courses engage des achats. La
 * page qui montre ce qui manque, elle, se contente de `canAccessStock` — regarder ce qui manque
 * et décider ce qu'on rachète ne sont pas le même geste.
 */
export async function exigerGestionDesListes(event: H3Event) {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)

  const edition = await getEditionWithPermissions(editionId, { userId: user.id })
  if (!edition) {
    throw createError({ status: 404, message: 'Édition non trouvée' })
  }
  if (!canManageStock(edition, user)) {
    throw createError({ status: 403, message: 'Droits insuffisants' })
  }

  return { user, editionId }
}

/**
 * Un identifiant lu dans l'URL, ou un 400 qui dit lequel.
 *
 * `Number('')` vaut zéro et `Number(undefined)` vaut `NaN` : sans ce contrôle, une URL tronquée
 * irait chercher la liste numéro zéro et rendrait un 404 incompréhensible plutôt qu'une erreur de
 * saisie.
 */
export function idDeRoute(event: H3Event, nom: string, libelle: string): number {
  const valeur = Number(getRouterParam(event, nom))
  if (!Number.isInteger(valeur) || valeur <= 0) {
    throw createError({ status: 400, message: `Identifiant ${libelle} invalide` })
  }
  return valeur
}

/**
 * La liste existe-t-elle, et appartient-elle bien à CETTE édition&nbsp;?
 *
 * ⚠️ Les deux conditions dans la même requête, et c'est le point de sécurité du module. Chercher la
 * liste par son seul identifiant permettrait à quelqu'un qui gère le stock de l'édition A de
 * renommer, vider ou supprimer une liste de l'édition B en changeant un nombre dans l'URL : les
 * droits auraient été vérifiés sur A, et l'écriture faite sur B.
 *
 * Rendre 404 plutôt que 403 est délibéré : une liste d'une autre édition n'a pas à exister du point
 * de vue de celle-ci.
 */
export async function exigerListeDeLEdition(listId: number, editionId: number) {
  const liste = await prisma.stockShoppingList.findFirst({
    where: { id: listId, editionId },
    select: { id: true, name: true },
  })

  if (!liste) {
    throw createError({ status: 404, message: 'Liste de courses non trouvée' })
  }

  return liste
}

/**
 * L'article existe-t-il, et dans cette liste-là&nbsp;?
 *
 * Même raisonnement que ci-dessus, d'un cran plus bas : cocher un article se fait par son
 * identifiant, et rien n'empêcherait sans cela de cocher celui d'une autre liste.
 */
export async function exigerArticleDeLaListe(articleId: number, listId: number) {
  const article = await prisma.stockShoppingListItem.findFirst({
    where: { id: articleId, listId },
    select: { id: true },
  })

  if (!article) {
    throw createError({ status: 404, message: 'Article non trouvé dans cette liste' })
  }

  return article
}

/**
 * Ce qu'une liste rend à l'écran.
 *
 * Les articles portent le matériel visé plutôt qu'un nom recopié : le lien est vivant, et la
 * quantité à racheter se relit sur l'objet à chaque affichage. C'est pourquoi `quantity` et
 * `finalQuantity` voyagent avec chaque article — sans eux, l'écran ne saurait pas combien acheter.
 */
export const selectionDeListe = {
  id: true,
  name: true,
  createdAt: true,
  items: {
    select: {
      id: true,
      purchased: true,
      item: {
        select: {
          id: true,
          name: true,
          quantity: true,
          finalQuantity: true,
          group: { select: { id: true, name: true } },
          // Les étiquettes voyagent avec l'article parce que la liste se lit EN COURSES : « les
          // fragiles dans le même carton », « ne rien prendre de lourd sans la voiture ». Les
          // relire ailleurs supposerait une seconde requête au moment où l'on est le moins
          // disposé à attendre. `displayOrder` fixe l'ordre des pastilles, sans quoi il varierait
          // d'un chargement à l'autre sous les yeux de qui relit sa liste.
          tags: {
            select: { tag: { select: { id: true, name: true, color: true } } },
            orderBy: { tag: { displayOrder: 'asc' } },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} as const

/**
 * Les identifiants qui désignent vraiment du matériel de cette édition.
 *
 * Une liste ne contient que du matériel du stock : on ne peut pas y écrire une ligne libre. Il
 * faut donc vérifier que chaque identifiant reçu appartient bien à l'édition, faute de quoi une
 * requête forgée y glisserait du matériel d'une autre convention — que l'écran afficherait ensuite
 * sans sourciller, puisque le lien est vivant.
 */
export async function objetsDeLEdition(ids: number[], editionId: number): Promise<number[]> {
  if (ids.length === 0) return []

  const objets = await prisma.stockItem.findMany({
    where: { id: { in: ids }, group: { editionId } },
    select: { id: true },
  })

  return objets.map((objet) => objet.id)
}
