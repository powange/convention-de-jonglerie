import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { personSearchRateLimiter } from '#server/utils/api-rate-limiter'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageStock,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import {
  attachesALEdition,
  filtreRecherchePersonne,
  LIMITE_RESULTATS,
} from '#server/utils/personnes-edition'
import { validateEditionId } from '#server/utils/validation-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'
import { LONGUEUR_MINIMALE_PSEUDO, motsDeRecherche } from '~~/shared/utils/recherche-responsable'

/*
 * `q` est le nom du paramètre, et `pseudo` reste accepté.
 *
 * ⚠️ Les deux formes, parce qu'un contrat d'API qu'on durcit casse les clients déjà ouverts : une
 * page restée dans un onglet continue d'envoyer `pseudo`, et ce dépôt a déjà payé ce cas deux fois.
 * `pseudo` est de toute façon devenu un mauvais nom — la recherche couvre le pseudo, le prénom et
 * le nom.
 */
const querySchema = z
  .object({
    q: z.string().trim().min(LONGUEUR_MINIMALE_PSEUDO).max(100).optional(),
    pseudo: z.string().trim().min(LONGUEUR_MINIMALE_PSEUDO).max(100).optional(),
  })
  .refine((v) => v.q || v.pseudo, {
    message: 'Terme de recherche requis',
    path: ['q'],
  })

/**
 * GET /api/editions/[id]/stock-responsables?q=…
 *
 * Les personnes de l'édition à qui confier du matériel, cherchées par MOTS-CLÉS.
 *
 * La recherche d'une personne se fait ailleurs par adresse e-mail exacte, et c'est délibéré : on ne
 * parcourt pas l'annuaire des comptes. Chercher un nom dans tout le site l'ouvrirait à qui gère un
 * stock, d'où le périmètre restreint aux gens de l'édition — organisateurs, bénévoles acceptés et
 * ARTISTES —, décrit dans `personnes-edition`.
 *
 * 📍 ELLE NE REGARDAIT QUE LE PSEUDO, et il fallait le connaître. Elle couvre désormais le pseudo,
 * le prénom et le nom, et accepte plusieurs mots : « Dupont Jean » et « Jean Dupont » trouvent la
 * même personne. C'était la demande — on cherche quelqu'un par son nom, pas par l'identifiant
 * qu'il s'est choisi.
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

    const mots = motsDeRecherche(query.q ?? query.pseudo)

    const users = await prisma.user.findMany({
      where: {
        // `AND` pour les mots, `OR` pour les attaches : tous les mots doivent trouver preneur, et
        // il suffit d'UNE attache à l'édition. Les deux dans le même `where` se composent bien,
        // mais pas s'ils partagent la même clé — d'où `filtreRecherchePersonne`, qui rend un `AND`.
        AND: filtreRecherchePersonne(mots),
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
