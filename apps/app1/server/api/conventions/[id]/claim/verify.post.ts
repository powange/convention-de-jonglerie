import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { verificationCodeRateLimiter } from '#server/utils/rate-limiter'
import { validateConventionId } from '#server/utils/validation-helpers'

const verifyClaimSchema = z.object({
  code: z.string().min(6).max(6),
})

/** Codes faux tolérés avant que la demande ne soit détruite. */
const MAX_ESSAIS = 5

export default wrapApiHandler(
  async (event) => {
    // Protection contre le forçage d'un code à six chiffres, comme la vérification d'adresse.
    await verificationCodeRateLimiter(event)

    // Vérifier que l'utilisateur est connecté
    const user = await requireAuth(event)
    const conventionIdNum = validateConventionId(event)

    const body = await readBody(event)
    const { code } = verifyClaimSchema.parse(body)

    // Vérifier que la convention existe et n'a pas de créateur
    const convention = await fetchResourceOrFail(prisma.convention, conventionIdNum, {
      errorMessage: 'Convention non trouvée',
      include: {
        editions: true,
      },
    })

    if (convention.authorId) {
      throw createError({
        status: 400,
        message: 'Cette convention a déjà un créateur',
      })
    }

    // Trouver la demande de revendication
    const claimRequest = await prisma.conventionClaimRequest.findUnique({
      where: {
        conventionId_userId: {
          conventionId: conventionIdNum,
          userId: user.id,
        },
      },
    })

    if (!claimRequest) {
      throw createError({
        status: 404,
        message: 'Aucune demande de revendication trouvée',
      })
    }

    // Vérifier que le code n'a pas expiré
    if (claimRequest.expiresAt < new Date()) {
      throw createError({
        status: 400,
        message: 'Le code de vérification a expiré',
      })
    }

    /*
     * Le code faux est COMPTÉ, et au cinquième la demande disparaît.
     *
     * Un code à six chiffres valable une heure se force en quelques minutes : le limiteur par IP
     * ci-dessus ralentit, il ne ferme pas — il suffit de changer d'adresse. Ce compteur-ci ferme,
     * et il est porté par la demande elle-même, donc indépendant de l'origine des essais.
     *
     * L'incrément est fait AVANT de décider, et sa valeur relue depuis la base : deux essais
     * simultanés incrémenteraient sinon tous deux à partir de la même lecture, et le cinquième
     * n'arriverait jamais.
     */
    if (claimRequest.code !== code) {
      const apresEchec = await prisma.conventionClaimRequest.update({
        where: { id: claimRequest.id },
        data: { attempts: { increment: 1 } },
        select: { attempts: true },
      })

      if (apresEchec.attempts >= MAX_ESSAIS) {
        await prisma.conventionClaimRequest.delete({ where: { id: claimRequest.id } })
        throw createError({
          status: 400,
          message: 'Trop d’essais, redemandez un code',
        })
      }

      throw createError({
        status: 400,
        message: 'Code de vérification incorrect',
      })
    }

    // Marquer la demande comme vérifiée
    await prisma.conventionClaimRequest.update({
      where: { id: claimRequest.id },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
      },
    })

    // Transférer la propriété de la convention et de toutes ses éditions
    await prisma.$transaction(async (tx) => {
      // Mettre à jour la convention
      await tx.convention.update({
        where: { id: conventionIdNum },
        data: { authorId: user.id },
      })

      // Mettre à jour toutes les éditions de cette convention
      await tx.edition.updateMany({
        where: { conventionId: conventionIdNum },
        data: { creatorId: user.id },
      })
    })

    // Supprimer la demande de revendication maintenant qu'elle est traitée
    await prisma.conventionClaimRequest.delete({
      where: { id: claimRequest.id },
    })

    return createSuccessResponse(
      {
        convention: {
          id: convention.id,
          name: convention.name,
          editionsCount: convention.editions.length,
        },
      },
      'Revendication réussie ! Vous êtes maintenant propriétaire de cette convention.'
    )
  },
  { operationName: 'VerifyClaimConvention' }
)
