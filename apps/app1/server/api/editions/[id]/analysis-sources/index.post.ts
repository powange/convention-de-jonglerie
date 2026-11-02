import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { listerSources, MAX_SOURCES_PAR_EDITION } from '#server/utils/edition-analysis-sources'
import { getEditionForEdit } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'
import { schemaUrlExterne } from '#shared/utils/url-externe'

/*
 * ⚠️ `schemaUrlExterne`, et non le validateur d'URL nu de zod : le schéma maison élague les
 * espaces, plafonne la longueur, et surtout n'accepte QUE http(s). Le validateur nu laisse passer
 * `javascript:` et `file:`, qui finiraient dans un lien cliquable de l'écran.
 *
 * 📍 `test/unit/utils/url-externe.test.ts` l'interdit sur les points d'API d'une édition. Elle
 * inspecte le TEXTE du fichier, commentaires compris : écrire la forme interdite ici, fût-ce pour
 * l'expliquer, suffit à la faire échouer. D'où cette formulation.
 */
const corps = z.object({
  url: schemaUrlExterne,
  label: z.string().trim().max(120).optional(),
})

/**
 * Ajoute une source d'information supplémentaire à une édition.
 *
 * ⚠️ Un doublon n'est PAS une erreur du point de vue de l'opérateur : il a collé deux fois la même
 * adresse, ou cliqué deux fois. On répond donc par la source existante plutôt que par un 409 —
 * mais on ne crée pas de seconde ligne, sans quoi la même page serait relue et facturée deux fois
 * dans la même analyse, et deux lignes identiques à l'écran passeraient pour un affichage
 * redondant plutôt que pour un doublon de traitement.
 *
 * 📍 L'unicité est aussi tenue en base, sur un préfixe de 500 caractères : la vérification
 * ci-dessous évite le message d'erreur brut, elle ne remplace pas la contrainte. Entre les deux
 * requêtes, un second envoi pourrait insérer la même URL.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    await getEditionForEdit(editionId, user)

    const { url, label } = corps.parse(await readBody(event))

    const existante = await prisma.editionAnalysisSource.findFirst({
      where: { editionId, url },
      select: { id: true, url: true, label: true, actif: true },
    })
    if (existante) {
      return createSuccessResponse({ source: existante, deja: true })
    }

    const nombre = await prisma.editionAnalysisSource.count({ where: { editionId } })
    if (nombre >= MAX_SOURCES_PAR_EDITION) {
      throw createError({
        status: 400,
        message: `Limite de ${MAX_SOURCES_PAR_EDITION} sources atteinte pour cette édition`,
      })
    }

    const source = await prisma.editionAnalysisSource.create({
      data: { editionId, url, label: label || null },
      select: { id: true, url: true, label: true, actif: true },
    })

    // La liste complète suit la création : l'écran la remplace d'un bloc plutôt que d'insérer à la
    // main, ce qui le dispense de reproduire l'ordre de tri du serveur — et de s'en écarter.
    return createSuccessResponse({ source, deja: false, sources: await listerSources(editionId) })
  },
  { operationName: 'AjouterSourceAnalyse' }
)
