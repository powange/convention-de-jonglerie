import { z } from 'zod'

import {
  normalizeHandoutItemSelections,
  type HandoutItemSelection,
} from '#server/utils/ticketing/handout-item-selection'
import { estUneDateDeValiditeLisible, instantDeValidite } from '~~/shared/utils/date-validite'

/**
 * Ce qu'un point d'API accepte pour une date de validité.
 *
 * Les deux formes que `instantDeValidite` sait lire, et elles seules : un instant daté, ou une
 * heure murale nue. Toute autre chaîne est refusée à l'entrée plutôt que de devenir `null`
 * silencieusement en base — perdre une date de validité sans le dire est pire que la refuser.
 *
 * Exporté pour que les deux points d'API (création, modification) partagent la MÊME règle : la
 * recopier des deux côtés, c'est se garantir qu'elles divergeront un jour.
 */
export const dateDeValiditeSchema = z
  .string()
  .refine(estUneDateDeValiditeLisible, { message: 'Date de validité illisible' })
  .nullable()
  .optional()

/** Le fuseau déclaré par l'édition, ou `null` — le champ reste facultatif. */
async function fuseauDeLEdition(editionId: number): Promise<string | null> {
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    select: { timezone: true },
  })
  return edition?.timezone ?? null
}

export interface TierData {
  name: string
  customName?: string | null
  description?: string | null
  price: number
  minAmount?: number | null
  maxAmount?: number | null
  position: number
  isActive: boolean
  countAsParticipant?: boolean
  validFrom?: string | null
  validUntil?: string | null
  handoutItemIds?: HandoutItemSelection[]
  mealIds?: number[]
}

/**
 * Interface pour les objets pouvant être vérifiés pour le prix libre
 */
export interface FreePriceCheckable {
  minAmount?: number | null
  maxAmount?: number | null
}

/**
 * Vérifie si un tarif est à prix libre
 * Un tarif est à prix libre si minAmount ou maxAmount est défini
 */
export function isFreePrice(tier: FreePriceCheckable): boolean {
  return tier.minAmount != null || tier.maxAmount != null
}

/**
 * Vérifie si un tarif est à prix fixe
 * Un tarif est à prix fixe si minAmount et maxAmount sont tous deux null/undefined
 */
export function isFixedPrice(tier: FreePriceCheckable): boolean {
  return tier.minAmount == null && tier.maxAmount == null
}

/**
 * Applique le nom personnalisé si défini
 */
export function applyCustomName<T extends { name: string; customName?: string | null }>(
  tier: T
): T {
  return {
    ...tier,
    name: tier.customName || tier.name,
  }
}

/**
 * Récupère tous les tarifs d'une édition (externes et manuels)
 */
export async function getEditionTiers(
  editionId: number,
  options?: { includeOriginalName?: boolean }
) {
  const tiers = await prisma.ticketingTier.findMany({
    where: { editionId },
    orderBy: [{ position: 'asc' }, { price: 'desc' }],
    include: {
      quotas: {
        include: {
          quota: {
            include: {
              options: {
                include: {
                  option: true,
                },
              },
            },
          },
        },
      },
      handoutItems: {
        include: {
          handoutItem: true,
        },
      },
      customFields: {
        include: {
          customField: true,
        },
      },
      meals: {
        include: {
          meal: true,
        },
      },
      _count: {
        select: {
          orderItems: true,
        },
      },
      // D'où vient ce tarif. L'écran s'en sert pour en marquer l'origine d'un logo, et
      // `helloAssoTierId` n'y suffit pas : c'est la colonne d'UN fournisseur, pas une réponse à
      // « d'où vient-il ». Un tarif importé d'ailleurs l'aurait à `null` et passerait pour saisi
      // à la main.
      externalTicketing: {
        select: {
          provider: true,
        },
      },
    },
  })

  /** Le fournisseur, remonté à plat ; `null` pour un tarif saisi à la main. */
  const origine = (tier: { externalTicketing: { provider: string } | null }) =>
    tier.externalTicketing?.provider ?? null

  // Si includeOriginalName est true, on retourne les deux noms (pour l'édition)
  if (options?.includeOriginalName) {
    return tiers.map((tier) => ({
      ...tier,
      originalName: tier.name,
      name: tier.customName || tier.name,
      soldCount: tier._count.orderItems,
      provider: origine(tier),
    }))
  }

  // Sinon, on surcharge le name avec customName si défini
  return tiers.map((tier) => ({
    ...applyCustomName(tier),
    soldCount: tier._count.orderItems,
    provider: origine(tier),
  }))
}

/**
 * Crée un nouveau tarif manuel
 */
export async function createTier(editionId: number, data: TierData) {
  const fuseau = await fuseauDeLEdition(editionId)
  return await prisma.ticketingTier.create({
    data: {
      editionId,
      name: data.name,
      customName: data.customName,
      description: data.description,
      price: data.price,
      minAmount: data.minAmount,
      maxAmount: data.maxAmount,
      position: data.position,
      isActive: data.isActive,
      countAsParticipant: data.countAsParticipant ?? true,
      validFrom: instantDeValidite(data.validFrom, fuseau),
      validUntil: instantDeValidite(data.validUntil, fuseau),
      // externalTicketingId et helloAssoTierId restent null pour un tarif manuel
      handoutItems: {
        create: normalizeHandoutItemSelections(data.handoutItemIds).map(
          ({ handoutItemId, quantity }) => ({ handoutItemId, quantity })
        ),
      },
      meals: {
        create: (data.mealIds || []).map((mealId) => ({ mealId })),
      },
    },
  })
}

/**
 * Met à jour un tarif existant
 */
export async function updateTier(tierId: number, editionId: number, data: TierData) {
  const fuseau = await fuseauDeLEdition(editionId)

  // Vérifier que le tarif existe et appartient à cette édition
  const existingTier = await prisma.ticketingTier.findFirst({
    where: {
      id: tierId,
      editionId,
    },
  })

  if (!existingTier) {
    throw createError({
      status: 404,
      message: 'Tarif introuvable',
    })
  }

  const isHelloAssoTier = existingTier.helloAssoTierId !== null

  // Mettre à jour le tarif avec ses relations
  return await prisma.$transaction(async (tx) => {
    // Supprimer les anciennes relations.
    //
    // Les quotas n'apparaissent plus ici : leur seul chemin d'écriture est l'endpoint dédié
    // /tiers/[id]/quotas. Tant que ce bloc les effaçait et les recréait, enregistrer un simple
    // changement de prix les détruisait — la fenêtre d'édition ne les envoyait plus.
    //
    // `handoutItems` garde sa condition : la clé reste acceptée, elle n'est simplement pas
    // toujours envoyée.
    if (data.handoutItemIds !== undefined) {
      await tx.ticketingTierHandoutItem.deleteMany({ where: { tierId } })
    }
    await tx.ticketingTierMeal.deleteMany({ where: { tierId } })

    // Pour les tarifs HelloAsso, on met à jour le customName, les dates de validité et les relations
    // Pour les tarifs manuels, on met à jour tout
    if (isHelloAssoTier) {
      return await tx.ticketingTier.update({
        where: { id: tierId },
        data: {
          customName: data.customName,
          countAsParticipant: data.countAsParticipant ?? true,
          validFrom: instantDeValidite(data.validFrom, fuseau),
          validUntil: instantDeValidite(data.validUntil, fuseau),
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
        },
      })
    } else {
      return await tx.ticketingTier.update({
        where: { id: tierId },
        data: {
          name: data.name,
          customName: data.customName,
          description: data.description,
          price: data.price,
          minAmount: data.minAmount,
          maxAmount: data.maxAmount,
          position: data.position,
          isActive: data.isActive,
          countAsParticipant: data.countAsParticipant ?? true,
          validFrom: instantDeValidite(data.validFrom, fuseau),
          validUntil: instantDeValidite(data.validUntil, fuseau),
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
        },
      })
    }
  })
}

/**
 * Supprime un tarif manuel
 */
export async function deleteTier(tierId: number, editionId: number) {
  // Vérifier que le tarif existe et appartient à cette édition
  const existingTier = await prisma.ticketingTier.findFirst({
    where: {
      id: tierId,
      editionId,
    },
  })

  if (!existingTier) {
    throw createError({
      status: 404,
      message: 'Tarif introuvable',
    })
  }

  // Vérifier que ce n'est pas un tarif HelloAsso (non supprimable)
  if (existingTier.helloAssoTierId !== null) {
    throw createError({
      status: 403,
      message: 'Impossible de supprimer un tarif synchronisé depuis HelloAsso',
    })
  }

  await prisma.ticketingTier.delete({
    where: { id: tierId },
  })

  return {
    success: true,
    message: 'Tarif supprimé avec succès',
  }
}
