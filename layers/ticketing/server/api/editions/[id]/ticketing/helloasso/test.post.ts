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
 * Le message rendu quand le test ne peut pas aboutir pour une raison qu'on ne sait pas nommer.
 *
 * Il reste identique pour « aucune configuration enregistrée » : un message propre à ce cas dirait
 * quelles éditions ont une billetterie HelloAsso.
 */
const ERREUR_CONNEXION =
  'Connexion à HelloAsso impossible : vérifiez les identifiants du formulaire'

/**
 * Ce que HelloAsso a répondu, dit à l'organisateur.
 *
 * Tout tombait jusqu'ici dans le message unique ci-dessus, y compris un formulaire introuvable :
 * un organisateur a retenté sept fois en trois heures (MAJJ 2.7, 25/11/2026) sans pouvoir savoir
 * que ses identifiants étaient bons et que c'était le formulaire qui n'était pas trouvé. La garde
 * de droits borne déjà la question aux éditions qu'on gère : nommer la cause n'apprend rien
 * d'autre.
 */
const ERREURS_HELLOASSO: Record<number, string> = {
  401: 'HelloAsso refuse ces identifiants : vérifiez le Client ID et le Client Secret',
  403: "HelloAsso refuse l'accès à ce formulaire : le client API doit avoir le privilège « AccessPublicData »",
  404: "Formulaire introuvable sur HelloAsso : vérifiez l'URL du formulaire (organisation, type, slug) et qu'il est bien publié",
}

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

      // Les causes que l'utilitaire sait nommer (identifiants, droits, formulaire) sont rendues ;
      // le reste — HelloAsso injoignable, réponse inattendue — garde le message générique.
      const statut = (error as { statusCode?: number } | null)?.statusCode
      throw createError({
        status: 400,
        message: (statut && ERREURS_HELLOASSO[statut]) || ERREUR_CONNEXION,
      })
    }
  },
  { operationName: 'POST ticketing helloasso test' }
)
