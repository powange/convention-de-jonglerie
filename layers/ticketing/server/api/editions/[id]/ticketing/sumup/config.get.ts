import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageTicketing,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
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
 * - Mitigations : (1) endpoint réservé à qui gère la billetterie OU tient un créneau de
 *   CONTRÔLE D'ACCÈS en cours (2) CSP stricte qui empêche l'exfiltration via XSS
 *   (3) clé non stockée en localStorage côté client, uniquement en mémoire JS
 *   (4) protection CSRF active sur les mutations.
 * - Note : la clé d'affiliation seule est inutilisable sans l'app-id associé
 *   déclaré sur le dashboard SumUp du marchand.
 *
 * ⚠️ POURQUOI LE BÉNÉVOLE DU GUICHET A ÉTÉ AJOUTÉ, le 3 octobre 2026. Cette mitigation disait
 * « UNIQUEMENT les organisateurs avec `canManageTicketing` » — et la page de contrôle d'accès
 * demandait pourtant cette configuration à CHAQUE ouverture, pour tout le monde. Un bénévole en
 * créneau récoltait donc un 403 invisible à l'écran mais consigné dans les journaux de production,
 * et surtout : le paiement par carte, qu'il déclenche depuis « ajouter un participant », ne
 * pouvait pas fonctionner pour lui.
 *
 * Il fallait trancher entre élargir la garde et retirer le paiement par carte aux bénévoles.
 * Décision prise : élargir. Le créneau ACTIF est la condition — pas « être bénévole de
 * l'édition » —, donc la clé n'est lisible que pendant qu'on tient réellement la porte.
 *
 * 📍 Le même défaut avait DÉJÀ été corrigé trois lignes plus bas dans la page, pour HelloAsso, et
 * le commentaire de cette correction le décrivait. Il n'avait pas été reporté ici.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Edition introuvable' })
    }

    if (!canManageTicketing(edition, user)) {
      // Le guichet construit le lien profond `sumupmerchant://` : sans cette clé, le bénévole
      // qui tient la porte ne peut pas encaisser par carte. Le créneau doit être EN COURS.
      const { isActiveAccessControlVolunteer } =
        await import('#server/utils/permissions/access-control-permissions')
      if (!(await isActiveAccessControlVolunteer(user.id, editionId))) {
        throw createError({
          status: 403,
          message: 'Droits insuffisants pour gérer la billetterie',
        })
      }
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
