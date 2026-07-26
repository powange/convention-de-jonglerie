/**
 * Article à remettre tel que manipulé par l'agrégation.
 * `cumulative` vient de TicketingHandoutItem ; absent = non cumulable.
 */
export interface HandoutItemLike {
  id: number
  name: string
  cumulative?: boolean
}

/**
 * Agrège une liste d'articles à remettre provenant de plusieurs associations
 * (tarif, champ personnalisé, spectacle, repas, équipe, édition…).
 *
 * - article **non cumulable** (défaut) : une seule occurrence, `quantity = 1`,
 *   même s'il est associé plusieurs fois (ex. un bracelet).
 * - article **cumulable** : `quantity` = nombre d'associations (ex. un artiste
 *   jouant dans deux spectacles reçoit deux fois l'article).
 *
 * Centralisé ici pour que toutes les populations (participants, bénévoles,
 * artistes, organisateurs) appliquent exactement la même règle.
 */
export function aggregateHandoutItems<T extends HandoutItemLike>(
  items: T[]
): Array<T & { quantity: number }> {
  const aggregated = new Map<number, T & { quantity: number }>()

  for (const item of items) {
    const existing = aggregated.get(item.id)
    if (!existing) {
      aggregated.set(item.id, { ...item, quantity: 1 })
      continue
    }
    // Un article non cumulable reste à 1 quel que soit le nombre d'associations
    if (item.cumulative) {
      existing.quantity += 1
    }
  }

  return Array.from(aggregated.values())
}

/**
 * Calcule les articles à remettre pour un participant (billet)
 * en combinant les articles du tarif direct et ceux des custom fields
 *
 * @param item - L'item de commande avec tier et customFields
 * @returns Liste agrégée des articles à remettre (avec quantité)
 */
export function calculateHandoutItemsForTicket(item: any) {
  if (!item.tier) {
    return []
  }

  // Articles à remettre directement associés au tarif
  const directItems = (item.tier.handoutItems || []).map((ri: any) => ({
    handoutItem: {
      id: ri.handoutItem.id,
      name: ri.handoutItem.name,
    },
    source: 'tier' as const,
  }))

  // Articles à remettre des custom fields
  const customFieldItems: any[] = []
  if (item.customFields && Array.isArray(item.customFields)) {
    for (const answeredField of item.customFields as any[]) {
      // Trouver le custom field correspondant dans le tarif
      const customFieldAssociation = item.tier.customFields?.find(
        (cf: any) => cf.customField.label === answeredField.name
      )

      if (customFieldAssociation) {
        // Ajouter les articles à remettre de ce custom field
        for (const cfItem of customFieldAssociation.customField.handoutItems || []) {
          // Vérifier si l'article est conditionnel à un choix spécifique
          // Si choiceValue est null ou undefined, l'article s'applique à tous les choix
          // Sinon, l'article ne s'applique que si la réponse correspond au choiceValue
          if (!cfItem.choiceValue || cfItem.choiceValue === answeredField.answer) {
            customFieldItems.push({
              handoutItem: {
                id: cfItem.handoutItem.id,
                name: cfItem.handoutItem.name,
              },
              source: 'customField' as const,
              customFieldName: answeredField.name,
            })
          }
        }
      }
    }
  }

  // Agréger les articles par ID : un article non cumulable associé à la fois au
  // tarif et à un champ personnalisé n'est remis qu'une fois ; un article
  // cumulable l'est autant de fois qu'il est associé.
  const allItems = [...directItems, ...customFieldItems]
  const quantities = aggregateHandoutItems(
    allItems.map((entry: any) => entry.handoutItem as HandoutItemLike)
  )
  const quantityById = new Map(quantities.map((q) => [q.id, q.quantity]))

  // On conserve la première occurrence de chaque article (avec son origine,
  // exploitée à l'affichage) en y ajoutant la quantité calculée.
  const seen = new Set<number>()
  const result: any[] = []
  for (const entry of allItems) {
    const id = entry.handoutItem.id
    if (seen.has(id)) continue
    seen.add(id)
    result.push({ ...entry, quantity: quantityById.get(id) ?? 1 })
  }

  return result
}

/**
 * Inclusions Prisma nécessaires pour récupérer les articles à remettre d'un tarif
 * Utilisé dans les requêtes qui récupèrent des OrderItems
 */
export const handoutItemsIncludes = {
  handoutItems: {
    include: {
      handoutItem: true,
    },
  },
  customFields: {
    include: {
      customField: {
        include: {
          handoutItems: {
            include: {
              handoutItem: true,
            },
          },
        },
      },
    },
  },
}
