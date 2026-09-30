import { NotificationService } from '#server/utils/notification-service'
import { MARGE_RETARD_MS } from '~~/shared/utils/bornes-retard-creneau'
// Depuis un layer, l'alias est `~~` : `~` ne résout pas vers la couche application.
import { formaterHeure } from '~~/shared/utils/fuseau-edition'

export default defineTask({
  meta: {
    name: 'volunteer-reminders',
    description: 'Send reminders to volunteers 30 minutes before their shifts',
  },
  async run({ payload: _payload }) {
    try {
      // Calculer la fenêtre de temps (dans 28-32 minutes pour éviter les doublons)
      const now = new Date()
      const reminderStart = new Date(now.getTime() + 28 * 60 * 1000) // Dans 28 minutes
      const reminderEnd = new Date(now.getTime() + 32 * 60 * 1000) // Dans 32 minutes

      /*
       * Les créneaux susceptibles d'entrer dans la fenêtre, et eux seuls.
       *
       * Cette tâche tourne CHAQUE MINUTE. Elle chargeait tous les créneaux de toutes les éditions
       * non terminées — avec leurs affectations et les comptes des personnes affectées — pour n'en
       * retenir ensuite qu'une poignée. La base porte donc l'intégralité du planning soixante fois
       * par heure, pour envoyer zéro ou deux rappels.
       *
       * ⚠️ La borne ne peut PAS être `startDateTime` entre 28 et 32 minutes : le retard décale ce
       * début, et un créneau retardé d'une heure doit être rappelé une heure plus tard. D'où la
       * marge de MARGE_RETARD_MS, DÉRIVÉE de la borne du retard — si elle était plus étroite, les
       * créneaux les plus décalés ne seraient jamais chargés et leurs bénévoles ne recevraient
       * aucun rappel, sans que rien n'apparaisse dans les journaux.
       *
       * Le filtre fin reste en mémoire : c'est lui qui applique le retard créneau par créneau.
       */
      const allSlots = await prisma.volunteerTimeSlot.findMany({
        where: {
          // Étape 0bis : endDate porté par Event (plus de traversée Edition)
          event: {
            endDate: { gte: now },
          },
          startDateTime: {
            gte: new Date(reminderStart.getTime() - MARGE_RETARD_MS),
            lte: new Date(reminderEnd.getTime() + MARGE_RETARD_MS),
          },
        },
        include: {
          assignments: {
            /*
             * ⚠️ SEULEMENT CELLES QUI N'ONT PAS ENCORE REÇU LEUR RAPPEL.
             *
             * Sans marque d'envoi, le rappel partait 4 À 5 FOIS : cette tâche tourne CHAQUE MINUTE
             * et retient les créneaux qui démarrent dans 28 à 32 minutes, si bien qu'un même
             * créneau tombe dans la fenêtre à quatre ou cinq passages consécutifs. Le bénévole
             * recevait donc quatre ou cinq notifications identiques, à une minute d'intervalle.
             *
             * Le filtre est posé ICI, dans la requête, et pas seulement en mémoire : c'est ce qui
             * évite de transporter à chaque minute des affectations qu'on ne notifiera pas — dans
             * le prolongement de l'allègement de cette requête, et non contre lui.
             */
            where: { reminderSentAt: null },
            include: {
              user: {
                select: { id: true, email: true, pseudo: true, nom: true, prenom: true },
              },
            },
          },
          team: { select: { name: true, color: true } },
          event: {
            // Le fuseau voyage avec le nom : l'heure annoncée doit être celle vécue SUR PLACE.
            select: { name: true, edition: { select: { timezone: true } } },
          },
        },
      })

      // Filtrer manuellement en tenant compte du delayMinutes
      const upcomingSlots = allSlots.filter((slot) => {
        const delay = slot.delayMinutes || 0
        const adjustedStart = new Date(slot.startDateTime.getTime() + delay * 60 * 1000)
        return adjustedStart >= reminderStart && adjustedStart <= reminderEnd
      })

      let totalNotificationsSent = 0

      // Traiter chaque créneau
      for (const slot of upcomingSlots) {
        if (slot.assignments.length > 0) {
          const editionName = slot.event.name || 'votre événement'
          const slotTitle = slot.title || 'Créneau bénévole'
          const teamName = slot.team?.name || 'Équipe non assignée'
          const delay = slot.delayMinutes || 0
          const adjustedStartDateTime = new Date(slot.startDateTime.getTime() + delay * 60 * 1000)

          /*
           * ⚠️ `Europe/Paris` ÉTAIT CODÉ EN DUR ICI, et c'est un défaut d'une autre nature que
           * celui du courriel de publication — lequel n'avait aucun fuseau et prenait donc celui
           * du serveur.
           *
           * Codé en dur, il donne la bonne heure aux conventions françaises et la mauvaise aux
           * autres : un rappel « votre créneau commence à 14:00 » arrive alors avec l'heure de
           * Paris pour quelqu'un qui est au Québec. Le message dit une heure, la montre en dit
           * une autre, et rien n'indique laquelle croire — sur un rappel envoyé trente minutes
           * avant, c'est le genre d'écart qui fait manquer un créneau.
           *
           * Les deux surfaces devaient être corrigées ENSEMBLE : n'en traiter qu'une ferait dire
           * deux heures différentes au même créneau selon qu'on lit le courriel de publication ou
           * le rappel.
           */
          const startTime = formaterHeure(
            adjustedStartDateTime,
            slot.event.edition?.timezone ?? null
          )

          for (const assignment of slot.assignments) {
            try {
              /*
               * ⚠️ LA MARQUE EST POSÉE AVANT L'ENVOI, et par un `updateMany` CONDITIONNEL.
               *
               * Le filtre de la requête ci-dessus suffirait si cette tâche ne tournait jamais deux
               * fois en même temps. Or elle part chaque minute et rien ne garantit qu'un passage
               * soit terminé quand le suivant commence — une base lente, un envoi qui traîne, et
               * deux exécutions lisent la même affectation encore vierge. Le `where` sur
               * `reminderSentAt: null` fait alors que L'UNE DES DEUX SEULEMENT écrit une ligne :
               * celle qui n'en écrit aucune n'envoie rien.
               *
               * Avant plutôt qu'après : un rappel envoyé sans marque repartirait à la minute
               * suivante, ce qui est le défaut qu'on corrige. Une marque posée sur un envoi qui
               * échoue ensuite coûte UN rappel manqué — moins cher que cinq rappels reçus, et la
               * notification suivante (le courriel de publication, l'écran) reste disponible.
               */
              const priseDeMarque = await prisma.volunteerAssignment.updateMany({
                where: { id: assignment.id, reminderSentAt: null },
                data: { reminderSentAt: new Date() },
              })
              if (priseDeMarque.count === 0) continue

              await NotificationService.create({
                userId: assignment.user.id,
                type: 'INFO',
                title: 'Rappel : Créneau bénévole dans 30 minutes',
                message: `Votre créneau "${slotTitle}" pour l'équipe "${teamName}" de "${editionName}" commence à ${startTime}. Merci de vous présenter à l'heure !`,
                category: 'volunteer',
                entityType: 'VolunteerTimeSlot',
                entityId: slot.id,
                actionUrl: `/profile/mes-candidatures-benevole`,
                actionText: 'Voir mes candidatures',
                notificationType: 'volunteer_reminder',
              })
              totalNotificationsSent++
            } catch (error) {
              console.error(
                `[CRON volunteer-reminders] Erreur notification ${assignment.user.pseudo}:`,
                error
              )
            }
          }
        }
      }

      console.log(
        `[CRON volunteer-reminders] ${upcomingSlots.length} créneaux, ${totalNotificationsSent} notifications`
      )

      return {
        success: true,
        slotsProcessed: upcomingSlots.length,
        notificationsSent: totalNotificationsSent,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      console.error('[CRON volunteer-reminders] Erreur:', error)
      throw error
    }
  },
})
