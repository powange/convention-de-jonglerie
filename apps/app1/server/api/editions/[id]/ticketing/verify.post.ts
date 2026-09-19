import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionDataOrAccessControl } from '#server/utils/permissions/edition-permissions'
import { designerLaPersonne } from '#server/utils/ticketing/designation-participant'
import {
  aggregateHandoutItems,
  calculateHandoutItemsForTicket,
  handoutItemsIncludes,
  selectedOptionsIncludes,
} from '#server/utils/ticketing/handout-items'
import { articlesARemettreActifs } from '#server/utils/ticketing/handout-items-actifs'

/**
 * Deux demandes distinctes, et c'est volontaire : un QR code présenté au scan doit porter son
 * jeton, une relecture demandée par l'écran de gestion n'a rien à prouver de plus que le droit
 * de qui la demande. Voir `designation-participant.ts` pour le détail de cette séparation.
 */
const bodySchema = z.union([
  z.object({ qrCode: z.string().min(1) }),
  z.object({
    type: z.enum(['volunteer', 'artist', 'organizer']),
    id: z.number().int().positive(),
  }),
])

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

    // L'interrupteur de l'édition coupe la remise elle-même, et pas seulement l'entrée de menu :
    // éteint, le guichet ne réclame plus rien à personne. Lu une fois pour les quatre branches.
    const articlesActifs = await articlesARemettreActifs(editionId)

    const demande = designerLaPersonne(body)
    if (demande.genre === 'refus') {
      return createSuccessResponse({ found: false, raison: demande.cle })
    }

    try {
      if (demande.genre === 'volunteer') {
        const applicationId = demande.id

        const application = await prisma.editionVolunteerApplication.findFirst({
          where: {
            id: applicationId,
            eventId: editionId,
            status: 'ACCEPTED',
            ...demande.preuve,
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
          const allHandoutItems = articlesActifs ? aggregateHandoutItems(volunteerItemEntries) : []

          return createSuccessResponse({
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
          })
        } else {
          return createSuccessResponse({ found: false, raison: 'volunteer' })
        }
      } else if (demande.genre === 'artist') {
        const artistId = demande.id

        const artist = await prisma.editionArtist.findFirst({
          where: {
            id: artistId,
            editionId: editionId,
            ...demande.preuve,
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
          const allHandoutItems = articlesActifs ? aggregateHandoutItems(artistItemEntries) : []

          return createSuccessResponse({
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
          })
        } else {
          return createSuccessResponse({ found: false, raison: 'artist' })
        }
      } else if (demande.genre === 'organizer') {
        const editionOrganizerId = demande.id

        const editionOrganizer = await prisma.editionOrganizer.findFirst({
          where: {
            id: editionOrganizerId,
            editionId: editionId,
            ...demande.preuve,
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
          const allHandoutItems = !articlesActifs
            ? []
            : aggregateHandoutItems([
                ...organizerAssociations.flatMap((association) => {
                  const handoutItem = organizerItemById.get(association.handoutItemId)
                  return handoutItem ? [{ handoutItem, quantity: association.quantity }] : []
                }),
                ...organizerMeals.flatMap((selection) => selection.meal.handoutItems),
              ])

          return createSuccessResponse({
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
          })
        } else {
          return createSuccessResponse({ found: false, raison: 'organizer' })
        }
      } else {
        // Recherche d'un billet.
        //
        // Ce bloc exigeait une configuration HelloAsso avant même de chercher, et rendait donc un
        // 404 — que le `catch` final transformait en 500 — pour toute édition qui n'en a pas.
        // Or un billet n'a besoin de rien d'autre que de son édition : 285 des billets en base
        // portent un code `onsite-…` produit par la saisie au guichet, sans aucun fournisseur
        // externe, et la réponse sait déjà rendre `provider: null` comme `provider: 'INFOMANIAK'`.
        // Une édition vendant uniquement sur place voyait donc son guichet tomber en panne.
        const orderItem = await prisma.ticketingOrderItem.findFirst({
          where: {
            qrCode: demande.qrCode,
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
          /*
           * Qui a validé chaque billet de la commande.
           *
           * Les trois autres branches rendaient déjà cette information ; celle-ci, qui porte
           * pourtant l'essentiel du flux, ne la rendait pas. À la porte, savoir QUI a scanné
           * est précisément ce qui tranche un désaccord.
           *
           * Une seule requête pour toute la commande, et non une par billet : un groupe de dix
           * personnes aurait sinon coûté dix allers-retours. Les trois autres branches font un
           * `findUnique` parce qu'elles n'ont qu'un seul sujet.
           */
          const idsValidateurs = [
            ...new Set(
              orderItem.order.items
                .map((item) => item.entryValidatedBy)
                .filter((id): id is number => typeof id === 'number')
            ),
          ]
          const validateurs = idsValidateurs.length
            ? await prisma.user.findMany({
                where: { id: { in: idsValidateurs } },
                select: { id: true, prenom: true, nom: true },
              })
            : []
          const validateurParId = new Map(validateurs.map((u) => [u.id, u]))

          const nomDuValidateur = (id: number | null) => {
            const u = id === null ? undefined : validateurParId.get(id)
            return u ? { firstName: u.prenom, lastName: u.nom } : null
          }

          return createSuccessResponse({
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
                    entryValidatedBy: nomDuValidateur(item.entryValidatedBy),
                    tier: item.tier
                      ? {
                          id: item.tier.id,
                          name: item.tier.name,
                        }
                      : null,
                    // La liste complète, tarif + options + champs personnalisés déjà
                    // agrégés : elle est portée par le billet et non par son tarif, puisque
                    // ses sources le débordent.
                    handoutItems: articlesActifs ? calculateHandoutItemsForTicket(item) : [],
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
          })
        } else {
          return createSuccessResponse({ found: false, raison: 'ticket' })
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
