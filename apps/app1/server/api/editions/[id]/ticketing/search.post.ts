import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionDataOrAccessControl } from '#server/utils/permissions/edition-permissions'
import {
  aggregateHandoutItems,
  calculateHandoutItemsForTicket,
  handoutItemsIncludes,
} from '#server/utils/ticketing/handout-items'
import { sanitizeEmail } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  searchTerm: z.string().min(1),
})

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

    const body = bodySchema.parse(await readBody(event))
    const searchTerm = sanitizeEmail(body.searchTerm)

    try {
      // Rechercher dans tous les billets de l'édition (externes et manuels)
      const orderItems = await prisma.ticketingOrderItem.findMany({
        where: {
          order: {
            editionId,
          },
          OR: [
            {
              firstName: {
                contains: searchTerm,
              },
            },
            {
              lastName: {
                contains: searchTerm,
              },
            },
            {
              email: {
                contains: searchTerm,
              },
            },
          ],
        },
        include: {
          order: {
            include: {
              items: {
                include: {
                  tier: {
                    include: handoutItemsIncludes,
                  },
                  selectedOptions: {
                    include: {
                      option: {
                        include: {
                          handoutItems: {
                            include: {
                              handoutItem: true,
                            },
                          },
                        },
                      },
                    },
                    orderBy: { id: 'asc' },
                  },
                },
                orderBy: { id: 'asc' },
              },
            },
          },
          selectedOptions: {
            include: {
              option: {
                include: {
                  handoutItems: {
                    include: {
                      handoutItem: true,
                    },
                  },
                },
              },
            },
            orderBy: { id: 'asc' },
          },
        },
        take: 20, // Limiter à 20 résultats
      })

      // Rechercher dans les artistes
      const artists = await prisma.editionArtist.findMany({
        where: {
          editionId: editionId,
          OR: [
            {
              user: {
                prenom: {
                  contains: searchTerm,
                },
              },
            },
            {
              user: {
                nom: {
                  contains: searchTerm,
                },
              },
            },
            {
              user: {
                email: {
                  contains: searchTerm,
                },
              },
            },
          ],
        },
        include: {
          user: {
            select: {
              id: true,
              prenom: true,
              nom: true,
              email: true,
              phone: true,
            },
          },
          // Articles demandés pour cet artiste en particulier : chargés avec lui plutôt que
          // par une requête de plus dans la boucle qui suit.
          handoutItems: { include: { handoutItem: true } },
          // distinct : un artiste jouant dans plusieurs numéros d'un cabaret a autant de
          // liens ShowArtist pour le même spectacle, qui apparaîtrait sinon en double
          shows: {
            distinct: ['showId'],
            include: {
              show: {
                include: {
                  handoutItems: {
                    include: {
                      handoutItem: true,
                    },
                  },
                  // Le quand et le où vivent dans les représentations : un spectacle peut être
                  // joué plusieurs fois, à des endroits différents.
                  performances: {
                    select: { id: true, startDateTime: true, location: true },
                    orderBy: { startDateTime: 'asc' },
                  },
                },
              },
            },
          },
        },
        take: 20, // Limiter à 20 résultats
      })

      // Rechercher dans les organisateurs
      const organizers = await prisma.editionOrganizer.findMany({
        where: {
          editionId: editionId,
          organizer: {
            OR: [
              {
                user: {
                  prenom: {
                    contains: searchTerm,
                  },
                },
              },
              {
                user: {
                  nom: {
                    contains: searchTerm,
                  },
                },
              },
              {
                user: {
                  email: {
                    contains: searchTerm,
                  },
                },
              },
            ],
          },
        },
        include: {
          organizer: {
            include: {
              user: {
                select: {
                  id: true,
                  prenom: true,
                  nom: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
        },
        take: 20, // Limiter à 20 résultats
      })

      // Récupérer les utilisateurs qui ont validé les artistes
      const artistValidatorIds = artists
        .filter((a) => a.entryValidatedBy)
        .map((a) => a.entryValidatedBy!)
      const artistValidatorUsers = await prisma.user.findMany({
        where: { id: { in: artistValidatorIds } },
        select: { id: true, prenom: true, nom: true },
      })
      const artistValidatorMap = new Map(artistValidatorUsers.map((u) => [u.id, u]))

      // Récupérer les utilisateurs qui ont validé les organisateurs
      const organizerValidatorIds = organizers
        .filter((o) => o.entryValidatedBy)
        .map((o) => o.entryValidatedBy!)
      const organizerValidatorUsers = await prisma.user.findMany({
        where: { id: { in: organizerValidatorIds } },
        select: { id: true, prenom: true, nom: true },
      })
      const organizerValidatorMap = new Map(organizerValidatorUsers.map((u) => [u.id, u]))

      // Rechercher dans les bénévoles disponibles pendant l'événement
      // On exclut ceux qui sont uniquement disponibles pour le montage/démontage
      const volunteers = await prisma.editionVolunteerApplication.findMany({
        where: {
          eventId: editionId,
          status: 'ACCEPTED',
          // Filtrer les bénévoles disponibles pendant l'événement
          // eventAvailability peut être null (anciens bénévoles) ou true (explicitement disponible)
          // On exclut uniquement ceux qui ont explicitement indiqué qu'ils ne sont PAS disponibles pendant l'événement
          OR: [
            {
              eventAvailability: true,
            },
            {
              eventAvailability: null, // Inclure les anciens bénévoles (avant l'ajout de ce champ)
            },
          ],
          AND: [
            {
              OR: [
                {
                  user: {
                    prenom: {
                      contains: searchTerm,
                    },
                  },
                },
                {
                  user: {
                    nom: {
                      contains: searchTerm,
                    },
                  },
                },
                {
                  user: {
                    email: {
                      contains: searchTerm,
                    },
                  },
                },
              ],
            },
          ],
        },
        select: {
          id: true,
          entryValidated: true,
          entryValidatedAt: true,
          entryValidatedBy: true,
          userSnapshotPhone: true,
          user: {
            select: {
              id: true,
              prenom: true,
              nom: true,
              email: true,
              phone: true,
            },
          },
          teamAssignments: {
            select: {
              team: {
                select: {
                  id: true,
                  name: true,
                },
              },
              isLeader: true,
            },
          },
        },
        take: 20, // Limiter à 20 résultats
      })

      // Récupérer les utilisateurs qui ont validé les bénévoles
      const volunteerValidatorIds = volunteers
        .filter((v) => v.entryValidatedBy)
        .map((v) => v.entryValidatedBy!)
      const validatorUsers = await prisma.user.findMany({
        where: { id: { in: volunteerValidatorIds } },
        select: { id: true, prenom: true, nom: true },
      })
      const validatorMap = new Map(validatorUsers.map((u) => [u.id, u]))

      // Récupérer les créneaux assignés aux bénévoles
      const volunteerUserIds = volunteers.map((v) => v.user.id)
      const volunteerAssignments = await prisma.volunteerAssignment.findMany({
        where: {
          userId: { in: volunteerUserIds },
          timeSlot: {
            eventId: editionId,
          },
        },
        include: {
          timeSlot: {
            include: {
              team: true,
            },
          },
        },
        orderBy: {
          timeSlot: {
            startDateTime: 'asc',
          },
        },
      })
      // Grouper les assignments par userId
      const assignmentsByUserId = new Map<number, typeof volunteerAssignments>()
      volunteerAssignments.forEach((assignment) => {
        if (!assignmentsByUserId.has(assignment.userId)) {
          assignmentsByUserId.set(assignment.userId, [])
        }
        assignmentsByUserId.get(assignment.userId)!.push(assignment)
      })

      // Récupérer les articles à remettre pour chaque bénévole
      const handoutItemsByVolunteerId = new Map<
        number,
        Array<{ id: number; name: string; quantity: number }>
      >()
      const mealsByVolunteerId = new Map<
        number,
        Array<{ id: number; date: Date; mealType: string; phases: string[] }>
      >()

      for (const volunteer of volunteers) {
        const teamIds = volunteer.teamAssignments.map((assignment) => assignment.team.id)

        // Récupérer d'abord les articles spécifiques aux équipes du bénévole
        const teamSpecificItems = await prisma.editionVolunteerHandoutItem.findMany({
          where: {
            editionId,
            teamId: { in: teamIds },
          },
          include: {
            handoutItem: true,
            team: true,
          },
        })

        let volunteerHandoutItems
        if (teamSpecificItems.length > 0) {
          // Le bénévole a au moins une équipe avec des articles spécifiques
          // On utilise UNIQUEMENT ces articles (surcharge)
          volunteerHandoutItems = teamSpecificItems
        } else {
          // Pas d'articles spécifiques, on utilise les articles globaux
          volunteerHandoutItems = await prisma.editionVolunteerHandoutItem.findMany({
            where: {
              editionId,
              teamId: null, // Articles globaux uniquement
            },
            include: {
              handoutItem: true,
            },
          })
        }

        // Collecter les articles (équipes) ; l'agrégation a lieu après les repas.
        const volunteerItemEntries: any[] = [...volunteerHandoutItems]

        // Récupérer les repas associés au bénévole
        const volunteerMeals = await prisma.volunteerMealSelection.findMany({
          where: {
            volunteerId: volunteer.id,
            accepted: true,
            meal: {
              enabled: true,
            },
          },
          include: {
            meal: {
              include: {
                handoutItems: {
                  include: {
                    handoutItem: true,
                  },
                },
              },
            },
          },
          orderBy: {
            meal: {
              date: 'asc',
            },
          },
        })

        mealsByVolunteerId.set(
          volunteer.id,
          volunteerMeals.map((selection) => ({
            id: selection.meal.id,
            date: selection.meal.date,
            mealType: selection.meal.mealType,
            phases: Array.isArray(selection.meal.phases) ? (selection.meal.phases as string[]) : [],
          }))
        )

        // Ajouter les articles à remettre des repas
        volunteerMeals.forEach((selection) => {
          selection.meal.handoutItems.forEach((mealItem) => {
            volunteerItemEntries.push(mealItem)
          })
        })

        // Agréger : un article non cumulable n'est remis qu'une fois, un article
        // cumulable autant de fois qu'il est associé (équipes + repas).
        handoutItemsByVolunteerId.set(
          volunteer.id,
          aggregateHandoutItems(volunteerItemEntries).map((item) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
          }))
        )
      }

      // Récupérer les articles à remettre pour chaque organisateur
      const handoutItemsByOrganizerId = new Map<
        number,
        {
          specific: Array<{ id: number; name: string }>
          global: Array<{ id: number; name: string }>
        }
      >()

      for (const organizer of organizers) {
        // Articles spécifiques à cet organisateur
        const organizerSpecificItemIds = await prisma.editionOrganizerHandoutItem.findMany({
          where: {
            editionId,
            organizerId: organizer.id,
          },
          select: {
            handoutItemId: true,
            quantity: true,
          },
        })

        const specificItems = await prisma.ticketingHandoutItem.findMany({
          where: {
            id: {
              in: organizerSpecificItemIds.map((item) => item.handoutItemId),
            },
          },
        })

        // Articles globaux (pour tous les organisateurs)
        const globalItemIds = await prisma.editionOrganizerHandoutItem.findMany({
          where: {
            editionId,
            organizerId: null,
          },
          select: {
            handoutItemId: true,
            quantity: true,
          },
        })

        const globalItems = await prisma.ticketingHandoutItem.findMany({
          where: {
            id: {
              in: globalItemIds.map((item) => item.handoutItemId),
            },
          },
        })

        // Quantité définie sur chaque association, reportée sur les articles chargés.
        const specificQuantityById = new Map(
          organizerSpecificItemIds.map((a) => [a.handoutItemId, a.quantity])
        )
        const globalQuantityById = new Map(globalItemIds.map((a) => [a.handoutItemId, a.quantity]))

        handoutItemsByOrganizerId.set(organizer.id, {
          specific: specificItems.map((item) => ({
            id: item.id,
            name: item.name,
            quantity: specificQuantityById.get(item.id) ?? 1,
          })),
          global: globalItems.map((item) => ({
            id: item.id,
            name: item.name,
            quantity: globalQuantityById.get(item.id) ?? 1,
          })),
        })
      }

      // Récupérer les articles à remettre pour chaque artiste
      const handoutItemsByArtistId = new Map<
        number,
        Array<{ id: number; name: string; quantity: number }>
      >()
      const mealsByArtistId = new Map<
        number,
        Array<{ id: number; date: Date; mealType: string; phases: string[] }>
      >()

      // Articles remis à TOUS les artistes de l'édition : une seule requête pour
      // l'ensemble des artistes, et aucune s'il n'y en a pas dans les résultats.
      const editionArtistHandoutItems = artists.length
        ? await prisma.editionArtistHandoutItem.findMany({
            where: { editionId },
            include: { handoutItem: true },
          })
        : []

      for (const artist of artists) {
        // Collecter les articles de tous les spectacles ; l'agrégation a lieu
        // après les repas. Un artiste jouant dans deux spectacles reçoit deux
        // fois un article cumulable, une seule fois un article non cumulable.
        // Trois sources s'additionnent : tous les artistes, cet artiste en particulier,
        // et chacun de ses spectacles.
        const artistItemEntries: any[] = [...editionArtistHandoutItems, ...artist.handoutItems]
        artist.shows.forEach((showArtist) => {
          showArtist.show.handoutItems.forEach((item) => {
            artistItemEntries.push(item)
          })
        })

        // Récupérer les repas associés à l'artiste
        const artistMeals = await prisma.artistMealSelection.findMany({
          where: {
            artistId: artist.id,
            accepted: true,
            meal: {
              enabled: true,
            },
          },
          include: {
            meal: {
              include: {
                handoutItems: {
                  include: {
                    handoutItem: true,
                  },
                },
              },
            },
          },
          orderBy: {
            meal: {
              date: 'asc',
            },
          },
        })

        mealsByArtistId.set(
          artist.id,
          artistMeals.map((selection) => ({
            id: selection.meal.id,
            date: selection.meal.date,
            mealType: selection.meal.mealType,
            phases: Array.isArray(selection.meal.phases) ? (selection.meal.phases as string[]) : [],
          }))
        )

        // Ajouter les articles à remettre des repas
        artistMeals.forEach((selection) => {
          selection.meal.handoutItems.forEach((mealItem) => {
            artistItemEntries.push(mealItem)
          })
        })

        handoutItemsByArtistId.set(
          artist.id,
          aggregateHandoutItems(artistItemEntries).map((item) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
          }))
        )
      }

      const results = {
        tickets: orderItems.map((item) => ({
          type: 'ticket',
          isRefunded: item.order.status === 'Refunded', // Flag pour indiquer si la commande est annulée
          participant: {
            found: true,
            ticket: {
              id: item.id, // ID de OrderItem
              helloAssoItemId: item.helloAssoItemId,
              name: item.name,
              amount: item.amount,
              state: item.state,
              qrCode: item.qrCode,
              user: {
                firstName: item.firstName,
                lastName: item.lastName,
                email: item.email,
              },
              order: {
                id: item.order.helloAssoOrderId,
                status: item.order.status,
                payer: {
                  firstName: item.order.payerFirstName,
                  lastName: item.order.payerLastName,
                  email: item.order.payerEmail,
                },
                items: item.order.items.map((orderItem) => ({
                  id: orderItem.id, // ID de OrderItem
                  helloAssoItemId: orderItem.helloAssoItemId,
                  name: orderItem.name,
                  type: orderItem.type,
                  amount: orderItem.amount,
                  state: orderItem.state,
                  qrCode: orderItem.qrCode,
                  firstName: orderItem.firstName,
                  lastName: orderItem.lastName,
                  email: orderItem.email,
                  customFields: orderItem.customFields as any,
                  entryValidated: orderItem.entryValidated,
                  entryValidatedAt: orderItem.entryValidatedAt,
                  tier: orderItem.tier
                    ? {
                        id: orderItem.tier.id,
                        name: orderItem.tier.name,
                        handoutItems: calculateHandoutItemsForTicket(orderItem),
                      }
                    : null,
                  selectedOptions: orderItem.selectedOptions.map((so) => ({
                    id: so.id,
                    amount: so.amount,
                    option: {
                      id: so.option.id,
                      name: so.option.name,
                      type: so.option.type,
                      price: so.option.price,
                      handoutItems: so.option.handoutItems.map((ri) => ({
                        id: ri.handoutItem.id,
                        name: ri.handoutItem.name,
                        quantity: ri.quantity,
                      })),
                    },
                  })),
                })),
              },
              customFields: item.customFields as any,
              entryValidated: item.entryValidated,
              entryValidatedAt: item.entryValidatedAt,
              selectedOptions: item.selectedOptions.map((so) => ({
                id: so.id,
                amount: so.amount,
                option: {
                  id: so.option.id,
                  name: so.option.name,
                  type: so.option.type,
                  price: so.option.price,
                  handoutItems: so.option.handoutItems.map((ri) => ({
                    id: ri.handoutItem.id,
                    name: ri.handoutItem.name,
                  })),
                },
              })),
            },
          },
        })),
        volunteers: volunteers.map((application) => {
          const validator = application.entryValidatedBy
            ? validatorMap.get(application.entryValidatedBy)
            : null
          const assignments = assignmentsByUserId.get(application.user.id) || []
          const handoutItems = handoutItemsByVolunteerId.get(application.id) || []
          const meals = mealsByVolunteerId.get(application.id) || []
          return {
            type: 'volunteer',
            participant: {
              found: true,
              volunteer: {
                id: application.id,
                user: {
                  firstName: application.user.prenom,
                  lastName: application.user.nom,
                  email: application.user.email,
                  phone: application.userSnapshotPhone || application.user.phone,
                },
                teams: application.teamAssignments.map((assignment) => ({
                  id: assignment.team.id,
                  name: assignment.team.name,
                  isLeader: assignment.isLeader,
                })),
                timeSlots: assignments.map((assignment) => ({
                  id: assignment.timeSlot.id,
                  title: assignment.timeSlot.title,
                  team: assignment.timeSlot.team?.name,
                  startDateTime: assignment.timeSlot.startDateTime,
                  endDateTime: assignment.timeSlot.endDateTime,
                })),
                handoutItems: handoutItems,
                meals: meals,
                entryValidated: application.entryValidated,
                entryValidatedAt: application.entryValidatedAt,
                entryValidatedBy: validator
                  ? {
                      firstName: validator.prenom,
                      lastName: validator.nom,
                    }
                  : null,
              },
            },
          }
        }),
        artists: artists.map((artist) => {
          const validator = artist.entryValidatedBy
            ? artistValidatorMap.get(artist.entryValidatedBy)
            : null
          const handoutItems = handoutItemsByArtistId.get(artist.id) || []
          const meals = mealsByArtistId.get(artist.id) || []
          return {
            type: 'artist',
            participant: {
              found: true,
              artist: {
                id: artist.id,
                user: {
                  firstName: artist.user.prenom,
                  lastName: artist.user.nom,
                  email: artist.user.email,
                  phone: artist.user.phone,
                },
                shows: artist.shows.map((showArtist) => ({
                  id: showArtist.show.id,
                  title: showArtist.show.title,
                  performances: showArtist.show.performances,
                })),
                handoutItems: handoutItems,
                meals: meals,
                entryValidated: artist.entryValidated,
                entryValidatedAt: artist.entryValidatedAt,
                entryValidatedBy: validator
                  ? {
                      firstName: validator.prenom,
                      lastName: validator.nom,
                    }
                  : null,
              },
            },
          }
        }),
        organizers: organizers.map((editionOrganizer) => {
          const validator = editionOrganizer.entryValidatedBy
            ? organizerValidatorMap.get(editionOrganizer.entryValidatedBy)
            : null
          const handoutItems = handoutItemsByOrganizerId.get(editionOrganizer.id) || {
            specific: [],
            global: [],
          }
          return {
            type: 'organizer',
            participant: {
              found: true,
              organizer: {
                id: editionOrganizer.id,
                user: {
                  firstName: editionOrganizer.organizer.user.prenom,
                  lastName: editionOrganizer.organizer.user.nom,
                  email: editionOrganizer.organizer.user.email,
                  phone: editionOrganizer.organizer.user.phone,
                },
                title: editionOrganizer.organizer.title,
                handoutItems: handoutItems.specific,
                globalHandoutItems: handoutItems.global,
                entryValidated: editionOrganizer.entryValidated,
                entryValidatedAt: editionOrganizer.entryValidatedAt,
                entryValidatedBy: validator
                  ? {
                      firstName: validator.prenom,
                      lastName: validator.nom,
                    }
                  : null,
              },
            },
          }
        }),
        total: orderItems.length + volunteers.length + artists.length + organizers.length,
      }

      return createSuccessResponse({ results })
    } catch (error: unknown) {
      console.error('Database search error:', error)
      throw createError({
        status: 500,
        message: 'Erreur lors de la recherche de billets',
      })
    }
  },
  { operationName: 'POST ticketing search' }
)
