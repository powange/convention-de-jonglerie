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
 * Association entre un article et un porteur (tarif, option, champ personnalisé,
 * spectacle, repas, équipe, édition…). `quantity` est le nombre d'exemplaires
 * défini sur CETTE association ; absent vaut 1.
 */
export interface HandoutItemAssociation {
  handoutItem: HandoutItemLike
  quantity?: number | null
}

/**
 * Agrège les articles à remettre provenant de plusieurs associations.
 *
 * - article **non cumulable** (défaut) : on retient la plus grande quantité
 *   définie sur ses associations. Deux spectacles associant un bracelet chacun
 *   n'en donnent qu'un ; une association « 2 bracelets » en donne bien deux.
 * - article **cumulable** : on additionne les quantités. Un artiste jouant dans
 *   deux spectacles à 3 tickets boisson en reçoit six.
 *
 * Centralisé ici pour que toutes les populations (participants, bénévoles,
 * artistes, organisateurs) appliquent exactement la même règle.
 */
export function aggregateHandoutItems(
  associations: HandoutItemAssociation[]
): Array<HandoutItemLike & { quantity: number }> {
  const aggregated = new Map<number, HandoutItemLike & { quantity: number }>()

  for (const association of associations) {
    const item = association.handoutItem
    if (!item) continue
    // Une quantité absente, nulle ou invalide vaut un exemplaire.
    const quantity = Math.max(1, Math.trunc(association.quantity ?? 1) || 1)

    const existing = aggregated.get(item.id)
    if (!existing) {
      aggregated.set(item.id, { ...item, quantity })
      continue
    }
    existing.quantity = item.cumulative
      ? existing.quantity + quantity
      : Math.max(existing.quantity, quantity)
  }

  return Array.from(aggregated.values())
}

/**
 * Calcule les articles à remettre pour un participant (billet).
 *
 * TROIS sources s'y rejoignent, et c'est bien l'affaire de cette fonction de les réunir :
 * le tarif acheté, les champs personnalisés renseignés, et les options souscrites.
 *
 * Les options ont longtemps manqué ici : l'écran de guichet les agrégeait lui-même, de son
 * côté, en additionnant les quantités sans connaître le drapeau `cumulative` — un bracelet
 * attaché au tarif ET à une option apparaissait donc deux fois dans la liste à remettre. La
 * règle n'a qu'un seul endroit où vivre, et c'est celui-ci : l'écran se contente d'afficher.
 *
 * @param item - L'item de commande, avec `tier`, `customFields` et `selectedOptions`
 * @returns Liste agrégée des articles à remettre (avec quantité)
 */
export function calculateHandoutItemsForTicket(item: any) {
  // Articles à remettre directement associés au tarif
  const directItems = (item.tier?.handoutItems || []).map((ri: any) => ({
    handoutItem: {
      id: ri.handoutItem.id,
      name: ri.handoutItem.name,
      cumulative: ri.handoutItem.cumulative,
    },
    quantity: ri.quantity,
    source: 'tier' as const,
  }))

  // Articles à remettre des options souscrites. Une option s'achète indépendamment du tarif :
  // elle est donc lue même quand le billet n'en porte pas, faute de quoi un billet sans tarif
  // repartirait sans l'article qu'on lui a pourtant vendu.
  const optionItems: any[] = []
  for (const selectedOption of item.selectedOptions || []) {
    for (const optionItem of selectedOption.option?.handoutItems || []) {
      optionItems.push({
        handoutItem: {
          id: optionItem.handoutItem.id,
          name: optionItem.handoutItem.name,
          cumulative: optionItem.handoutItem.cumulative,
        },
        quantity: optionItem.quantity,
        source: 'option' as const,
        optionName: selectedOption.option?.name,
      })
    }
  }

  // Articles à remettre des custom fields
  const customFieldItems: any[] = []
  if (item.customFields && Array.isArray(item.customFields)) {
    for (const answeredField of item.customFields as any[]) {
      // Trouver le custom field correspondant dans le tarif
      const customFieldAssociation = item.tier?.customFields?.find(
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
                cumulative: cfItem.handoutItem.cumulative,
              },
              quantity: cfItem.quantity,
              source: 'customField' as const,
              customFieldName: answeredField.name,
            })
          }
        }
      }
    }
  }

  // Agréger les articles par ID : un article non cumulable associé à la fois au
  // tarif, à une option et à un champ personnalisé n'est remis qu'une fois ; un
  // article cumulable l'est autant de fois qu'il est associé.
  const allItems = [...directItems, ...optionItems, ...customFieldItems]
  const quantities = aggregateHandoutItems(allItems)
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

/**
 * Inclusions Prisma des options souscrites par un billet, avec leurs articles.
 *
 * À employer partout où `calculateHandoutItemsForTicket` est appelée : sans elles, la fonction
 * ne voit aucune option et rend une liste incomplète — silencieusement, puisqu'un billet sans
 * option est parfaitement ordinaire. C'est exactement ce qui se produisait au scan d'un QR code,
 * où seule la recherche par nom chargeait les options.
 */
export const selectedOptionsIncludes = {
  selectedOptions: {
    include: {
      option: {
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

/**
 * Entrée acceptée par les endpoints qui associent des articles : soit un simple
 * identifiant (quantité implicite de 1), soit un couple identifiant + quantité.
 * Les deux formes coexistent pour ne pas casser les appels existants.
 */
export type HandoutItemAssociationInput = number | { handoutItemId: number; quantity?: number }

/**
 * Normalise ces entrées en couples { handoutItemId, quantity }, quantité bornée
 * à un minimum de 1.
 */
export function normalizeHandoutItemAssociations(
  input: HandoutItemAssociationInput[] | undefined | null
): Array<{ handoutItemId: number; quantity: number }> {
  if (!input) return []
  return input.map((entry) =>
    typeof entry === 'number'
      ? { handoutItemId: entry, quantity: 1 }
      : {
          handoutItemId: entry.handoutItemId,
          quantity: Math.max(1, Math.trunc(entry.quantity ?? 1) || 1),
        }
  )
}
