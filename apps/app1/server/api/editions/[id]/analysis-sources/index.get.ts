import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { listerSources, MAX_SOURCES_PAR_EDITION } from '#server/utils/edition-analysis-sources'
import { getEditionForEdit } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Les sources d'information supplémentaires d'une édition.
 *
 * 📍 Gardé par `getEditionForEdit`, la même garde que le `PUT` de l'édition : ces liens alimentent
 * une analyse qui écrira ensuite dans l'édition. Les protéger moins fort que ce qu'ils servent à
 * modifier n'aurait aucun sens.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    await getEditionForEdit(editionId, user)

    return createSuccessResponse({
      sources: await listerSources(editionId),
      // Rendue à l'écran pour qu'il sache quand désactiver son bouton d'ajout, plutôt que de
      // laisser l'organisateur découvrir la limite en se faisant refuser sa saisie.
      max: MAX_SOURCES_PAR_EDITION,
    })
  },
  { operationName: 'ListerSourcesAnalyse' }
)
