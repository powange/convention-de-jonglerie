import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketing } from '#server/utils/permissions/edition-permissions'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/ticketing/sumup/config
 *
 * Renvoie la config SumUp d'une édition pour permettre au frontend de construire
 * le deep link `sumupmerchant://` (le browser appelle l'app SumUp localement).
 *
 * **Compromis sécurité documenté** :
 * - L'`affiliateKey` est déchiffrée côté serveur et renvoyée en clair au client
 *   pour construire le deep link. C'est nécessaire car l'app SumUp Merchant
 *   attend tous les paramètres dans l'URL (pas d'API server-to-server pour
 *   pré-remplir le montant).
 * - Mitigations : (1) endpoint accessible UNIQUEMENT aux organisateurs avec
 *   `canManageTicketing` (2) CSP stricte qui empêche l'exfiltration via XSS
 *   (3) clé non stockée en localStorage côté client, uniquement en mémoire JS
 *   (4) protection CSRF active sur les mutations.
 * - Note : la clé d'affiliation seule est inutilisable sans l'app-id associé
 *   déclaré sur le dashboard SumUp du marchand.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const edition = await fetchResourceOrFail(prisma.edition, editionId, {
      errorMessage: 'Edition introuvable',
      select: {
        id: true,
        convention: {
          include: {
            organizers: { where: { userId: user.id } },
          },
        },
        organizerPermissions: {
          where: { organizer: { userId: user.id } },
          include: { organizer: { select: { userId: true } } },
        },
      },
    })

    if (!canManageTicketing(edition, user)) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour gérer la billetterie',
      })
    }

    const config = await prisma.sumupConfig.findUnique({
      where: { editionId },
    })

    if (!config) {
      return createSuccessResponse({ config: null })
    }

    const { decrypt } = await import('#server/utils/encryption')

    return createSuccessResponse({
      config: {
        affiliateKey: decrypt(config.affiliateKey),
        appId: config.appId,
        updatedAt: config.updatedAt,
      },
    })
  },
  { operationName: 'GetSumupConfig' }
)
