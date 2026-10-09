import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageEditionOrganizers,
  canManageTicketing,
} from '#server/utils/permissions/edition-permissions'
import { userWithNameSelect } from '#server/utils/prisma-select-helpers'
import { rolesDeLEdition } from '~~/shared/utils/roles-edition'

export default wrapApiHandler(
  async (event) => {
    /*
     * `requireAuth` comme les 414 autres handlers du dépôt : il lit `event.context.user`, que le
     * middleware d'authentification a déjà rempli, et le rend typé `AuthenticatedUser` — donc
     * avec `id` et `isGlobalAdmin`, que les contrôles de permission attendent.
     *
     * ⚠️ Ce commentaire affirmait « C'est déjà ce qu'emploie le POST voisin ». C'ÉTAIT FAUX : le
     * POST, `available.get.ts` et la suppression employaient `requireUserSession`, qui relit et
     * descelle le cookie une seconde fois pour rien. Les trois ont été alignés ici.
     */
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Récupérer l'édition avec permissions
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        convention: {
          include: {
            organizers: {
              where: {
                userId: user.id,
              },
            },
          },
        },
        organizerPermissions: {
          where: {
            organizer: {
              userId: user.id,
            },
          },
          include: {
            organizer: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    })

    if (!edition) {
      throw createError({
        status: 404,
        message: 'Edition not found',
      })
    }

    // Vérifier les permissions.
    // La liste des organisateurs de l'édition est consommée par DEUX features :
    // la gestion des organisateurs ET la billetterie (page handout-items, section
    // « articles spécifiques par organisateur »). On autorise donc les deux rôles :
    // gestionnaire d'organisateurs OU gestionnaire de billetterie.
    // Un gestionnaire billetterie (sans droit sur les organisateurs) n'accède qu'aux
    // infos non sensibles (voir le masquage email/téléphone plus bas).
    const canManageOrganizers = canManageEditionOrganizers(edition, user)
    if (!canManageOrganizers && !canManageTicketing(edition, user)) {
      throw createError({
        status: 403,
        message: "Vous n'avez pas les droits pour gérer les organisateurs",
      })
    }

    try {
      // Repas activés de l'édition : un organisateur y a droit par défaut, seules les
      // exceptions (accepted = false) sont stockées. Le compteur affiché dans le tableau est
      // donc « total - exceptions ».
      const enabledMealIds = edition.mealsEnabled
        ? (
            await prisma.volunteerMeal.findMany({
              where: { editionId, enabled: true },
              select: { id: true },
            })
          ).map((meal) => meal.id)
        : []

      // Récupérer tous les EditionOrganizer pour cette édition
      const editionOrganizers = await prisma.editionOrganizer.findMany({
        where: {
          editionId: editionId,
        },
        select: {
          id: true,
          organizerId: true,
          entryValidated: true,
          entryValidatedAt: true,
          // Arrivée et départ sur place, au format des bénévoles : le tableau les affiche et sa
          // modale les modifie. Ils alimentent le graphique d'affluence.
          arrivalDateTime: true,
          departureDateTime: true,
          createdAt: true,
          mealSelections: {
            where: { accepted: false, mealId: { in: enabledMealIds } },
            select: { mealId: true },
          },
          // Équipes de bénévolat auxquelles l'organisateur est rattaché, pour les afficher
          // sur sa ligne comme les repas.
          teamAssignments: {
            select: {
              isLeader: true,
              team: { select: { id: true, name: true, color: true } },
            },
          },
          organizer: {
            select: {
              id: true,
              title: true,
              // Les droits de convention : ils valent sur toutes les éditions, et sans eux la
              // colonne « Rôles » paraîtrait vide pour un membre permanent de l'équipe.
              canManageVolunteers: true,
              canManageArtists: true,
              canManageMeals: true,
              canManageTicketing: true,
              canManageTasks: true,
              canManageStock: true,
              canManageWorkshops: true,
              canManageFAQ: true,
              canManageTreasury: true,
              // Et ceux accordés sur CETTE édition seulement.
              perEditionPermissions: {
                where: { editionId },
                select: {
                  canManageVolunteers: true,
                  canManageArtists: true,
                  canManageMeals: true,
                  canManageTicketing: true,
                  canManageTasks: true,
                  canManageStock: true,
                  canManageWorkshops: true,
                  canManageFAQ: true,
                  canManageTreasury: true,
                },
              },
              user: {
                select: {
                  ...userWithNameSelect,
                  email: true,
                  emailHash: true,
                  phone: true,
                  profilePicture: true,
                },
              },
            },
          },
        },
        orderBy: {
          organizer: {
            user: {
              nom: 'asc',
            },
          },
        },
      })

      return createSuccessResponse({
        organizers: editionOrganizers.map((eo) => ({
          id: eo.id,
          organizerId: eo.organizerId,
          // Ce que cette personne peut réellement gérer ici — voir `roles-edition`.
          roles: rolesDeLEdition(
            eo.organizer,
            // `?.` délibéré : une relation absente ne doit pas faire tomber TOUTE la page des
            // organisateurs en 500. Mieux vaut une colonne de rôles incomplète qu'un écran mort.
            eo.organizer.perEditionPermissions?.[0] ?? null,
            eo.organizer.user.id === edition.creatorId ||
              eo.organizer.user.id === edition.convention.authorId
          ),
          entryValidated: eo.entryValidated,
          entryValidatedAt: eo.entryValidatedAt,
          arrivalDateTime: eo.arrivalDateTime,
          departureDateTime: eo.departureDateTime,
          createdAt: eo.createdAt,
          title: eo.organizer.title,
          meals: {
            accepted: enabledMealIds.length - eo.mealSelections.length,
            total: enabledMealIds.length,
          },
          // Aplati : la ligne du tableau affiche des équipes, pas des rattachements. Le statut
          // de responsable voyage avec l'équipe, c'est de celle-ci qu'on est responsable.
          teams: eo.teamAssignments.map((rattachement) => ({
            ...rattachement.team,
            isLeader: rattachement.isLeader,
          })),
          user: {
            id: eo.organizer.user.id,
            pseudo: eo.organizer.user.pseudo,
            prenom: eo.organizer.user.prenom,
            nom: eo.organizer.user.nom,
            pronouns: eo.organizer.user.pronouns,
            emailHash: eo.organizer.user.emailHash,
            profilePicture: eo.organizer.user.profilePicture,
            // Infos sensibles (email, téléphone) réservées aux gestionnaires
            // d'organisateurs. Masquées pour un accès via la billetterie (handout-items).
            ...(canManageOrganizers
              ? { email: eo.organizer.user.email, phone: eo.organizer.user.phone }
              : {}),
          },
        })),
        total: editionOrganizers.length,
      })
    } catch (error: unknown) {
      console.error('Database error fetching edition organizers:', error)
      throw createError({
        status: 500,
        message: "Erreur lors de la récupération des organisateurs de l'édition",
      })
    }
  },
  { operationName: 'GET edition organizers' }
)
