import { wrapApiHandler } from '#server/utils/api-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/:id/program-days
 *
 * Programme détaillé d'une édition, jour par jour. Public, comme le programme général qu'il
 * complète : c'est une information d'affiche.
 *
 * Les jours sortis des dates de l'édition sont renvoyés aussi. Le tri revient à l'appelant, qui
 * seul connaît les dates courantes — voir `buildProgramDays`.
 */
export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)

    const days = await prisma.editionProgramDay.findMany({
      where: { editionId },
      orderBy: { date: 'asc' },
      select: { date: true, content: true },
    })

    return createSuccessResponse({
      // Le jour est une date sans heure : la renvoyer en ISO complet inviterait à des
      // conversions de fuseau qui la feraient changer de journée.
      days: days.map((day) => ({
        date: day.date.toISOString().slice(0, 10),
        content: day.content,
      })),
    })
  },
  { operationName: 'ListEditionProgramDays' }
)
