import { requireAuth } from '@@/server/utils/auth-utils'
import { getEditionTiers } from '@@/server/utils/editions/ticketing/tiers'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour accéder à cette fonctionnalité',
    })

  try {
    // Récupérer le paramètre de query pour afficher tous les tarifs ou seulement les valides
    const query = getQuery(event)
    const showAll = query.showAll === 'true'

    // Récupérer tous les tarifs de l'édition
    const allTiers = await getEditionTiers(editionId)

    // Si showAll est false, filtrer les tarifs par date de validité
    let tiers = allTiers
    if (!showAll) {
      const now = new Date()
      tiers = allTiers.filter((tier) => {
        // Si validFrom est défini, vérifier qu'on est après cette date
        const validFrom = tier.validFrom ? new Date(tier.validFrom) : null
        const startValid = !validFrom || validFrom <= now

        // Si validUntil est défini, vérifier qu'on est avant cette date
        const validUntil = tier.validUntil ? new Date(tier.validUntil) : null
        const endValid = !validUntil || validUntil >= now

        // Le tarif est valide si les deux conditions sont vraies
        return startValid && endValid
      })
    }

    return {
      tiers,
    }
  } catch (error: unknown) {
    console.error('Erreur lors de la récupération des tarifs:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des tarifs',
    })
  }
})
