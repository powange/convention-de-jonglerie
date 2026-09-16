import {
  normalizeHandoutItemSelections,
  type HandoutItemSelection,
} from '#server/utils/ticketing/handout-item-selection'

export interface OptionData {
  name: string
  description?: string | null
  type: string
  isRequired: boolean
  choices?: string[] | null
  price?: number | null // Prix en centimes
  position: number
  handoutItemIds?: HandoutItemSelection[]
  tierIds?: number[] // Tarifs associés à cette option
  mealIds?: number[] // Repas associés à cette option
}

/**
 * Récupère toutes les options d'une édition (HelloAsso et manuelles)
 */
export async function getEditionOptions(editionId: number) {
  const options = await prisma.ticketingOption.findMany({
    where: { editionId },
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    include: {
      quotas: { include: { quota: true } },
      handoutItems: { include: { handoutItem: true } },
      tiers: { include: { tier: true } },
      meals: { include: { meal: true } },
      externalTicketing: { select: { provider: true } },
    },
  })

  /**
   * Le fournisseur, remonté à plat ; `null` pour une option saisie à la main.
   *
   * ⚠️ **Le rattachement à la billetterie externe ne dit RIEN de l'origine d'une option.**
   * `createOption` exige une configuration externe et y rattache l'option, même créée à la main :
   * `externalTicketingId` est donc renseigné dans tous les cas. S'y fier affichait le logo
   * HelloAsso sur une option qu'on venait de saisir soi-même.
   *
   * Ce qui distingue vraiment, c'est l'identifiant chez le fournisseur. Les tarifs, eux, laissent
   * bien `externalTicketingId` à `null` quand ils sont manuels — l'asymétrie est dans le code,
   * pas dans le schéma.
   *
   * Limite assumée : `helloAssoOptionId` est la colonne d'UN fournisseur. Le jour où un autre
   * importera des options, il lui faudra sa propre colonne, et cette ligne devra la lire aussi —
   * sans quoi ses options passeront pour saisies à la main.
   */
  return options.map((option) => ({
    ...option,
    provider: option.helloAssoOptionId ? (option.externalTicketing?.provider ?? null) : null,
  }))
}

/**
 * Crée une nouvelle option manuelle pour une édition
 */
export async function createOption(editionId: number, data: OptionData) {
  // Vérifier qu'il existe une configuration de billeterie externe
  const externalTicketing = await prisma.externalTicketing.findUnique({
    where: { editionId },
  })

  if (!externalTicketing) {
    throw createError({
      status: 400,
      message: 'Aucune configuration de billeterie externe trouvée',
    })
  }

  return await prisma.ticketingOption.create({
    data: {
      externalTicketingId: externalTicketing.id,
      editionId,
      name: data.name,
      description: data.description,
      type: data.type,
      isRequired: data.isRequired,
      choices: data.choices,
      price: data.price,
      position: data.position,
      // helloAssoOptionId reste null pour une option manuelle
      handoutItems: {
        create: normalizeHandoutItemSelections(data.handoutItemIds).map(
          ({ handoutItemId, quantity }) => ({ handoutItemId, quantity })
        ),
      },
      tiers: {
        create: (data.tierIds || []).map((tierId) => ({ tierId })),
      },
      meals: {
        create: (data.mealIds || []).map((mealId) => ({ mealId })),
      },
    },
  })
}

/**
 * Met à jour une option existante
 */
export async function updateOption(optionId: number, editionId: number, data: OptionData) {
  // Vérifier que l'option existe et appartient à l'édition
  const existingOption = await prisma.ticketingOption.findFirst({
    where: {
      id: optionId,
      editionId,
    },
  })

  if (!existingOption) {
    throw createError({
      status: 404,
      message: 'Option non trouvée',
    })
  }

  const isHelloAssoOption = existingOption.helloAssoOptionId !== null

  // Mettre à jour l'option avec ses relations
  return await prisma.$transaction(async (tx) => {
    // Supprimer les anciennes relations (sauf tiers pour HelloAsso).
    //
    // Les quotas n'apparaissent plus ici : leur seul chemin d'écriture est l'endpoint dédié
    // /options/[id]/quotas. Tant que ce bloc les effaçait et les recréait, enregistrer un simple
    // changement de libellé les détruisait — la fenêtre d'édition ne les envoyait plus.
    if (data.handoutItemIds !== undefined) {
      await tx.ticketingOptionHandoutItem.deleteMany({ where: { optionId } })
    }
    await tx.ticketingOptionMeal.deleteMany({ where: { optionId } })

    // Pour les options HelloAsso, on met à jour uniquement les relations articles et repas
    // Les associations tarif-option sont gérées par la synchronisation HelloAsso
    // Pour les options manuelles, on met à jour tout
    if (isHelloAssoOption) {
      return await tx.ticketingOption.update({
        where: { id: optionId },
        data: {
          ...(data.handoutItemIds !== undefined
            ? {
                handoutItems: {
                  create: normalizeHandoutItemSelections(data.handoutItemIds).map(
                    ({ handoutItemId, quantity }) => ({ handoutItemId, quantity })
                  ),
                },
              }
            : {}),
          meals: {
            create: (data.mealIds || []).map((mealId) => ({ mealId })),
          },
          // Note: les associations tiers sont gérées par HelloAsso, on ne les modifie pas
        },
      })
    } else {
      // Pour les options manuelles, on peut modifier les associations tiers
      await tx.ticketingTierOption.deleteMany({ where: { optionId } })

      return await tx.ticketingOption.update({
        where: { id: optionId },
        data: {
          name: data.name,
          description: data.description,
          type: data.type,
          isRequired: data.isRequired,
          choices: data.choices,
          price: data.price,
          position: data.position,
          ...(data.handoutItemIds !== undefined
            ? {
                handoutItems: {
                  create: normalizeHandoutItemSelections(data.handoutItemIds).map(
                    ({ handoutItemId, quantity }) => ({ handoutItemId, quantity })
                  ),
                },
              }
            : {}),
          tiers: {
            create: (data.tierIds || []).map((tierId) => ({ tierId })),
          },
          meals: {
            create: (data.mealIds || []).map((mealId) => ({ mealId })),
          },
        },
      })
    }
  })
}

/**
 * Supprime une option manuelle
 */
export async function deleteOption(optionId: number, editionId: number) {
  // Vérifier que l'option existe et appartient à l'édition
  const existingOption = await prisma.ticketingOption.findFirst({
    where: {
      id: optionId,
      editionId,
    },
  })

  if (!existingOption) {
    throw createError({
      status: 404,
      message: 'Option non trouvée',
    })
  }

  // Ne pas permettre la suppression d'une option HelloAsso
  if (existingOption.helloAssoOptionId !== null) {
    throw createError({
      status: 400,
      message: 'Les options HelloAsso ne peuvent pas être supprimées',
    })
  }

  await prisma.ticketingOption.delete({
    where: { id: optionId },
  })

  return { success: true }
}
