import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Régénère le jeton d'un compteur — celui que porte le QR code affiché à l'entrée.
 *
 * ⚠️ Le compteur est désigné ici par son **jeton**, alors que les six autres endpoints de
 * `counters/[counterId]` le désignent par son identifiant. C'est l'incohérence relevée par l'audit
 * (P2), et elle est assumée pour l'instant : la corriger (#385) a cassé la production.
 *
 * Pourquoi : l'écran du compteur est adressé par jeton — c'est tout ce que porte son URL et son QR
 * code. Le faire appeler par identifiant l'obligeait à attendre le chargement du compteur, et
 * surtout rendait l'API incompatible avec tout client encore sur le bundle précédent. Un écran
 * laissé ouvert à une entrée de convention est exactement ce cas.
 *
 * Ce qui a rendu la panne durable est un autre problème, ouvert à ce jour : l'hôte de déploiement
 * conserve les fichiers **supprimés** du dépôt. La page effacée par #385 était donc toujours servie,
 * et appelait cette route avec un jeton. Tant que ce point n'est pas réglé, changer la façon dont
 * une route est adressée n'est pas sûr.
 *
 * Si P2 est repris un jour, ce ne peut pas être par un simple changement de résolution : il faudra
 * soit accepter les deux le temps d'une transition, soit s'assurer d'abord qu'aucun client ne peut
 * rester sur un ancien bundle.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    // Le segment s'appelle `counterId` mais porte un jeton : voir l'avertissement ci-dessus.
    const token = z.string().min(1).parse(getRouterParam(event, 'counterId'))

    // Vérifier les permissions
    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour régénérer le token de ce compteur',
      })
    }

    const counter = await prisma.ticketingCounter.findFirst({
      where: {
        token,
        editionId,
      },
    })

    if (!counter) {
      throw createError({
        status: 404,
        message: 'Compteur introuvable',
      })
    }

    // Générer un nouveau token unique
    const newToken = crypto.randomUUID()

    // Mettre à jour le token du compteur existant
    const updatedCounter = await prisma.ticketingCounter.update({
      where: {
        id: counter.id,
      },
      data: {
        token: newToken,
        updatedAt: new Date(),
      },
    })

    return createSuccessResponse({ token: newToken, counter: updatedCounter })
  },
  { operationName: 'PATCH regenerate ticketing counter token' }
)
