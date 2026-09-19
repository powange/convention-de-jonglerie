import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { validateResourceId } from '#server/utils/validation-helpers'

/**
 * Les éditions auxquelles un profil est rattaché, et à quel titre.
 *
 * La fiche d'administration affichait déjà des compteurs de données liées, mais ils répondent à une
 * autre question : ce qu'une suppression détruirait. Ils sont groupés par nature de lien, jamais par
 * édition — on y lisait « 2 candidatures bénévoles » sans pouvoir dire lesquelles.
 *
 * Une seule requête suffit : on part des éditions plutôt que des six relations, et chaque rôle est
 * une sous-sélection filtrée sur cette personne. Six requêtes à recouper en mémoire donneraient le
 * même résultat, en laissant la pagination et le tri à faire à la main.
 */

/** Ce qu'il faut d'une édition pour la nommer et y renvoyer. */
const resumeEdition = {
  id: true,
  name: true,
  startDate: true,
  endDate: true,
  city: true,
  country: true,
  imageUrl: true,
  creatorId: true,
  convention: { select: { id: true, name: true } },
} as const

export type RoleSurEdition =
  | { type: 'creator' }
  | { type: 'organizer' }
  | { type: 'attendee' }
  | { type: 'artist' }
  | { type: 'volunteer'; statut: 'PENDING' | 'ACCEPTED' | 'REJECTED' }
  | { type: 'show'; statut: 'PENDING' | 'ACCEPTED' | 'REJECTED' }

export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)
    const userId = validateResourceId(event, 'id', 'utilisateur')

    const editions = await prisma.edition.findMany({
      where: {
        OR: [
          { creatorId: userId },
          { attendingUsers: { some: { id: userId } } },
          { artists: { some: { userId } } },
          { editionOrganizers: { some: { organizer: { userId } } } },
          { event: { volunteerApplications: { some: { userId } } } },
          { showCalls: { some: { applications: { some: { userId } } } } },
        ],
      },
      select: {
        ...resumeEdition,
        // Chaque sous-sélection est filtrée sur cette personne : ce qui remonte n'est pas la liste
        // des artistes de l'édition, mais la preuve que celle-ci y est artiste.
        attendingUsers: { where: { id: userId }, select: { id: true } },
        artists: { where: { userId }, select: { id: true } },
        editionOrganizers: { where: { organizer: { userId } }, select: { id: true } },
        event: {
          select: {
            volunteerApplications: {
              where: { userId },
              select: { id: true, status: true, createdAt: true },
            },
          },
        },
        showCalls: {
          where: { applications: { some: { userId } } },
          select: { applications: { where: { userId }, select: { id: true, status: true } } },
        },
      },
      // Les éditions à venir et les plus récentes d'abord : c'est ce qu'on cherche en ouvrant une
      // fiche, et un profil ancien peut en aligner beaucoup.
      orderBy: { startDate: 'desc' },
    })

    return editions.map((edition) => {
      const roles: RoleSurEdition[] = []

      if (edition.creatorId === userId) roles.push({ type: 'creator' })
      if (edition.editionOrganizers.length > 0) roles.push({ type: 'organizer' })
      if (edition.attendingUsers.length > 0) roles.push({ type: 'attendee' })
      if (edition.artists.length > 0) roles.push({ type: 'artist' })

      // Le statut compte autant que le rôle : une candidature refusée n'est pas une participation,
      // et les confondre ferait passer un profil pour un bénévole de l'édition.
      for (const candidature of edition.event.volunteerApplications) {
        roles.push({ type: 'volunteer', statut: candidature.status })
      }
      for (const appel of edition.showCalls) {
        for (const candidature of appel.applications) {
          roles.push({ type: 'show', statut: candidature.status })
        }
      }

      return {
        id: edition.id,
        name: edition.name,
        startDate: edition.startDate,
        endDate: edition.endDate,
        city: edition.city,
        country: edition.country,
        imageUrl: edition.imageUrl,
        convention: edition.convention,
        roles,
      }
    })
  },
  { operationName: 'GetAdminUserEditions' }
)
