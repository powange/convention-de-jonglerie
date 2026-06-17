import { requireAuth } from '#server/utils/auth-utils'
import { getEditionTiers } from '#server/utils/editions/ticketing/tiers'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à cette fonctionnalité',
      })

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

    // Formater les tarifs pour inclure les custom fields dans un format exploitable
    const formattedTiers = tiers.map((tier) => ({
      ...tier,
      customFields: tier.customFields?.map((cf) => cf.customField) || [],
    }))

    return {
      tiers: formattedTiers,
    }
  },
  { operationName: 'GET available ticketing tiers' }
)
