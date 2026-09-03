import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTreasuryById } from '#server/utils/permissions/edition-permissions'
import { userWithProfileAndGravatarSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Qui peut être désigné comme ayant avancé une dépense.
 *
 * La recherche d'utilisateurs ouverte aux non-administrateurs n'accepte qu'un email EXACT — un
 * choix de confidentialité délibéré. Demander à un trésorier de connaître par cœur l'adresse du
 * bénévole qui a payé les courses rendrait le champ inutilisable.
 *
 * On cherche donc parmi les personnes déjà rattachées à l'édition : organisateurs, bénévoles
 * acceptés, artistes programmés. Aucune ouverture de confidentialité — le trésorier voit déjà ces
 * personnes ailleurs dans la gestion — et c'est parmi elles que se trouve, en pratique, celle qui
 * a sorti l'argent de sa poche.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageTreasuryById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants pour gérer la trésorerie' })
    }

    const { search } = z
      .object({ search: z.string().trim().max(100).optional() })
      .parse(getQuery(event))

    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { conventionId: true },
    })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition introuvable' })
    }

    const [organisateurs, benevoles, artistes] = await Promise.all([
      prisma.conventionOrganizer.findMany({
        where: { conventionId: edition.conventionId },
        select: { user: { select: userWithProfileAndGravatarSelect } },
      }),
      prisma.editionVolunteerApplication.findMany({
        where: { eventId: editionId, status: 'ACCEPTED' },
        select: { user: { select: userWithProfileAndGravatarSelect } },
      }),
      prisma.editionArtist.findMany({
        where: { editionId },
        select: { user: { select: userWithProfileAndGravatarSelect } },
      }),
    ])

    // Une même personne peut être organisatrice ET bénévole : la Map la garde une seule fois.
    const parId = new Map<number, (typeof organisateurs)[number]['user']>()
    for (const { user: u } of [...organisateurs, ...benevoles, ...artistes]) {
      if (u) parId.set(u.id, u)
    }

    const terme = search?.toLowerCase()
    const users = [...parId.values()]
      .filter((u) => !terme || (u.pseudo ?? '').toLowerCase().includes(terme))
      .sort((a, b) => (a.pseudo ?? '').localeCompare(b.pseudo ?? ''))
      .slice(0, 20)

    return createSuccessResponse({ users })
  },
  { operationName: 'ListTreasuryAdvanceCandidates' }
)
