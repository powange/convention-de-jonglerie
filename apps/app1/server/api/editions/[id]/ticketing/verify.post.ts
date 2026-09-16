import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionDataOrAccessControl } from '#server/utils/permissions/edition-permissions'
import {
  aggregateHandoutItems,
  calculateHandoutItemsForTicket,
  handoutItemsIncludes,
  selectedOptionsIncludes,
} from '#server/utils/ticketing/handout-items'

const bodySchema = z.object({
  qrCode: z.string().min(1),
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

    try {
      // Détecter le type de QR code
      if (body.qrCode.startsWith('volunteer-')) {
        // Recherche d'un bénévole
        // Format: volunteer-{id}-{token} ou volunteer-{id} (ancien format)
        const parts = body.qrCode.replace('volunteer-', '').split('-')
        const applicationId = parseInt(parts[0] ?? '')

        if (isNaN(applicationId)) {
          return createSuccessResponse({ found: false }, 'QR code bénévole invalide')
        }

        // Si un token est présent, on le vérifie
        const token = parts[1] || null

        const application = await prisma.editionVolunteerApplication.findFirst({
          where: {
            id: applicationId,
            eventId: editionId,
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

          // Récupérer les articles à remettre pour ce bénévole
          // Logique de surcharge : si le bénévole a une équipe avec des articles spécifiques,
          // on utilise ces articles au lieu des articles globaux
          const teamIds = application.teamAssignments.map((assignment) => assignment.teamId)

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
              volunteerId: application.id,
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

          // Ajouter les articles à remettre des repas
          volunteerMeals.forEach((selection) => {
            selection.meal.handoutItems.forEach((mealItem) => {
              volunteerItemEntries.push(mealItem)
            })
          })
          const allHandoutItems = aggregateHandoutItems(volunteerItemEntries)

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
                  handoutItems: allHandoutItems.map((item) => ({
                    id: item.id,
                    name: item.name,
                    quantity: item.quantity,
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
        const artistId = parseInt(parts[0] ?? '')

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
                    // Le quand et le où vivent dans les représentations : un spectacle peut
                    // être joué plusieurs fois, à des endroits différents.
                    performances: {
                      select: { id: true, startDateTime: true, location: true },
                      orderBy: { startDateTime: 'asc' },
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

          // Articles remis à TOUS les artistes de l'édition, puis ceux de chaque
          // spectacle ; l'agrégation a lieu après les repas (un article cumulable
          // est remis une fois par association).
          const editionArtistHandoutItems = await prisma.editionArtistHandoutItem.findMany({
            where: { editionId },
            include: { handoutItem: true },
          })
          // Trois sources s'additionnent : tous les artistes, cet artiste en particulier,
          // et chacun de ses spectacles.
          const artistOwnHandoutItems = await prisma.artistHandoutItem.findMany({
            where: { artistId: artist.id },
            include: { handoutItem: true },
          })
          const artistItemEntries: any[] = [...editionArtistHandoutItems, ...artistOwnHandoutItems]
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

          // Ajouter les articles à remettre des repas
          artistMeals.forEach((selection) => {
            selection.meal.handoutItems.forEach((mealItem) => {
              artistItemEntries.push(mealItem)
            })
          })
          const allHandoutItems = aggregateHandoutItems(artistItemEntries)

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
                    performances: showArtist.show.performances,
                  })),
                  handoutItems: allHandoutItems.map((item) => ({
                    id: item.id,
                    name: item.name,
                    quantity: item.quantity,
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
        const editionOrganizerId = parseInt(parts[0] ?? '')
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

          // Les articles de cet organisateur ET ceux de tous les organisateurs, en deux requêtes
          // au lieu de quatre.
          //
          // Deux et non une : `EditionOrganizerHandoutItem` ne porte PAS de relation vers
          // `TicketingHandoutItem`, seulement la colonne `handoutItemId` — contrairement à ses
          // jumeaux bénévoles et artistes. Un `include` y est donc impossible sans toucher au
          // schéma, et les deux lectures d'origine n'étaient pas une négligence.
          const organizerAssociations = await prisma.editionOrganizerHandoutItem.findMany({
            where: {
              editionId,
              // `null` vaut « tous les organisateurs » : les deux portées s'additionnent, à la
              // différence des bénévoles où l'équipe remplace le global.
              //
              // ⚠️ Un `in: [id, null]` ne conviendrait PAS : il produit `IN (id, NULL)`, et en
              // SQL une comparaison avec NULL n'est jamais vraie — les articles globaux
              // disparaîtraient sans erreur.
              OR: [{ organizerId: editionOrganizer.id }, { organizerId: null }],
            },
            select: { handoutItemId: true, quantity: true },
          })

          const organizerItems = await prisma.ticketingHandoutItem.findMany({
            // Borné à l'édition : les identifiants en viennent déjà, mais une garde qui ne coûte
            // rien vaut mieux qu'une confiance implicite.
            where: { editionId, id: { in: organizerAssociations.map((a) => a.handoutItemId) } },
          })
          const organizerItemById = new Map(organizerItems.map((item) => [item.id, item]))

          // Les repas auxquels cet organisateur est inscrit, et les articles qui s'y attachent.
          //
          // Un ticket de cantine est un article comme un autre : les bénévoles et les artistes le
          // recevaient, pas les organisateurs — alors qu'ils s'inscrivent aux mêmes repas. Ils
          // repartaient donc sans leur ticket, pour la seule raison que cette branche-ci ne
          // lisait aucune sélection.
          const organizerMeals = await prisma.organizerMealSelection.findMany({
            where: {
              editionOrganizerId: editionOrganizer.id,
              accepted: true,
              meal: { enabled: true },
            },
            include: {
              meal: {
                include: { handoutItems: { include: { handoutItem: true } } },
              },
            },
            orderBy: { meal: { date: 'asc' } },
          })

          // Même agrégation que pour les trois autres populations. Sans elle, un article donné
          // à la fois globalement et nommément apparaîtrait deux fois, et `cumulative` ne
          // s'appliquerait jamais aux organisateurs.
          const allHandoutItems = aggregateHandoutItems([
            ...organizerAssociations.flatMap((association) => {
              const handoutItem = organizerItemById.get(association.handoutItemId)
              return handoutItem ? [{ handoutItem, quantity: association.quantity }] : []
            }),
            ...organizerMeals.flatMap((selection) => selection.meal.handoutItems),
          ])

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
                  handoutItems: allHandoutItems.map((item) => ({
                    id: item.id,
                    name: item.name,
                    quantity: item.quantity,
                  })),
                  meals: organizerMeals.map((selection) => ({
                    id: selection.meal.id,
                    date: selection.meal.date,
                    mealType: selection.meal.mealType,
                    phases: selection.meal.phases,
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
                // La provenance de la commande, pour que la fiche affiche le bon logo. Sans
                // elle, l'écran ne pouvait que déduire « HelloAsso ou rien » de la présence d'un
                // `helloAssoOrderId` — et une commande Infomaniak restait sans origine.
                externalTicketing: { select: { provider: true } },
                items: {
                  include: {
                    tier: {
                      include: handoutItemsIncludes,
                    },
                    // Les options souscrites, sans quoi ni elles ni leurs articles n'existent
                    // pour l'écran de guichet — alors que la recherche par nom, elle, les
                    // remonte. Deux façons de trouver la même personne rendaient deux listes
                    // différentes, et le scan est pourtant le geste normal à l'entrée.
                    ...selectedOptionsIncludes,
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
                    /** `null` quand la commande a été saisie sur place. */
                    provider: orderItem.order.externalTicketing?.provider ?? null,
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
                          }
                        : null,
                      // La liste complète, tarif + options + champs personnalisés déjà
                      // agrégés : elle est portée par le billet et non par son tarif, puisque
                      // ses sources le débordent.
                      handoutItems: calculateHandoutItemsForTicket(item),
                      selectedOptions: item.selectedOptions.map((so) => ({
                        id: so.id,
                        amount: so.amount,
                        option: {
                          id: so.option.id,
                          name: so.option.name,
                          type: so.option.type,
                          price: so.option.price,
                        },
                      })),
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
