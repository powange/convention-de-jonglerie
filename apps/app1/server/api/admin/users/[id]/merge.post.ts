import { readBody } from 'h3'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler, createSuccessResponse } from '#server/utils/api-helpers'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import {
  mergeUsers,
  previewUserMerge,
  moveProfilePictureAfterMerge,
  cleanupMergedUserUploads,
  MERGE_ARBITRABLE_FIELDS,
  type MergeFieldChoices,
} from '#server/utils/user-merge'
import { validateResourceId } from '#server/utils/validation-helpers'

/**
 * Fusionne deux comptes utilisateur.
 *
 * `[id]` désigne le compte **conservé** ; `sourceUserId` le compte **absorbé**, supprimé à
 * l'issue de l'opération. Avec `dryRun: true`, seul l'aperçu chiffré est renvoyé.
 */
export default wrapApiHandler(
  async (event) => {
    const adminUser = await requireGlobalAdminWithDbCheck(event)

    const targetUserId = validateResourceId(event, 'id', 'utilisateur')
    const body = await readBody(event)
    const sourceUserId = Number(body?.sourceUserId)
    const dryRun = body?.dryRun === true

    if (!Number.isInteger(sourceUserId) || sourceUserId <= 0) {
      throw createError({ status: 400, message: 'Compte à absorber invalide' })
    }

    if (sourceUserId === targetUserId) {
      throw createError({ status: 400, message: 'Impossible de fusionner un compte avec lui-même' })
    }

    const userSelect = {
      id: true,
      email: true,
      pseudo: true,
      nom: true,
      prenom: true,
      isGlobalAdmin: true,
    }

    const targetUser = await fetchResourceOrFail(prisma.user, targetUserId, {
      errorMessage: 'Compte à conserver introuvable',
      select: userSelect,
    })
    const sourceUser = await fetchResourceOrFail(prisma.user, sourceUserId, {
      errorMessage: 'Compte à absorber introuvable',
      select: userSelect,
    })

    if (sourceUserId === adminUser.id) {
      throw createError({ status: 400, message: 'Impossible de fusionner son propre compte' })
    }

    if (sourceUser.isGlobalAdmin) {
      throw createError({
        status: 403,
        message: "Impossible d'absorber un super administrateur",
      })
    }

    if (dryRun) {
      const impact = await previewUserMerge(targetUserId, sourceUserId)
      return createSuccessResponse({ dryRun: true, targetUser, sourceUser, ...impact })
    }

    // La confirmation par saisie du pseudo est revalidée côté serveur : le contrôle du
    // modal ne protège pas d'un appel direct à l'API.
    if (body?.confirmPseudo !== sourceUser.pseudo) {
      throw createError({
        status: 400,
        message: 'La confirmation ne correspond pas au pseudo du compte à absorber',
      })
    }

    const fieldChoices: MergeFieldChoices = {}
    for (const field of MERGE_ARBITRABLE_FIELDS) {
      if (body?.fieldChoices?.[field] === 'source') fieldChoices[field] = 'source'
    }

    const result = await mergeUsers({
      targetId: targetUserId,
      sourceId: sourceUserId,
      fieldChoices,
    })

    if (result.profilePictureToMove) {
      await moveProfilePictureAfterMerge(sourceUserId, targetUserId, result.profilePictureToMove)
    }
    await cleanupMergedUserUploads(sourceUserId)

    console.log(
      `[ADMIN MERGE] Fusion par ${adminUser.pseudo} (${adminUser.email}) : ` +
        `${sourceUser.pseudo} (${sourceUser.email}) absorbé dans ${targetUser.pseudo} (${targetUser.email}) — ` +
        `${result.totalTransferred} ligne(s) transférée(s), ${result.totalDuplicates} doublon(s) écarté(s)`
    )

    return createSuccessResponse(
      {
        dryRun: false,
        targetUser,
        sourceUser,
        groups: result.groups,
        totalTransferred: result.totalTransferred,
        totalDuplicates: result.totalDuplicates,
      },
      `Compte ${sourceUser.pseudo} fusionné dans ${targetUser.pseudo}`
    )
  },
  { operationName: 'MergeUsers' }
)
