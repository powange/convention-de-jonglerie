import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { personSearchRateLimiter } from '#server/utils/api-rate-limiter'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageStock,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { attachesALEdition, LIMITE_RESULTATS } from '#server/utils/personnes-edition'
import { validateEditionId } from '#server/utils/validation-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'
import { LONGUEUR_MINIMALE_PSEUDO } from '~~/shared/utils/recherche-responsable'

const querySchema = z.object({
  pseudo: z.string().trim().min(LONGUEUR_MINIMALE_PSEUDO).max(100),
})

/**
 * GET /api/editions/[id]/stock-responsables?pseudo=…
 *
 * Les personnes de l'édition à qui confier du matériel, cherchées par pseudo.
 *
 * La recherche d'une personne se fait ailleurs par adresse e-mail exacte, et c'est délibéré : on ne
 * parcourt pas l'annuaire des comptes. Chercher par pseudo dans tout le site l'ouvrirait à qui gère
 * un stock, d'où le périmètre restreint aux gens de l'édition — organisateurs et bénévoles acceptés
 * —, décrit dans `personnes-edition`.
 *
 * **L'adresse e-mail n'est pas rendue.** Le pseudo, le prénom et le nom suffisent à reconnaître
 * quelqu'un qu'on choisit dans sa propre équipe ; gérer un stock ne donne pas droit aux adresses
 * des bénévoles, qui relèvent de la gestion du bénévolat. La recherche par adresse exacte, elle,
 * la rend — mais il faut déjà la connaître pour la trouver.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    // Avant tout le reste : un balayage méthodique reconstituerait la liste des gens de l'édition,
    // et il n'a pas à consommer une requête de base pour se faire refouler.
    await personSearchRateLimiter(event)

    const editionId = validateEditionId(event)

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    // Le même droit que le formulaire qui appelle : celui qui modifie un objet du stock.
    if (!canManageStock(edition, user)) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    let query: z.infer<typeof querySchema>
    try {
      query = querySchema.parse(getQuery(event))
    } catch (error) {
      if (error instanceof z.ZodError) handleValidationError(error)
      throw error
    }

    const users = await prisma.user.findMany({
      where: {
        pseudo: { contains: query.pseudo },
        OR: attachesALEdition(editionId, edition.conventionId),
      },
      select: {
        id: true,
        pseudo: true,
        prenom: true,
        nom: true,
        profilePicture: true,
        emailHash: true,
      },
      orderBy: { pseudo: 'asc' },
      take: LIMITE_RESULTATS,
    })

    return createSuccessResponse({ users })
  },
  { operationName: 'SearchStockResponsables' }
)
