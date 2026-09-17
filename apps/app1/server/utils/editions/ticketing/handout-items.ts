import { z } from 'zod'

/**
 * La longueur de la colonne `name`, telle que la migration initiale la pose : `VARCHAR(191)`.
 *
 * Sans cette borne côté validation, un nom plus long remontait en erreur Prisma, que le `catch`
 * du point d'API transformait en 500 « Erreur lors de la création ». L'utilisateur recevait une
 * panne là où il devait recevoir la phrase qui lui dit quoi corriger.
 */
export const NOM_ARTICLE_MAX = 191

/**
 * Ce qu'un article à remettre exige, en un seul endroit.
 *
 * Le schéma était recopié à l'identique dans la création et la mise à jour — deux endroits où
 * ajouter la même borne, donc un endroit où l'oublier. Le `trim` vit ici aussi : l'interface le
 * fait déjà, mais l'interface n'est pas le contrat, et « Bracelet » avec une espace de trop est
 * un autre article pour l'index d'unicité comme pour l'œil.
 */
export const handoutItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Le nom est obligatoire')
    .max(NOM_ARTICLE_MAX, `Le nom ne peut pas dépasser ${NOM_ARTICLE_MAX} caractères`),
  /** Remis autant de fois qu'il est associé au participant (défaut : une seule fois) */
  cumulative: z.boolean().optional(),
})

export type HandoutItemData = z.infer<typeof handoutItemSchema>

/**
 * Refuse un nom déjà porté par un autre article de la même édition.
 *
 * L'index unique `(editionId, name)` tient la garantie ; ce contrôle tient le *message*. Sans lui,
 * la violation d'index remonte en erreur Prisma que le `catch` du point d'API transforme en 500 —
 * exactement le défaut corrigé pour la longueur du nom (B11), à l'autre bout de la même validation.
 *
 * La comparaison est confiée à MySQL, dont la colonne est en `utf8mb4_unicode_ci` : elle ignore
 * donc la casse et les accents, au même titre que l'index. Un contrôle fait en JavaScript sur
 * `===` serait plus strict que la base et laisserait passer ce qu'elle refuse ensuite.
 *
 * @param exclureId - L'article en cours de modification, qui ne se fait pas doublon de lui-même.
 */
async function exigerUnNomLibre(editionId: number, name: string, exclureId?: number) {
  const homonyme = await prisma.ticketingHandoutItem.findFirst({
    where: {
      editionId,
      name,
      ...(exclureId !== undefined ? { id: { not: exclureId } } : {}),
    },
    select: { id: true },
  })

  if (homonyme) {
    throw createError({
      status: 400,
      message: `Un article nommé « ${name} » existe déjà dans cette édition`,
    })
  }
}

/**
 * Crée un nouvel item à remettre
 */
export async function createHandoutItem(editionId: number, data: HandoutItemData) {
  await exigerUnNomLibre(editionId, data.name)

  return await prisma.ticketingHandoutItem.create({
    data: {
      editionId,
      name: data.name,
      cumulative: data.cumulative ?? false,
    },
  })
}

/**
 * Met à jour un item à remettre
 */
export async function updateHandoutItem(itemId: number, editionId: number, data: HandoutItemData) {
  // Vérifier que l'item existe et appartient à cette édition
  const existingItem = await prisma.ticketingHandoutItem.findUnique({
    where: { id: itemId },
  })

  if (!existingItem) {
    throw createError({ status: 404, message: 'Item introuvable' })
  }

  if (existingItem.editionId !== editionId) {
    throw createError({
      status: 403,
      message: "Cet item n'appartient pas à cette édition",
    })
  }

  await exigerUnNomLibre(editionId, data.name, itemId)

  return await prisma.ticketingHandoutItem.update({
    where: { id: itemId },
    data: {
      name: data.name,
      ...(data.cumulative !== undefined ? { cumulative: data.cumulative } : {}),
    },
  })
}

/**
 * Ce qu'une suppression d'article emporte avec elle, table par table.
 *
 * Les libellés sont ceux que voit l'utilisateur ; l'ordre est celui d'affichage. Un compteur à
 * zéro n'est pas rendu à l'écran, mais il est calculé : c'est la même forme pour tous les
 * articles, et l'absence de clé se lit mal.
 */
export interface AssociationsDunArticle {
  tarifs: number
  options: number
  champsPersonnalises: number
  spectacles: number
  artistes: number
  equipesBenevoles: number
  organisateurs: number
  repas: number
}

/**
 * Les articles d'une édition, chacun avec le décompte de ce que sa suppression détacherait.
 *
 * Supprimer un article efface en cascade ses associations réparties sur huit écrans, et la
 * confirmation n'en disait rien : on défaisait en un clic un paramétrage qu'on ne voyait pas.
 * Le décompte voyage donc avec la liste, plutôt que dans un appel séparé au moment du clic —
 * l'utilisateur doit pouvoir le lire avant d'ouvrir la confirmation, et la liste est courte.
 *
 * Les neuf tables passent par `_count`, organisateurs compris. Ils étaient comptés à part par un
 * `groupBy` : leur table était la seule à ne porter aucune relation vers l'article, et `_count`
 * ne pouvait donc pas l'atteindre. La relation existe depuis, et l'exception avec elle.
 */
export async function listHandoutItemsWithAssociationCounts(editionId: number) {
  const items = await prisma.ticketingHandoutItem.findMany({
    where: { editionId },
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: {
          tiers: true,
          options: true,
          customFields: true,
          shows: true,
          artists: true,
          volunteerTicketingHandoutItems: true,
          artistTicketingHandoutItems: true,
          organizerTicketingHandoutItems: true,
          meals: true,
        },
      },
    },
  })

  return items.map(({ _count, ...item }) => ({
    ...item,
    associations: {
      tarifs: _count.tiers,
      options: _count.options,
      champsPersonnalises: _count.customFields,
      spectacles: _count.shows,
      // Deux tables distinctes pour les artistes : celle d'un artiste précis, et celle qui vise
      // tous les artistes de l'édition. Les deux disparaissent, on les additionne.
      artistes: _count.artists + _count.artistTicketingHandoutItems,
      equipesBenevoles: _count.volunteerTicketingHandoutItems,
      organisateurs: _count.organizerTicketingHandoutItems,
      repas: _count.meals,
    } satisfies AssociationsDunArticle,
  }))
}

/**
 * Supprime un item à remettre
 */
export async function deleteHandoutItem(itemId: number, editionId: number) {
  // Vérifier que l'item existe et appartient à cette édition
  const existingItem = await prisma.ticketingHandoutItem.findUnique({
    where: { id: itemId },
  })

  if (!existingItem) {
    throw createError({ status: 404, message: 'Item introuvable' })
  }

  if (existingItem.editionId !== editionId) {
    throw createError({
      status: 403,
      message: "Cet item n'appartient pas à cette édition",
    })
  }

  /*
   * Les NEUF tables de liaison partent maintenant en cascade, tenues par la base.
   *
   * Celle des organisateurs était l'exception : sans clé étrangère, ses lignes survivaient à la
   * suppression en pointant vers un identifiant disparu — l'écran les affichait « Article
   * inconnu ». L'écriture le compensait à la main, dans une transaction. La clé étrangère
   * ajoutée, cette compensation n'a plus lieu d'être : un invariant que le code devait se
   * rappeler de tenir est redevenu une propriété du schéma.
   */
  await prisma.ticketingHandoutItem.delete({ where: { id: itemId } })

  return { success: true }
}
