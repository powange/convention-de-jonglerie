import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import {
  calculateReturnableItemsForTicket,
  returnableItemsIncludes,
} from '#server/utils/ticketing/returnable-items'

const bodySchema = z.object({
  qrCode: z.string().min(1),
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

    try {
      // Détecter le type de QR code
      if (body.qrCode.startsWith('volunteer-')) {
        // Recherche d'un bénévole
        // Format: volunteer-{id}-{token} ou volunteer-{id} (ancien format)
        const parts = body.qrCode.replace('volunteer-', '').split('-')
        const applicationId = parseInt(parts[0])

        if (isNaN(applicationId)) {
          return createSuccessResponse({ found: false }, 'QR code bénévole invalide')
        }

        // Si un token est présent, on le vérifie
        const token = parts[1] || null

        const application = await prisma.editionVolunteerApplication.findFirst({
          where: {
            id: applicationId,
            editionId: editionId,
            status: 'ACCEPTED',
            // Vérifier le token seulement s'il est présent dans le QR code ET dans la base
            ...(token && {
              qrCodeToken: token,
            }),
            // Filtrer les bénévoles disponibles pendant l'événement
            OR: [
              {
                eventAvailability: true,
              },
              {
                eventAvailability: null, // Inclure les anciens bénévoles (avant l'ajout de ce champ)
              },
            ],
          },
          select: {
            id: true,
            userId: true,
            entryValidated: true,
            entryValidatedAt: true,
            entryValidatedBy: true,
            userSnapshotPhone: true,
            user: {
              select: {
                prenom: true,
                nom: true,
                email: true,
                phone: true,
              },
            },
            teamAssignments: {
              include: {
                team: true,
              },
            },
          },
        })

        if (application) {
          // Récupérer l'utilisateur qui a validé si applicable
          let validatedByUser = null
          if (application.entryValidatedBy) {
            validatedByUser = await prisma.user.findUnique({
              where: { id: application.entryValidatedBy },
              select: {
                prenom: true,
                nom: true,
              },
            })
          }

          // Récupérer les créneaux assignés au bénévole
          const volunteerAssignments = await prisma.volunteerAssignment.findMany({
            where: {
              userId: application.userId,
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

          // Récupérer les articles à restituer pour ce bénévole
          // Logique de surcharge : si le bénévole a une équipe avec des articles spécifiques,
          // on utilise ces articles au lieu des articles globaux
          const teamIds = application.teamAssignments.map((assignment) => assignment.teamId)

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

          // Récupérer les repas associés au bénévole
          const volunteerMeals = await prisma.volunteerMealSelection.findMany({
            where: {
              volunteerId: application.id,
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

          // Ajouter les articles à restituer des repas aux articles existants
          volunteerMeals.forEach((selection) => {
            selection.meal.returnableItems.forEach((mealItem) => {
              if (!uniqueItems.has(mealItem.returnableItem.id)) {
                uniqueItems.set(mealItem.returnableItem.id, mealItem.returnableItem)
              }
            })
          })
          const allDeduplicatedItems = Array.from(uniqueItems.values())

          return createSuccessResponse(
            {
              found: true,
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
                  timeSlots: volunteerAssignments.map((assignment) => ({
                    id: assignment.timeSlot.id,
                    title: assignment.timeSlot.title,
                    team: assignment.timeSlot.team?.name,
                    startDateTime: assignment.timeSlot.startDateTime,
                    endDateTime: assignment.timeSlot.endDateTime,
                  })),
                  returnableItems: allDeduplicatedItems.map((item) => ({
                    id: item.id,
                    name: item.name,
                  })),
                  meals: volunteerMeals.map((selection) => ({
                    id: selection.meal.id,
                    date: selection.meal.date,
                    mealType: selection.meal.mealType,
                    phases: selection.meal.phases,
                  })),
                  entryValidated: application.entryValidated,
                  entryValidatedAt: application.entryValidatedAt,
                  entryValidatedBy: validatedByUser
                    ? {
                        firstName: validatedByUser.prenom,
                        lastName: validatedByUser.nom,
                      }
                    : null,
                },
              },
            },
            `Bénévole trouvé : ${application.user.prenom} ${application.user.nom}`
          )
        } else {
          return createSuccessResponse(
            { found: false },
            'Aucun bénévole accepté trouvé avec ce QR code'
          )
        }
      } else if (body.qrCode.startsWith('artist-')) {
        // Recherche d'un artiste
        // Format: artist-{id}-{token} ou artist-{id} (ancien format)
        const parts = body.qrCode.replace('artist-', '').split('-')
        const artistId = parseInt(parts[0])

        if (isNaN(artistId)) {
          return createSuccessResponse({ found: false }, 'QR code artiste invalide')
        }

        // Si un token est présent, on le vérifie
        const token = parts[1] || null

        const artist = await prisma.editionArtist.findFirst({
          where: {
            id: artistId,
            editionId: editionId,
            // Vérifier le token seulement s'il est présent dans le QR code ET dans la base
            ...(token && {
              qrCodeToken: token,
            }),
          },
          include: {
            user: {
              select: {
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
        })

        if (artist) {
          // Récupérer l'utilisateur qui a validé si applicable
          let validatedByUser = null
          if (artist.entryValidatedBy) {
            validatedByUser = await prisma.user.findUnique({
              where: { id: artist.entryValidatedBy },
              select: {
                prenom: true,
                nom: true,
              },
            })
          }

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

          // Ajouter les articles à restituer des repas aux articles existants
          artistMeals.forEach((selection) => {
            selection.meal.returnableItems.forEach((mealItem) => {
              if (!uniqueItems.has(mealItem.returnableItem.id)) {
                uniqueItems.set(mealItem.returnableItem.id, mealItem.returnableItem)
              }
            })
          })
          const allDeduplicatedItems = Array.from(uniqueItems.values())

          return createSuccessResponse(
            {
              found: true,
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
                  returnableItems: allDeduplicatedItems.map((item) => ({
                    id: item.id,
                    name: item.name,
                  })),
                  meals: artistMeals.map((selection) => ({
                    id: selection.meal.id,
                    date: selection.meal.date,
                    mealType: selection.meal.mealType,
                    phases: selection.meal.phases,
                  })),
                  entryValidated: artist.entryValidated,
                  entryValidatedAt: artist.entryValidatedAt,
                  entryValidatedBy: validatedByUser
                    ? {
                        firstName: validatedByUser.prenom,
                        lastName: validatedByUser.nom,
                      }
                    : null,
                },
              },
            },
            `Artiste trouvé : ${artist.user.prenom} ${artist.user.nom}`
          )
        } else {
          return createSuccessResponse({ found: false }, 'Aucun artiste trouvé avec ce QR code')
        }
      } else if (body.qrCode.startsWith('organizer-')) {
        // Recherche d'un organisateur
        // Format: organizer-{id}-{token} ou organizer-{id} (ancien format)
        const parts = body.qrCode.replace('organizer-', '').split('-')
        const editionOrganizerId = parseInt(parts[0])
        const token = parts[1] || null

        if (isNaN(editionOrganizerId)) {
          return createSuccessResponse({ found: false }, 'QR code organisateur invalide')
        }

        const editionOrganizer = await prisma.editionOrganizer.findFirst({
          where: {
            id: editionOrganizerId,
            editionId: editionId,
            ...(token && {
              qrCodeToken: token,
            }),
          },
          include: {
            organizer: {
              include: {
                user: {
                  select: {
                    prenom: true,
                    nom: true,
                    email: true,
                    phone: true,
                  },
                },
              },
            },
          },
        })

        if (editionOrganizer && editionOrganizer.organizer) {
          // Récupérer l'utilisateur qui a validé si applicable
          let validatedByUser = null
          if (editionOrganizer.entryValidatedBy) {
            validatedByUser = await prisma.user.findUnique({
              where: { id: editionOrganizer.entryValidatedBy },
              select: {
                prenom: true,
                nom: true,
              },
            })
          }

          // Récupérer les articles à restituer pour cet organisateur
          // Articles spécifiques à cet organisateur
          const organizerSpecificItemIds = await prisma.editionOrganizerReturnableItem.findMany({
            where: {
              editionId,
              organizerId: editionOrganizer.id,
            },
            select: {
              returnableItemId: true,
            },
          })

          const organizerSpecificItems = await prisma.ticketingReturnableItem.findMany({
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

          return createSuccessResponse(
            {
              found: true,
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
                  returnableItems: organizerSpecificItems.map((item) => ({
                    id: item.id,
                    name: item.name,
                  })),
                  globalReturnableItems: globalItems.map((item) => ({
                    id: item.id,
                    name: item.name,
                  })),
                  entryValidated: editionOrganizer.entryValidated,
                  entryValidatedAt: editionOrganizer.entryValidatedAt,
                  entryValidatedBy: validatedByUser
                    ? {
                        firstName: validatedByUser.prenom,
                        lastName: validatedByUser.nom,
                      }
                    : null,
                },
              },
            },
            `Organisateur trouvé : ${editionOrganizer.organizer.user.prenom} ${editionOrganizer.organizer.user.nom}`
          )
        } else {
          return createSuccessResponse(
            { found: false },
            'Aucun organisateur trouvé avec ce QR code'
          )
        }
      } else {
        // Recherche d'un billet HelloAsso
        const config = await prisma.externalTicketing.findUnique({
          where: { editionId },
          include: {
            helloAssoConfig: true,
          },
        })

        if (!config || !config.helloAssoConfig) {
          throw createError({
            status: 404,
            message: 'Configuration HelloAsso introuvable',
          })
        }

        const orderItem = await prisma.ticketingOrderItem.findFirst({
          where: {
            qrCode: body.qrCode,
            order: {
              editionId: editionId,
            },
          },
          include: {
            order: {
              include: {
                items: {
                  include: {
                    tier: {
                      include: returnableItemsIncludes,
                    },
                  },
                  orderBy: { id: 'asc' },
                },
              },
            },
          },
        })

        if (orderItem) {
          return createSuccessResponse(
            {
              found: true,
              type: 'ticket',
              isRefunded: orderItem.order.status === 'Refunded', // Nouveau flag pour indiquer si la commande est annulée
              participant: {
                found: true,
                ticket: {
                  id: orderItem.id, // ID de OrderItem
                  helloAssoItemId: orderItem.helloAssoItemId,
                  name: orderItem.name,
                  amount: orderItem.amount,
                  state: orderItem.state,
                  qrCode: orderItem.qrCode,
                  user: {
                    firstName: orderItem.firstName,
                    lastName: orderItem.lastName,
                    email: orderItem.email,
                  },
                  order: {
                    id: orderItem.order.helloAssoOrderId,
                    status: orderItem.order.status,
                    payer: {
                      firstName: orderItem.order.payerFirstName,
                      lastName: orderItem.order.payerLastName,
                      email: orderItem.order.payerEmail,
                    },
                    items: orderItem.order.items.map((item) => ({
                      id: item.id, // ID de OrderItem (au lieu de helloAssoItemId qui peut être null)
                      helloAssoItemId: item.helloAssoItemId,
                      name: item.name,
                      type: item.type,
                      amount: item.amount,
                      state: item.state,
                      qrCode: item.qrCode,
                      firstName: item.firstName,
                      lastName: item.lastName,
                      email: item.email,
                      customFields: item.customFields as any,
                      entryValidated: item.entryValidated,
                      entryValidatedAt: item.entryValidatedAt,
                      tier: item.tier
                        ? {
                            id: item.tier.id,
                            name: item.tier.name,
                            returnableItems: calculateReturnableItemsForTicket(item),
                          }
                        : null,
                    })),
                  },
                  customFields: orderItem.customFields as any,
                },
              },
            },
            `Billet trouvé pour ${orderItem.firstName} ${orderItem.lastName}`
          )
        } else {
          return createSuccessResponse({ found: false }, 'Aucun billet trouvé avec ce QR code')
        }
      }
    } catch (error: unknown) {
      console.error('Database verify QR code error:', error)
      throw createError({
        status: 500,
        message: 'Erreur lors de la recherche du billet',
      })
    }
  },
  { operationName: 'POST ticketing verify' }
)
