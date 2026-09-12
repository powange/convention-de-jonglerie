import { z } from 'zod'

// `wrapApiHandler` et `createSuccessResponse` étaient laissés à l'auto-import de Nitro, contrairement
// aux endpoints voisins qui les déclarent. Ça tient à l'exécution, mais rend le fichier impossible à
// charger dans un test — et c'est probablement pour cette raison qu'il n'en avait aucun.
import { createSuccessResponse, wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { testHelloAssoConnection } from '#server/utils/editions/ticketing/helloasso'
import { decrypt } from '#server/utils/encryption'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Le message rendu quand le test ne peut pas aboutir, quelle qu'en soit la raison.
 *
 * Volontairement identique pour « aucune configuration » et « identifiants refusés » : deux
 * messages distincts feraient de cet endpoint un moyen de savoir quelles éditions ont une
 * billetterie HelloAsso, et lesquelles n'en ont pas.
 */
const ERREUR_CONNEXION =
  'Connexion à HelloAsso impossible : vérifiez les identifiants du formulaire'

const bodySchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().optional(),
  organizationSlug: z.string().min(1),
  formType: z.string().min(1),
  formSlug: z.string().min(1),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Vérifier les permissions AVANT toute lecture : sans cette garde, n'importe quel compte
    // faisait déchiffrer le secret HelloAsso de n'importe quelle édition, en passant simplement son
    // numéro dans l'URL. L'endpoint jumeau d'Infomaniak la vérifiait déjà — c'était un oubli.
    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à cette configuration',
      })
    }

    const body = bodySchema.parse(await readBody(event))

    // Si pas de clientSecret fourni, récupérer le secret chiffré en base
    let clientSecret = body.clientSecret
    if (!clientSecret) {
      const existingConfig = await prisma.helloAssoConfig.findFirst({
        where: { externalTicketing: { editionId } },
        select: { clientSecret: true },
      })
      if (!existingConfig) {
        // Même réponse que pour des identifiants refusés, et c'est délibéré : distinguer les deux
        // dirait quelles éditions ont une billetterie HelloAsso configurée à quiconque en gère une
        // seule. La garde ci-dessus borne déjà qui peut poser la question ; celle-ci borne ce que
        // la réponse apprend.
        throw createError({
          status: 400,
          message: ERREUR_CONNEXION,
        })
      }
      clientSecret = decrypt(existingConfig.clientSecret)
    }

    try {
      const result = await testHelloAssoConnection(
        {
          clientId: body.clientId,
          clientSecret,
        },
        {
          organizationSlug: body.organizationSlug,
          formType: body.formType,
          formSlug: body.formSlug,
        }
      )

      return createSuccessResponse(result, 'Connexion réussie')
    } catch (error: unknown) {
      console.error('HelloAsso test error:', error)

      // Le détail va au journal, pas au client : l'utilitaire distingue les causes d'échec, et les
      // relayer telles quelles redonnerait l'oracle que le message unique vient de fermer.
      throw createError({ status: 400, message: ERREUR_CONNEXION })
    }
  },
  { operationName: 'POST ticketing helloasso test' }
)
