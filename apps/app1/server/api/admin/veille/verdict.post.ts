import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { poserVerdict } from '#server/utils/veille-candidats'

const corps = z.object({
  /** L'URL canonique du candidat : la clé du dispositif, pas son identifiant de ligne. */
  url: z.string().url().max(500),
  verdict: z.enum(['A_EXAMINER', 'CONVENTION', 'REFUSE']),
})

/**
 * Pose le verdict d'un administrateur sur un candidat.
 *
 * 📍 L'adressage se fait par URL et non par `id`, parce que c'est l'URL qui porte l'identité d'un
 * candidat — l'`id` d'une ligne pourrait changer si la table était un jour reconstruite, et deux
 * écrans ouverts côte à côte ne verraient pas forcément les mêmes identifiants.
 *
 * ⚠️ `REFUSE` est définitif par construction : l'énumération d'une source ne réécrit jamais un
 * verdict (voir `enregistrerCandidats`). C'est ce qui fait qu'un refus ne revient pas au balayage
 * suivant.
 */
export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const { url, verdict } = corps.parse(await readBody(event))

    // Un candidat inconnu doit se dire, et non se créer en silence : l'écran ne propose de verdict
    // que sur ce qu'il a affiché, donc une URL absente signale un désaccord entre les deux.
    const existant = await prisma.candidatEvenement.findUnique({
      where: { url },
      select: { id: true },
    })
    if (!existant) {
      throw createError({ status: 404, message: 'Candidat introuvable' })
    }

    await poserVerdict(url, verdict)
    return createSuccessResponse({ url, verdict })
  },
  { operationName: 'PoserVerdictVeille' }
)
