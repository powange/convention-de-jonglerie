import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionDataOrAccessControl } from '#server/utils/permissions/edition-permissions'
import {
  aggregateHandoutItems,
  calculateHandoutItemsForTicket,
  handoutItemsIncludes,
} from '#server/utils/ticketing/handout-items'
import { articlesARemettreActifs } from '#server/utils/ticketing/handout-items-actifs'
import { resoudreLesValidateurs } from '#server/utils/ticketing/nom-du-validateur'
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

    // L'interrupteur de l'édition coupe la remise elle-même, et pas seulement l'entrée de menu :
    // éteint, le guichet ne réclame plus rien à personne. Lu une fois pour les quatre populations.
    const articlesActifs = await articlesARemettreActifs(editionId)

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
              // L'écran fige le champ quand l'adresse est vérifiée : la laisser saisir
              // pour que le serveur la refuse ensuite est pire que ne pas la proposer.
              isEmailVerified: true,
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
                  isEmailVerified: true,
                },
              },
            },
          },
        },
        take: 20, // Limiter à 20 résultats
      })

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
              // L'écran fige le champ quand l'adresse est vérifiée : la laisser saisir
              // pour que le serveur la refuse ensuite est pire que ne pas la proposer.
              isEmailVerified: true,
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

      // Qui a validé, pour les QUATRE populations d'un coup.
      //
      // Quatre relevés distincts vivaient ici, et celui des billets manquait — comme il manquait
      // dans `verify.post.ts` (constat B2). Un seul appel les remplace : une requête au lieu de
      // quatre, et surtout un seul endroit qui puisse encore oublier une population.
      //
      // Placé ICI et non plus haut : les bénévoles sont la dernière des quatre listes à être
      // constituée. Les identifiants des billets viennent des lignes trouvées ET des autres
      // lignes de leur commande, puisque la modale affiche la commande entière.
      const nomDuValidateur = await resoudreLesValidateurs([
        ...orderItems.flatMap((item) => [item, ...item.order.items]).map((l) => l.entryValidatedBy),
        ...artists.map((a) => a.entryValidatedBy),
        ...organizers.map((o) => o.entryValidatedBy),
        ...volunteers.map((v) => v.entryValidatedBy),
      ])

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

      /*
       * DEUX requêtes pour toute la page, au lieu de deux ou trois PAR bénévole.
       *
       * Toutes les associations de l'édition tiennent dans une seule lecture — les globales
       * (`teamId` nul) comme celles des équipes —, et le rapprochement se fait ensuite en
       * mémoire. La règle de surcharge est inchangée : une équipe ne remplace le global que si
       * elle porte au moins un article, une équipe vide y retombe.
       *
       * L'inclusion de `team` a disparu au passage : elle n'était lue nulle part en aval.
       */
      const associationsBenevoles = volunteers.length
        ? await prisma.editionVolunteerHandoutItem.findMany({
            where: { editionId },
            include: { handoutItem: true },
          })
        : []

      const articlesGlobauxBenevoles = associationsBenevoles.filter((a) => a.teamId === null)
      const articlesParEquipe = new Map<string, typeof associationsBenevoles>()
      for (const association of associationsBenevoles) {
        if (association.teamId === null) continue
        const liste = articlesParEquipe.get(association.teamId) ?? []
        liste.push(association)
        articlesParEquipe.set(association.teamId, liste)
      }

      const selectionsRepasBenevoles = volunteers.length
        ? await prisma.volunteerMealSelection.findMany({
            where: {
              volunteerId: { in: volunteers.map((v) => v.id) },
              accepted: true,
              meal: { enabled: true },
            },
            include: {
              meal: { include: { handoutItems: { include: { handoutItem: true } } } },
            },
            // `date` seule ne départage pas deux repas du même jour : l'ordre affiché dépendait
            // alors du plan de requête. `mealType` le rend déterministe, et aligne cet écran sur
            // les cinq autres lectures de repas du dépôt.
            orderBy: [{ meal: { date: 'asc' } }, { meal: { mealType: 'asc' } }],
          })
        : []
      const repasParBenevole = new Map<number, typeof selectionsRepasBenevoles>()
      for (const selection of selectionsRepasBenevoles) {
        const liste = repasParBenevole.get(selection.volunteerId) ?? []
        liste.push(selection)
        repasParBenevole.set(selection.volunteerId, liste)
      }

      for (const volunteer of volunteers) {
        const teamIds = volunteer.teamAssignments.map((assignment) => assignment.team.id)

        // Les articles des équipes du bénévole ; à défaut, les articles globaux (surcharge).
        const teamSpecificItems = teamIds.flatMap((id) => articlesParEquipe.get(id) ?? [])
        const volunteerHandoutItems =
          teamSpecificItems.length > 0 ? teamSpecificItems : articlesGlobauxBenevoles

        // Collecter les articles (équipes) ; l'agrégation a lieu après les repas.
        const volunteerItemEntries: any[] = [...volunteerHandoutItems]

        const volunteerMeals = repasParBenevole.get(volunteer.id) ?? []

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
          (articlesActifs ? aggregateHandoutItems(volunteerItemEntries) : []).map((item) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
          }))
        )
      }

      // Récupérer les articles à remettre pour chaque organisateur.
      //
      // DEUX requêtes pour toute la page, au lieu de quatre PAR organisateur — dont celle des
      // articles globaux, rigoureusement identique à chaque tour et pourtant rejouée. Trente
      // organisateurs déclenchaient cent vingt requêtes, sur l'écran le plus sollicité de
      // l'événement.
      const handoutItemsByOrganizerId = new Map<
        number,
        Array<{ id: number; name: string; quantity: number }>
      >()

      if (organizers.length > 0 && articlesActifs) {
        const associations = await prisma.editionOrganizerHandoutItem.findMany({
          where: {
            editionId,
            // ⚠️ Pas de `in: [...ids, null]` : il produit `IN (…, NULL)`, et en SQL une
            // comparaison avec NULL n'est jamais vraie — les articles globaux disparaîtraient
            // sans la moindre erreur.
            OR: [{ organizerId: { in: organizers.map((o) => o.id) } }, { organizerId: null }],
          },
          select: {
            organizerId: true,
            quantity: true,
            // Une seule requête depuis que le modèle porte la relation. Il fallait auparavant
            // relire les articles à part, faute de pouvoir écrire cet `include` — la table était
            // la seule des neuf à n'avoir que la colonne `handoutItemId`.
            handoutItem: true,
          },
        })

        const enAssociation = (a: (typeof associations)[number]) => [
          { handoutItem: a.handoutItem, quantity: a.quantity },
        ]

        // `organizerId` nul vaut « tous les organisateurs » : ces associations valent pour
        // chacun, en plus de celles qui le nomment.
        const globales = associations.filter((a) => a.organizerId === null).flatMap(enAssociation)
        const parOrganisateur = new Map<number, ReturnType<typeof enAssociation>>()
        for (const association of associations) {
          if (association.organizerId === null) continue
          const liste = parOrganisateur.get(association.organizerId) ?? []
          liste.push(...enAssociation(association))
          parOrganisateur.set(association.organizerId, liste)
        }

        // Les articles attachés aux repas auxquels chacun est inscrit. Un ticket de cantine est
        // un article comme un autre : les bénévoles et les artistes le recevaient, pas les
        // organisateurs, alors qu'ils s'inscrivent aux mêmes repas.
        //
        // Une requête pour toute la page, et non une par personne : c'est le travers dont cette
        // boucle vient d'être débarrassée.
        const selectionsDeRepas = await prisma.organizerMealSelection.findMany({
          where: {
            editionOrganizerId: { in: organizers.map((o) => o.id) },
            accepted: true,
            meal: { enabled: true },
          },
          include: { meal: { include: { handoutItems: { include: { handoutItem: true } } } } },
          // Cette lecture n'avait aucun ordre : les repas d'un organisateur sortaient dans
          // celui que la base voulait bien rendre. Les quatre populations affichent désormais
          // les leurs dans le même ordre.
          orderBy: [{ meal: { date: 'asc' } }, { meal: { mealType: 'asc' } }],
        })
        const repasParOrganisateur = new Map<number, typeof selectionsDeRepas>()
        for (const selection of selectionsDeRepas) {
          const liste = repasParOrganisateur.get(selection.editionOrganizerId) ?? []
          liste.push(selection)
          repasParOrganisateur.set(selection.editionOrganizerId, liste)
        }

        for (const organizer of organizers) {
          // Même agrégation que pour les trois autres populations : un article donné à la fois
          // globalement et nommément n'est remis qu'une fois s'il n'est pas cumulable.
          const agreges = aggregateHandoutItems([
            ...globales,
            ...(parOrganisateur.get(organizer.id) ?? []),
            ...(repasParOrganisateur.get(organizer.id) ?? []).flatMap(
              (selection) => selection.meal.handoutItems
            ),
          ])
          handoutItemsByOrganizerId.set(
            organizer.id,
            agreges.map((item) => ({ id: item.id, name: item.name, quantity: item.quantity }))
          )
        }
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

      // Les repas de tous les artistes affichés, en UNE requête au lieu d'une par personne.
      const selectionsRepasArtistes = artists.length
        ? await prisma.artistMealSelection.findMany({
            where: {
              artistId: { in: artists.map((a) => a.id) },
              accepted: true,
              meal: { enabled: true },
            },
            include: {
              meal: { include: { handoutItems: { include: { handoutItem: true } } } },
            },
            orderBy: [{ meal: { date: 'asc' } }, { meal: { mealType: 'asc' } }],
          })
        : []
      const repasParArtiste = new Map<number, typeof selectionsRepasArtistes>()
      for (const selection of selectionsRepasArtistes) {
        const liste = repasParArtiste.get(selection.artistId) ?? []
        liste.push(selection)
        repasParArtiste.set(selection.artistId, liste)
      }

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

        const artistMeals = repasParArtiste.get(artist.id) ?? []

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
          (articlesActifs ? aggregateHandoutItems(artistItemEntries) : []).map((item) => ({
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
                  entryValidatedBy: nomDuValidateur(orderItem.entryValidatedBy),
                  tier: orderItem.tier
                    ? {
                        id: orderItem.tier.id,
                        name: orderItem.tier.name,
                      }
                    : null,
                  // La liste complète, tarif + options + champs personnalisés déjà agrégés :
                  // elle est portée par le billet et non par son tarif, puisque ses sources le
                  // débordent.
                  handoutItems: articlesActifs ? calculateHandoutItemsForTicket(orderItem) : [],
                  selectedOptions: orderItem.selectedOptions.map((so) => ({
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
              customFields: item.customFields as any,
              entryValidated: item.entryValidated,
              entryValidatedAt: item.entryValidatedAt,
              entryValidatedBy: nomDuValidateur(item.entryValidatedBy),
              // Les articles de l'option ne sont plus recopiés ici : ils sont déjà dans la
              // liste agrégée du billet. Les deux sérialisations divergeaient d'ailleurs —
              // l'une portait la quantité, l'autre non — et le client honorait ou perdait la
              // quantité selon celle qu'il lisait.
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
            },
          },
        })),
        volunteers: volunteers.map((application) => {
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
                  // Porté jusqu'à l'écran : c'est lui qui décide de figer le champ.
                  isEmailVerified: application.user.isEmailVerified,
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
                entryValidatedBy: nomDuValidateur(application.entryValidatedBy),
              },
            },
          }
        }),
        artists: artists.map((artist) => {
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
                  // Porté jusqu'à l'écran : c'est lui qui décide de figer le champ.
                  isEmailVerified: artist.user.isEmailVerified,
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
                entryValidatedBy: nomDuValidateur(artist.entryValidatedBy),
              },
            },
          }
        }),
        organizers: organizers.map((editionOrganizer) => {
          const handoutItems = handoutItemsByOrganizerId.get(editionOrganizer.id) || []
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
                  // Porté jusqu'à l'écran : c'est lui qui décide de figer le champ.
                  isEmailVerified: editionOrganizer.organizer.user.isEmailVerified,
                  phone: editionOrganizer.organizer.user.phone,
                },
                title: editionOrganizer.organizer.title,
                handoutItems,
                entryValidated: editionOrganizer.entryValidated,
                entryValidatedAt: editionOrganizer.entryValidatedAt,
                entryValidatedBy: nomDuValidateur(editionOrganizer.entryValidatedBy),
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
