import { requireAuth } from '#server/utils/auth-utils'
import { getEditionTiers } from '#server/utils/editions/ticketing/tiers'
import { canAccessEditionDataOrAccessControl } from '#server/utils/permissions/edition-permissions'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Vérifier les permissions (gestionnaires OU bénévoles en créneau actif de contrôle d'accès :
    // c'est à l'entrée qu'on inscrit un arrivant et qu'on regarde si un tarif est complet)
    const allowed = await canAccessEditionDataOrAccessControl(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à cette fonctionnalité',
      })

    const query = getQuery(event)
    // `showAll` ne parle que de la PÉRIODE DE VALIDITÉ — c'est ce que son libellé annonce à
    // l'utilisateur : « Y compris les tarifs hors période de validité ».
    const showAll = query.showAll === 'true'
    // `includeInactive` parle d'autre chose : un tarif désactivé est retiré de la vente, et non
    // masqué temporairement. Seuls les écrans de CONFIGURATION le demandent — y cacher un tarif
    // désactivé ferait perdre ses associations au premier enregistrement, puisqu'elles se
    // rejouent à partir de ce qui est affiché.
    const includeInactive = query.includeInactive === 'true'

    // Récupérer tous les tarifs de l'édition
    const allTiers = await getEditionTiers(editionId)

    // Un tarif désactivé ne se vend plus : il ne doit pas être proposé à l'ajout d'un participant
    // depuis le contrôle d'accès. La route publique des tarifs le faisait déjà
    // (`tiers/public.get.ts`, `where: { isActive: true }`) ; celle-ci l'avait oublié, et
    // l'interrupteur « Tarif actif » restait donc sans effet au guichet.
    //
    // Le filtre est INDÉPENDANT de `showAll` : « afficher tous les tarifs » rouvre la période de
    // validité, pas la vente d'un tarif qu'on a délibérément retiré.
    let tiers = includeInactive ? allTiers : allTiers.filter((tier) => tier.isActive)

    // Si showAll est false, filtrer les tarifs par date de validité
    if (!showAll) {
      const now = new Date()
      tiers = tiers.filter((tier) => {
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
