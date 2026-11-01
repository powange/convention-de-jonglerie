import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { enregistrerCandidats } from '#server/utils/veille-candidats'
import { SOURCES, sourceParCle } from '#server/utils/veille-sources'

const corps = z.object({
  /** Une source précise, ou toutes si absent. */
  source: z.string().max(40).optional(),
})

/**
 * Relit les agendas et range ce qu'ils annoncent.
 *
 * ⚠️ Les verdicts déjà posés SURVIVENT : `enregistrerCandidats` met à jour ce que la source décrit
 * et laisse intact ce qu'un humain a décidé. C'est tout l'objet de la fonctionnalité — un refus ne
 * doit pas revenir au balayage suivant.
 *
 * 📍 Une source qui échoue n'interrompt pas les autres, et son échec est RAPPORTÉ plutôt qu'avalé :
 * un agenda momentanément inaccessible ne doit pas faire croire qu'il n'a plus d'événements, ce qui
 * est exactement ce qu'un tableau vide laisserait penser.
 */
export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const { source: cleDemandee } = corps.parse((await readBody(event).catch(() => ({}))) ?? {})

    const aLire = cleDemandee ? [sourceParCle(cleDemandee)].filter(Boolean) : [...SOURCES]
    if (cleDemandee && aLire.length === 0) {
      throw createError({ status: 400, message: `Source inconnue : ${cleDemandee}` })
    }

    const bilans = []
    for (const source of aLire) {
      try {
        const candidats = await source!.lister()
        const bilan = await enregistrerCandidats(source!.cle, candidats)
        bilans.push({ source: source!.cle, lus: candidats.length, ...bilan, erreur: null })
      } catch (erreur) {
        console.error(`[VEILLE] ${source!.cle} illisible :`, erreur)
        bilans.push({
          source: source!.cle,
          lus: 0,
          nouveaux: 0,
          rafraichis: 0,
          erreur: erreur instanceof Error ? erreur.message : 'erreur inconnue',
        })
      }
    }

    return createSuccessResponse({ bilans })
  },
  { operationName: 'RafraichirVeille' }
)
