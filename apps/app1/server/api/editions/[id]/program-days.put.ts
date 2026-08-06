import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getEditionForEdit } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  days: z
    .array(
      z.object({
        /** Jour concerné, `AAAA-MM-JJ`. Sans heure : une journée n'en a pas. */
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Jour attendu au format AAAA-MM-JJ'),
        content: z.string().max(20000),
      })
    )
    .max(60),
})

/**
 * PUT /api/editions/:id/program-days
 *
 * Remplace le programme détaillé. Le corps décrit l'état voulu dans son ensemble : les jours
 * absents sont supprimés, ce qui est le comportement attendu d'un formulaire qu'on enregistre.
 *
 * Un jour vidé est supprimé plutôt que conservé vide : une journée sans programme n'a rien à
 * afficher, et laisser des lignes vides encombrerait la lecture publique.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    await getEditionForEdit(editionId, user)

    const { days } = bodySchema.parse(await readBody(event))

    // Deux fois le même jour rendrait l'enregistrement ambigu, et la contrainte d'unicité le
    // rejetterait plus loin avec un message obscur.
    const dates = days.map((d) => d.date)
    if (new Set(dates).size !== dates.length) {
      throw createError({ status: 400, message: 'Un même jour est fourni plusieurs fois' })
    }

    const remplis = days.filter((d) => d.content.trim() !== '')

    await prisma.$transaction(async (tx) => {
      await tx.editionProgramDay.deleteMany({ where: { editionId } })
      if (remplis.length) {
        await tx.editionProgramDay.createMany({
          data: remplis.map((d) => ({
            editionId,
            date: new Date(`${d.date}T00:00:00.000Z`),
            content: d.content.trim(),
          })),
        })
      }
    })

    return createSuccessResponse({
      days: remplis.map((d) => ({ date: d.date, content: d.content.trim() })),
    })
  },
  { operationName: 'UpdateEditionProgramDays' }
)
