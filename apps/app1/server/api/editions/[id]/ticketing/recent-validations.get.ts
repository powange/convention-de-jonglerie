import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionDataOrAccessControl } from '#server/utils/permissions/edition-permissions'
import { rendreLisibles } from '#server/utils/ticketing/mouvements-lisibles'

/**
 * Les dix derniers mouvements d'entrée, lus dans le JOURNAL.
 *
 * Ce point d'API reconstruisait auparavant le fil à partir de l'**état courant** des quatre
 * tables : quatre balayages triés sur `entryValidatedAt`, fusionnés en mémoire. Cette approche a
 * un défaut qu'aucun réglage ne corrige — elle ne peut montrer que ce qui est encore vrai :
 *
 * - une entrée validée **puis annulée disparaissait** du fil, l'état ne la portant plus ;
 * - une **annulation n'y figurait jamais**, puisqu'il n'y avait rien à trier.
 *
 * Or c'est précisément la séquence qu'un agent a besoin de voir : quelqu'un est passé à 14 h, son
 * entrée a été retirée à 14 h 05. Le journal la conserve, et une seule requête indexée sur
 * `(editionId, createdAt)` remplace les quatre balayages.
 *
 * ⚠️ Le journal n'a rien **enregistré** avant le 19 septembre 2026. Les validations antérieures y
 * ont été inscrites après coup par un script de reprise, et rien ne les distingue d'un mouvement
 * réellement observé — voir le commentaire du modèle `EntryValidationLog`. Sur une édition
 * ancienne, ce fil ne montrera donc que des validations, jamais d'annulation : non parce que
 * personne n'a annulé, mais parce qu'on ne peut plus le savoir.
 */

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions (gestionnaires OU bénévoles en créneau actif de contrôle d'accès)
    const allowed = await canAccessEditionDataOrAccessControl(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à cette fonctionnalité',
      })

    try {
      const mouvements = await prisma.entryValidationLog.findMany({
        where: { editionId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })

      return createSuccessResponse({ validations: await rendreLisibles(mouvements) })
    } catch (error: unknown) {
      console.error('Database recent validations error:', error)
      throw createError({
        status: 500,
        message: 'Erreur lors de la récupération des validations',
      })
    }
  },
  { operationName: 'GET ticketing recent-validations' }
)
