/**
 * Calcule les articles à restituer pour un participant (billet)
 * en combinant les articles du tarif direct et ceux des custom fields
 *
 * @param item - L'item de commande avec tier et customFields
 * @returns Liste dédupliquée des articles à restituer
 */
export function calculateReturnableItemsForTicket(item: any) {
  if (!item.tier) {
    return []
  }

  // Articles à restituer directement associés au tarif
  const directItems = (item.tier.returnableItems || []).map((ri: any) => ({
    returnableItem: {
      id: ri.returnableItem.id,
      name: ri.returnableItem.name,
    },
    source: 'tier' as const,
  }))

  // Articles à restituer des custom fields
  const customFieldItems: any[] = []
  if (item.customFields && Array.isArray(item.customFields)) {
    for (const answeredField of item.customFields as any[]) {
      // Trouver le custom field correspondant dans le tarif
      const customFieldAssociation = item.tier.customFields?.find(
        (cf: any) => cf.customField.label === answeredField.name
      )

      if (customFieldAssociation) {
        // Ajouter les articles à restituer de ce custom field
        for (const cfItem of customFieldAssociation.customField.returnableItems || []) {
          // Vérifier si l'article est conditionnel à un choix spécifique
          // Si choiceValue est null ou undefined, l'article s'applique à tous les choix
          // Sinon, l'article ne s'applique que si la réponse correspond au choiceValue
          if (!cfItem.choiceValue || cfItem.choiceValue === answeredField.answer) {
            customFieldItems.push({
              returnableItem: {
                id: cfItem.returnableItem.id,
                name: cfItem.returnableItem.name,
              },
              source: 'customField' as const,
              customFieldName: answeredField.name,
            })
          }
        }
      }
    }
  }

  // Dédupliquer les articles par ID
  // Si un même article est associé à la fois au tarif et à un custom field,
  // on ne le garde qu'une seule fois
  const allItems = [...directItems, ...customFieldItems]
  const uniqueItemsMap = new Map()
  allItems.forEach((item: any) => {
    if (!uniqueItemsMap.has(item.returnableItem.id)) {
      uniqueItemsMap.set(item.returnableItem.id, item)
    }
  })

  return Array.from(uniqueItemsMap.values())
}

/**
 * Inclusions Prisma nécessaires pour récupérer les articles à restituer d'un tarif
 * Utilisé dans les requêtes qui récupèrent des OrderItems
 */
export const returnableItemsIncludes = {
  returnableItems: {
    include: {
      returnableItem: true,
    },
  },
  customFields: {
    include: {
      customField: {
        include: {
          returnableItems: {
            include: {
              returnableItem: true,
            },
          },
        },
      },
    },
  },
}
