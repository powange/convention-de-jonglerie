import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import {
  calculateReturnableItemsForTicket,
  returnableItemsIncludes,
} from '#server/utils/ticketing/returnable-items'
import { sanitizeEmail } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  searchTerm: z.string().min(1),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
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
                    include: returnableItemsIncludes,
                  },
                  selectedOptions: {
                    include: {
                      option: {
                        include: {
                          returnableItems: {
                            include: {
                              returnableItem: true,
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
                  returnableItems: {
                    include: {
                      returnableItem: true,
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
          shows: {
            include: {
              show: {
                include: {
                  returnableItems: {
                    include: {
                      returnableItem: true,
                    },
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
          editionId: editionId,
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
            editionId: editionId,
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

      // Récupérer les articles à restituer pour chaque bénévole
      const returnableItemsByVolunteerId = new Map<number, Array<{ id: number; name: string }>>()
      const mealsByVolunteerId = new Map<
        number,
        Array<{ id: number; date: Date; mealType: string; phases: string[] }>
      >()

      for (const volunteer of volunteers) {
        const teamIds = volunteer.teamAssignments.map((assignment) => assignment.team.id)

        // Récupérer d'abord les articles spécifiques aux équipes du bénévole
        const teamSpecificItems = await prisma.editionVolunteerReturnableItem.findMany({
          where: {
            editionId,
            teamId: { in: teamIds },
          },
          include: {
            returnableItem: true,
            team: true,
          },
        })

        let volunteerReturnableItems
        if (teamSpecificItems.length > 0) {
          // Le bénévole a au moins une équipe avec des articles spécifiques
          // On utilise UNIQUEMENT ces articles (surcharge)
          volunteerReturnableItems = teamSpecificItems
        } else {
          // Pas d'articles spécifiques, on utilise les articles globaux
          volunteerReturnableItems = await prisma.editionVolunteerReturnableItem.findMany({
            where: {
              editionId,
              teamId: null, // Articles globaux uniquement
            },
            include: {
              returnableItem: true,
            },
          })
        }

        // Dédupliquer les articles (si le bénévole est dans plusieurs équipes avec le même article)
        const uniqueItems = new Map()
        volunteerReturnableItems.forEach((item) => {
          if (!uniqueItems.has(item.returnableItem.id)) {
            uniqueItems.set(item.returnableItem.id, item.returnableItem)
          }
        })
        const deduplicatedItems = Array.from(uniqueItems.values())

        returnableItemsByVolunteerId.set(
          volunteer.id,
          deduplicatedItems.map((item) => ({
            id: item.id,
            name: item.name,
          }))
        )

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
                returnableItems: {
                  include: {
                    returnableItem: true,
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
            phases: selection.meal.phases,
          }))
        )

        // Ajouter les articles à restituer des repas aux articles existants
        volunteerMeals.forEach((selection) => {
          selection.meal.returnableItems.forEach((mealItem) => {
            if (!uniqueItems.has(mealItem.returnableItem.id)) {
              uniqueItems.set(mealItem.returnableItem.id, mealItem.returnableItem)
            }
          })
        })

        // Mettre à jour les articles dédupliqués avec les articles des repas
        const allDeduplicatedItems = Array.from(uniqueItems.values())
        returnableItemsByVolunteerId.set(
          volunteer.id,
          allDeduplicatedItems.map((item) => ({
            id: item.id,
            name: item.name,
          }))
        )
      }

      // Récupérer les articles à restituer pour chaque organisateur
      const returnableItemsByOrganizerId = new Map<
        number,
        {
          specific: Array<{ id: number; name: string }>
          global: Array<{ id: number; name: string }>
        }
      >()

      for (const organizer of organizers) {
        // Articles spécifiques à cet organisateur
        const organizerSpecificItemIds = await prisma.editionOrganizerReturnableItem.findMany({
          where: {
            editionId,
            organizerId: organizer.id,
          },
          select: {
            returnableItemId: true,
          },
        })

        const specificItems = await prisma.ticketingReturnableItem.findMany({
          where: {
            id: {
              in: organizerSpecificItemIds.map((item) => item.returnableItemId),
            },
          },
        })

        // Articles globaux (pour tous les organisateurs)
        const globalItemIds = await prisma.editionOrganizerReturnableItem.findMany({
          where: {
            editionId,
            organizerId: null,
          },
          select: {
            returnableItemId: true,
          },
        })

        const globalItems = await prisma.ticketingReturnableItem.findMany({
          where: {
            id: {
              in: globalItemIds.map((item) => item.returnableItemId),
            },
          },
        })

        returnableItemsByOrganizerId.set(organizer.id, {
          specific: specificItems.map((item) => ({
            id: item.id,
            name: item.name,
          })),
          global: globalItems.map((item) => ({
            id: item.id,
            name: item.name,
          })),
        })
      }

      // Récupérer les articles à restituer pour chaque artiste
      const returnableItemsByArtistId = new Map<number, Array<{ id: number; name: string }>>()
      const mealsByArtistId = new Map<
        number,
        Array<{ id: number; date: Date; mealType: string; phases: string[] }>
      >()

      for (const artist of artists) {
        // Récupérer et dédupliquer les articles à restituer depuis tous les spectacles
        const uniqueItems = new Map()
        artist.shows.forEach((showArtist) => {
          showArtist.show.returnableItems.forEach((item) => {
            if (!uniqueItems.has(item.returnableItem.id)) {
              uniqueItems.set(item.returnableItem.id, item.returnableItem)
            }
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
                returnableItems: {
                  include: {
                    returnableItem: true,
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
            phases: selection.meal.phases,
          }))
        )

        // Ajouter les articles à restituer des repas aux articles existants
        artistMeals.forEach((selection) => {
          selection.meal.returnableItems.forEach((mealItem) => {
            if (!uniqueItems.has(mealItem.returnableItem.id)) {
              uniqueItems.set(mealItem.returnableItem.id, mealItem.returnableItem)
            }
          })
        })

        // Mettre à jour les articles dédupliqués avec les articles des repas
        const allDeduplicatedItems = Array.from(uniqueItems.values())
        returnableItemsByArtistId.set(
          artist.id,
          allDeduplicatedItems.map((item) => ({
            id: item.id,
            name: item.name,
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
                        returnableItems: calculateReturnableItemsForTicket(orderItem),
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
                      returnableItems: so.option.returnableItems.map((ri) => ({
                        id: ri.returnableItem.id,
                        name: ri.returnableItem.name,
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
                  returnableItems: so.option.returnableItems.map((ri) => ({
                    id: ri.returnableItem.id,
                    name: ri.returnableItem.name,
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
          const returnableItems = returnableItemsByVolunteerId.get(application.id) || []
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
                returnableItems: returnableItems,
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
          const returnableItems = returnableItemsByArtistId.get(artist.id) || []
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
                  startDateTime: showArtist.show.startDateTime,
                  location: showArtist.show.location,
                })),
                returnableItems: returnableItems,
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
          const returnableItems = returnableItemsByOrganizerId.get(editionOrganizer.id) || {
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
                returnableItems: returnableItems.specific,
                globalReturnableItems: returnableItems.global,
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

      return {
        success: true,
        results,
      }
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
