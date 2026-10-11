import { NotificationHelpers } from '#server/utils/notification-service'
import { nomAffichableDEdition } from '~~/shared/utils/nom-edition'

/**
 * Les rappels « votre édition commence bientôt » — constat B4 de l'administration.
 *
 * ## ⚠️⚠️ LE DÉFAUT : UNE TÂCHE QUI ANNONÇAIT DES ENVOIS SANS RIEN ENVOYER
 *
 * `convention-favorites-reminders` tournait chaque jour à 10 h. Le corps de sa boucle était un
 * `// TODO: Intégrer avec le système de notifications` qui incrémentait un compteur **sans créer
 * aucune notification**. Le journal serveur écrivait « N notifications », le catalogue de
 * `/admin/crons` promettait « Notifie les utilisateurs des conventions favorites qui commencent
 * dans 3 jours », et un administrateur qui lançait la tâche à la main lisait un succès et un
 * compteur non nul.
 *
 * Rien ne partait. Depuis toujours.
 *
 * ## La logique existait, du mauvais côté
 *
 * Le point d'API d'administration, lui, faisait le travail — favoris, bénévoles acceptés,
 * déduplication sur 24 h — mais il n'était **jamais planifié** : il fallait qu'un administrateur
 * clique. La règle vit donc ici, et les deux l'appellent. Deux populations pour un même rappel
 * auraient été le défaut suivant.
 *
 * ## 📍 CE QUE CELA CHANGE POUR LA TÂCHE, et il faut le dire
 *
 * Elle ne regardait qu'une fenêtre de 2,5 à 3,5 jours et ne visait que les **favoris**. Elle
 * couvre désormais **J-3 et J-7**, et prévient aussi les **bénévoles acceptés** — c'est ce que le
 * point d'API faisait déjà. La description du catalogue est corrigée en conséquence : elle
 * annonçait trois jours et les seuls favoris.
 *
 * ## ⚠️ LA DÉDUPLICATION EST CE QUI REND UN CRON QUOTIDIEN SÛR
 *
 * Elle porte sur `titleKey` — `Notification` n'a pas de colonne `title`, le titre est une CLÉ de
 * traduction — et sur les 24 dernières heures. Sans elle, une tâche qui tourne chaque jour sur une
 * fenêtre de deux paliers enverrait un rappel par jour, et le moindre rejeu manuel doublerait tout.
 */

/** Les deux seuls paliers qui déclenchent un rappel. Une édition à J-5 attendra J-3. */
export const PALIERS_DE_RAPPEL = [3, 7] as const

export interface ResultatDesRappels {
  /** Les éditions examinées, c'est-à-dire chargées — pas seulement celles qui ont notifié. */
  editionsProcessed: number
  notificationsSent: number
}

/**
 * Envoie les rappels dus, et rend ce qui a été fait.
 *
 * @param maintenant - l'instant de référence, paramètre pour que les tests ne dépendent pas de
 *   l'horloge : un rappel calé sur des paliers ne s'éprouve pas autrement.
 */
export async function envoyerLesRappelsDEdition(
  maintenant: Date = new Date()
): Promise<ResultatDesRappels> {
  const plafond = new Date(maintenant.getTime() + 7 * 24 * 60 * 60 * 1000)

  const editions = await prisma.edition.findMany({
    where: {
      startDate: { gte: maintenant, lte: plafond },
    },
    include: {
      convention: { select: { name: true } },
      // Les personnes qui ont mis l'édition en favori.
      favoritedBy: { select: { id: true } },
      // Les bénévoles ACCEPTÉS : la relation est portée par `Event`, non par `Edition`.
      event: {
        select: {
          volunteerApplications: {
            where: { status: 'ACCEPTED' },
            select: { user: { select: { id: true } } },
          },
        },
      },
    },
  })

  let notificationsSent = 0

  for (const edition of editions) {
    const joursRestants = Math.ceil(
      (edition.startDate.getTime() - maintenant.getTime()) / (1000 * 60 * 60 * 24)
    )
    if (!(PALIERS_DE_RAPPEL as readonly number[]).includes(joursRestants)) continue

    /*
     * Un ENSEMBLE, et pas deux boucles : la même personne peut avoir mis l'édition en favori ET
     * être bénévole acceptée. Deux notifications identiques à la même seconde dévalueraient les
     * suivantes.
     */
    const aPrevenir = new Set<number>(edition.favoritedBy.map((u) => u.id))
    for (const candidature of edition.event?.volunteerApplications ?? []) {
      aPrevenir.add(candidature.user.id)
    }

    const libelle = nomAffichableDEdition(edition)

    for (const userId of aPrevenir) {
      try {
        const dejaEnvoye = await prisma.notification.findFirst({
          where: {
            userId,
            category: 'edition',
            entityType: 'Edition',
            entityId: edition.id.toString(),
            // Cf. l'en-tête : le titre est une CLÉ, `Notification` n'a pas de colonne `title`.
            titleKey: 'notifications.edition.reminder.title',
            createdAt: { gte: new Date(maintenant.getTime() - 24 * 60 * 60 * 1000) },
          },
        })
        if (dejaEnvoye) continue

        await NotificationHelpers.eventReminder(userId, libelle, edition.id, joursRestants)
        notificationsSent++
      } catch (error) {
        /*
         * Un échec par personne n'interrompt pas les autres : un rappel perdu est moins grave que
         * la moitié d'une édition non prévenue. C'est le choix déjà fait par le point d'API.
         */
        console.error(`[rappels-editions] rappel non envoyé à l'utilisateur ${userId}`, error)
      }
    }
  }

  return { editionsProcessed: editions.length, notificationsSent }
}
