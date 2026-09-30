import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { apresLaReponse, enTranches } from '#server/utils/apres-la-reponse'
import { requireAuth } from '#server/utils/auth-utils'
import { generateVolunteerScheduleEmailHtml, getSiteUrl } from '#server/utils/emailService'
import { NotificationService } from '#server/utils/notification-service'
import { userBasicSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'
import { estHorsAssignationAutomatique } from '~~/shared/utils/benevoles-volants'
// Depuis un layer, l'alias est `~~` : `~` ne résout pas vers la couche application.
import { formaterHeure, formaterJournee, heureDans } from '~~/shared/utils/fuseau-edition'

/** Envois simultanés par tranche : le nombre de requêtes en vol reste borné. */
const TAILLE_DE_TRANCHE = 10

/**
 * Le corps de la requête. Vide est légitime — c'est le cas courant.
 *
 * `inclureSansCreneau` écrit AUSSI aux bénévoles à qui aucun créneau n'est attribué, avec le
 * message de repli. Par défaut on ne le fait plus : leur annoncer « vos créneaux sont
 * disponibles » alors qu'ils n'en ont aucun est une notification qui ne dit rien, et un courriel
 * de plus dans une boîte qui en reçoit déjà beaucoup pendant la préparation.
 */
const corpsSchema = z
  .object({ inclureSansCreneau: z.boolean().optional() })
  .nullish()
  .transform((corps) => ({ inclureSansCreneau: corps?.inclureSansCreneau === true }))

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await useVolunteerPorts().organizers.canManage(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        statusText: 'Droits insuffisants pour gérer les bénévoles',
      })
    }

    // Notifier les plannings, c'est les publier.
    //
    // Ce sont le même geste métier : envoyer à chaque bénévole le détail de ses créneaux tout en
    // laissant la page les masquer produirait exactement la situation que le réglage cherche à
    // éviter — des horaires connus par courriel, introuvables à l'écran, et impossible de savoir
    // lesquels font foi.
    //
    // `upsert` plutôt qu'`update` : une édition peut n'avoir jamais enregistré de configuration
    // bénévole, auquel cas la ligne n'existe pas encore.
    await prisma.eventVolunteerSettings.upsert({
      where: { eventId: editionId },
      update: { planningPublished: true },
      create: { eventId: editionId, planningPublished: true },
    })

    // Nom d'affichage générique porté par l'Event (étape 0bis)
    const eventRecord = await prisma.event.findUnique({
      where: { id: editionId },
      // Le fuseau de l'édition voyage avec le nom : toutes les heures de ce courriel sont des
      // heures VÉCUES SUR PLACE, et sans lui elles seraient celles du serveur.
      select: { name: true, edition: { select: { timezone: true } } },
    })

    if (!eventRecord) {
      throw createError({
        status: 404,
        statusText: 'Événement non trouvé',
      })
    }
    const eventName = eventRecord.name || 'votre événement'

    /*
     * ⚠️ TOUTES LES HEURES DE CE MESSAGE SONT CELLES DE L'ÉDITION, et c'est ce qui manquait.
     *
     * `toLocaleTimeString('fr-FR')` sans `timeZone` rend l'heure du SERVEUR — donc UTC en
     * conteneur. Un créneau de 8 h du matin partait annoncé à 6 h, à tout le monde, y compris aux
     * bénévoles qui vivent à côté du chapiteau. Le décalage ne se voyait pas en développement, où
     * la machine est à Paris comme la convention.
     *
     * Le `timeOfDay` était pire encore : déduit d'un `getHours()` sur le même fuseau, il faisait
     * basculer un créneau de 8 h du matin dans « matin » ou « nuit » selon la saison — un même
     * créneau rangé sous deux intitulés différents d'un mois à l'autre.
     *
     * `null` quand l'édition n'a pas de fuseau : les utilitaires retombent alors sur le
     * comportement d'avant, ce qui ne dégrade rien et évite d'inventer un fuseau par défaut.
     */
    const fuseau = eventRecord.edition?.timezone ?? null

    const { inclureSansCreneau } = corpsSchema.parse(await readBody(event).catch(() => null))

    // Les équipes viennent avec la candidature : ce sont elles qui portent « volante » et
    // « autonome », et c'est ce qui décide plus bas de qui reçoit le message de repli.
    const acceptedVolunteers = await prisma.editionVolunteerApplication.findMany({
      where: {
        eventId: editionId,
        status: 'ACCEPTED',
      },
      include: {
        user: {
          select: {
            ...userBasicSelect,
            email: true,
            prenom: true,
            preferredLanguage: true,
          },
        },
        teamAssignments: {
          select: { team: { select: { isFloatingTeam: true, isAutonomousTeam: true } } },
        },
      },
    })

    if (acceptedVolunteers.length === 0) {
      return createSuccessResponse({ count: 0 }, 'Aucun bénévole accepté trouvé')
    }

    /*
     * UNE seule requête d'affectations pour toute l'édition, groupée en mémoire.
     *
     * Il y en avait une PAR bénévole. Sur une édition de deux cents bénévoles, cela faisait deux
     * cents allers-retours pour une donnée qu'une requête ramène — et ces requêtes partaient à la
     * file, chacune attendant la précédente, avant même le premier envoi.
     */
    const toutesLesAffectations = await prisma.volunteerAssignment.findMany({
      where: { timeSlot: { eventId: editionId } },
      include: { timeSlot: { include: { team: true } } },
      orderBy: { timeSlot: { startDateTime: 'asc' } },
    })

    const affectationsParUtilisateur = new Map<number, typeof toutesLesAffectations>()
    for (const affectation of toutesLesAffectations) {
      const liste = affectationsParUtilisateur.get(affectation.userId)
      if (liste) liste.push(affectation)
      else affectationsParUtilisateur.set(affectation.userId, [affectation])
    }

    /*
     * À qui l'on écrit.
     *
     * Ceux qui ont au moins un créneau, toujours. Ceux qui n'en ont aucun seulement si on l'a
     * demandé — et parmi eux, JAMAIS les volants ni ceux réservés à une équipe autonome : pour
     * eux, l'absence de créneau n'est pas un retard de planification mais leur situation. Leur
     * écrire « vos créneaux seront bientôt disponibles » serait faux, et le message de repli dit
     * exactement cela.
     *
     * `estHorsAssignationAutomatique` porte déjà cette règle : le volant parce qu'il n'a pas
     * d'heures à faire, le réservé parce que ses heures ne se décident pas ici.
     */
    const destinataires = acceptedVolunteers.filter((volunteer) => {
      const creneaux = affectationsParUtilisateur.get(volunteer.user.id) ?? []
      if (creneaux.length > 0) return true
      if (!inclureSansCreneau) return false
      return !estHorsAssignationAutomatique(volunteer.teamAssignments.map((t) => t.team))
    })

    const siteUrl = getSiteUrl()

    /**
     * Prévient UN bénévole : notification dans l'application, puis courriel.
     *
     * Les créneaux sont lus dans la Map constituée plus haut, non redemandés à la base.
     */
    const prevenir = async (volunteer: (typeof destinataires)[number]) => {
      try {
        const assignments = affectationsParUtilisateur.get(volunteer.user.id) ?? []

        // Formater les créneaux pour l'affichage
        const scheduleText = assignments
          .map((assignment) => {
            // Calculer les dates ajustées avec le retard
            const delay = assignment.timeSlot.delayMinutes || 0
            const adjustedStart = new Date(
              assignment.timeSlot.startDateTime.getTime() + delay * 60 * 1000
            )
            const adjustedEnd = new Date(
              assignment.timeSlot.endDateTime.getTime() + delay * 60 * 1000
            )

            const date = formaterJournee(adjustedStart, fuseau, 'fr', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })
            const timeRange = `${formaterHeure(adjustedStart, fuseau)} - ${formaterHeure(adjustedEnd, fuseau)}`
            const teamName = assignment.timeSlot.team?.name || 'Équipe non définie'
            return `📅 ${date} (${timeRange}) - ${teamName}`
          })
          .join('\n')

        // Créer la notification
        const notificationTitle = 'Vos créneaux de bénévolat sont disponibles'
        const notificationMessage =
          assignments.length > 0
            ? `Vos créneaux de bénévolat pour ${eventName} sont maintenant disponibles :\n\n${scheduleText}\n\nConsultez tous vos créneaux sur la page "Mes candidatures".`
            : `Vos créneaux de bénévolat pour ${eventName} seront bientôt disponibles. Consultez la page "Mes candidatures" pour plus d'informations.`

        await NotificationService.create({
          userId: volunteer.user.id,
          type: 'INFO',
          title: notificationTitle,
          message: notificationMessage,
          actionUrl: '/profile/mes-candidatures-benevole',
          actionText: 'Voir mes créneaux',
          entityType: 'Edition',
          entityId: editionId.toString(),
          notificationType: 'volunteer_schedule',
        })

        // Envoyer l'email
        const prenom = volunteer.user.prenom || volunteer.user.pseudo || 'Bénévole'

        // Préparer les créneaux pour l'email avec le format attendu
        const emailTimeSlots = assignments.map((assignment) => {
          // Calculer les dates ajustées avec le retard
          const delay = assignment.timeSlot.delayMinutes || 0
          const startDate = new Date(
            assignment.timeSlot.startDateTime.getTime() + delay * 60 * 1000
          )
          const endDate = new Date(assignment.timeSlot.endDateTime.getTime() + delay * 60 * 1000)

          /*
           * Le moment de la journée, sur l'heure VÉCUE SUR PLACE.
           *
           * `heureDans` rend `null` pour une date illisible — jamais le cas ici, ces dates venant
           * de la base. Si cela arrivait tout de même, `formaterHeure` rendrait déjà une heure
           * VIDE juste en dessous : l'intitulé de section serait alors le moindre des problèmes,
           * et « matin » est retenu comme premier choix de la liste, non comme une supposition sur
           * la donnée.
           */
          const heure = heureDans(startDate, fuseau)
          let timeOfDay: 'MORNING' | 'AFTERNOON' | 'EVENING'
          if (heure === null || heure < 12) {
            timeOfDay = 'MORNING'
          } else if (heure < 18) {
            timeOfDay = 'AFTERNOON'
          } else {
            timeOfDay = 'EVENING'
          }

          return {
            date: startDate,
            timeOfDay,
            teamName: assignment.timeSlot.team?.name || 'Équipe non définie',
            startTime: formaterHeure(startDate, fuseau),
            endTime: formaterHeure(endDate, fuseau),
          }
        })

        const emailHtml = await generateVolunteerScheduleEmailHtml(
          prenom,
          eventName,
          eventName,
          emailTimeSlots,
          `${siteUrl}/profile/mes-candidatures-benevole`
        )

        const emailSent = await useVolunteerPorts().email.send({
          to: volunteer.user.email,
          subject: `🤹 Vos créneaux de bénévolat - ${eventName}`,
          html: emailHtml,
          text: `Bonjour ${prenom},\n\n${notificationMessage}\n\nLien : ${siteUrl}/profile/mes-candidatures-benevole`,
        })

        if (!emailSent) {
          console.warn(`Échec de l'envoi d'email pour ${volunteer.user.email}`)
        }
      } catch (error) {
        console.error(`Erreur lors de l'envoi pour le bénévole ${volunteer.user.id}:`, error)
      }
    }

    /*
     * La réponse part MAINTENANT, la diffusion suit.
     *
     * Deux cents bénévoles, deux envois chacun, en série : le bouton tournait une minute et
     * l'organisateur rechargeait la page en croyant à une panne — ce qui relançait tout.
     *
     * ⚠️ CONSÉQUENCE SUR LE CONTRAT : `count` est désormais le nombre de DESTINATAIRES et non
     * celui des envois réussis, et le champ `errors` disparaît — la réponse ne peut plus rendre
     * compte de ce qui n'a pas encore eu lieu. Les échecs individuels restent journalisés. Le seul
     * client (`gestion/volunteers/notifications.vue`) affiche un message fixe et ne lisait ni l'un
     * ni l'autre, mais le sens du champ change : c'est à savoir avant de s'y fier.
     *
     * L'`upsert` de `planningPublished` est resté AVANT tout cela, et c'est essentiel : la
     * publication doit être enregistrée même si la diffusion échoue, sans quoi l'écran masquerait
     * des créneaux dont les bénévoles ont déjà reçu le détail.
     */
    apresLaReponse(
      event,
      async () => {
        for (const tranche of enTranches(destinataires, TAILLE_DE_TRANCHE)) {
          /*
           * Ce qui protège la diffusion d'un envoi raté, mesuré plutôt que supposé.
           *
           * À l'intérieur d'une tranche, `map` démarre tous les envois d'emblée : un échec ne peut
           * donc pas empêcher ses voisins d'être tentés. Ce qui est en jeu, c'est la tranche
           * SUIVANTE — avec `all` qui rejette, la boucle s'arrête et le reste ne part jamais. Sur
           * deux cents bénévoles, un seul courriel refusé priverait les suivants du leur, et la
           * réponse, déjà partie, ne pourrait rien en dire.
           *
           * ⚠️ `allSettled` et le `try/catch` de `prevenir` sont ALTERNATIFS, pas cumulatifs :
           * chacun seul suffit, et il faut retirer les DEUX pour que la seconde tranche disparaisse
           * (vérifié dans cet ordre, avec douze destinataires). Les deux sont gardés — le
           * `try/catch` pour journaliser l'échec par personne, `allSettled` pour que la boucle
           * survive si quelque chose cessait un jour d'être rattrapé à l'intérieur.
           */
          await Promise.allSettled(tranche.map(prevenir))
        }
      },
      'NotifyVolunteerSchedules'
    )

    return createSuccessResponse(
      {
        count: destinataires.length,
        total: acceptedVolunteers.length,
      },
      `Notifications en cours d'envoi à ${destinataires.length} bénévole(s)`
    )
  },
  { operationName: 'NotifyVolunteerSchedules' }
)
