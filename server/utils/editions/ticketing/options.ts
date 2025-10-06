import { prisma } from '../../prisma'

export interface OptionData {
  name: string
  description?: string | null
  type: string
  isRequired: boolean
  choices?: string[] | null
  position: number
  quotaIds?: number[]
  returnableItemIds?: number[]
}

/**
 * Récupère toutes les options d'une édition (HelloAsso et manuelles)
 */
export async function getEditionOptions(editionId: number) {
  return await prisma.ticketingOption.findMany({
    where: { editionId },
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    include: {
      quotas: { include: { quota: true } },
      returnableItems: { include: { returnableItem: true } },
    },
  })
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
      statusCode: 400,
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
      position: data.position,
      // helloAssoOptionId reste null pour une option manuelle
      quotas: {
        create: (data.quotaIds || []).map((quotaId) => ({ quotaId })),
      },
      returnableItems: {
        create: (data.returnableItemIds || []).map((returnableItemId) => ({
          returnableItemId,
        })),
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
      statusCode: 404,
      message: 'Option non trouvée',
    })
  }

  const isHelloAssoOption = existingOption.helloAssoOptionId !== null

  // Mettre à jour l'option avec ses relations
  return await prisma.$transaction(async (tx) => {
    // Supprimer les anciennes relations
    await tx.optionQuota.deleteMany({ where: { optionId } })
    await tx.optionReturnableItem.deleteMany({ where: { optionId } })

    // Pour les options HelloAsso, on met à jour uniquement les relations
    // Pour les options manuelles, on met à jour tout
    if (isHelloAssoOption) {
      return await tx.ticketingOption.update({
        where: { id: optionId },
        data: {
          quotas: {
            create: (data.quotaIds || []).map((quotaId) => ({ quotaId })),
          },
          returnableItems: {
            create: (data.returnableItemIds || []).map((returnableItemId) => ({
              returnableItemId,
            })),
          },
        },
      })
    } else {
      return await tx.ticketingOption.update({
        where: { id: optionId },
        data: {
          name: data.name,
          description: data.description,
          type: data.type,
          isRequired: data.isRequired,
          choices: data.choices,
          position: data.position,
          quotas: {
            create: (data.quotaIds || []).map((quotaId) => ({ quotaId })),
          },
          returnableItems: {
            create: (data.returnableItemIds || []).map((returnableItemId) => ({
              returnableItemId,
            })),
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
      statusCode: 404,
      message: 'Option non trouvée',
    })
  }

  // Ne pas permettre la suppression d'une option HelloAsso
  if (existingOption.helloAssoOptionId !== null) {
    throw createError({
      statusCode: 400,
      message: 'Les options HelloAsso ne peuvent pas être supprimées',
    })
  }

  await prisma.ticketingOption.delete({
    where: { id: optionId },
  })

  return { success: true }
}
