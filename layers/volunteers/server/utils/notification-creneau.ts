import type { EtatDuCreneau } from './changement-de-creneau'

import { useVolunteerPorts } from '#server/volunteers/ports/registry'
import { formaterDateHeure } from '~~/shared/utils/fuseau-edition'

/**
 * Prévenir les personnes affectées quand leur créneau bouge — constat B4.
 *
 * ## Le défaut
 *
 * Toute la conception de « planning publié » repose sur l'idée qu'après publication le bénévole
 * NOTE ses horaires : il peut même les exporter en ICS. Pourtant déplacer un créneau, changer son
 * équipe ou son retard, le supprimer avec ses affectations, ou retirer quelqu'un de son créneau
 * ne produisait **aucune** notification — les quatre points d'API concernés ne portaient pas une
 * seule occurrence de « notif ». Le bénévole se présentait à l'ancien horaire.
 *
 * ⚠️ Et un simple **glisser-déposer** sur la frise passe par le même PUT : il n'y a pas de geste
 * conscient qui distingue « je réorganise » de « je déplace quelqu'un ».
 *
 * ## Ce qui est notifié, et ce qui ne l'est pas
 *
 * Seulement **si le planning est publié** : avant publication, le planning est un brouillon que
 * personne ne regarde, et notifier chaque essai noierait les vraies annonces. C'est la même
 * logique que les échanges, fermés tant que le planning n'est pas publié.
 *
 * Et seulement sur un **changement notable** — voir `changementNotable`. Le titre, la description
 * ou le nombre de places ne déplacent personne.
 */

/*
 * 📍 `changementNotable` et `EtatDuCreneau` vivent dans `changement-de-creneau.ts`, PUR.
 *
 * Ce n'est pas un découpage de confort : le projet de tests `unit` tourne hors Nuxt, où les
 * alias `#server` ne se résolvent pas. Une règle mêlée au port de notification n'y serait donc
 * pas éprouvable — c'est exactement pourquoi le module sépare déjà `publication-plannings.ts`
 * de `planning-publie.ts`.
 */

/**
 * Les comptes à prévenir pour un créneau : bénévoles affectés ET organisateurs affectés.
 *
 * ⚠️ Les deux, et c'est le point à ne pas rater : un organisateur posé sur un créneau n'est pas
 * un spectateur, il tient le poste. `OrganizerSlotAssignment` passe par `EditionOrganizer`, dont
 * le compte est `organizerId` — et non `userId`, qui n'existe pas sur ce modèle.
 *
 * Dédoublonné : une même personne peut être bénévole ET organisatrice de la même édition, et
 * recevrait sinon deux fois le même message.
 */
export async function comptesAffectesAuCreneau(slotId: string): Promise<number[]> {
  const [benevoles, organisateurs] = await Promise.all([
    prisma.volunteerAssignment.findMany({
      where: { timeSlotId: slotId },
      select: { userId: true },
    }),
    prisma.organizerSlotAssignment.findMany({
      where: { timeSlotId: slotId },
      select: { editionOrganizer: { select: { organizerId: true } } },
    }),
  ])

  return [
    ...new Set([
      ...benevoles.map((a) => a.userId),
      ...organisateurs.map((a) => a.editionOrganizer.organizerId),
    ]),
  ]
}

/** Le fuseau de l'édition, pour que l'heure annoncée soit celle qu'on vivra sur place. */
async function fuseauDeLEdition(editionId: number): Promise<string | null> {
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    select: { timezone: true },
  })
  return edition?.timezone ?? null
}

interface ArgsChangement {
  editionId: number
  destinataires: number[]
  avant: EtatDuCreneau
  apres: EtatDuCreneau
}

/**
 * « Votre créneau a changé », avec l'ANCIEN et le NOUVEL horaire.
 *
 * Les deux, délibérément : sans l'ancien, la personne ne sait pas lequel de ses créneaux a bougé
 * — elle en tient souvent plusieurs — et doit rouvrir le planning pour le deviner.
 */
export async function notifierCreneauDeplace({
  editionId,
  destinataires,
  avant,
  apres,
}: ArgsChangement): Promise<void> {
  if (destinataires.length === 0) return

  const fuseau = await fuseauDeLEdition(editionId)
  const lignes = [
    `Avant : ${formaterDateHeure(avant.startDateTime, fuseau)} → ${formaterDateHeure(avant.endDateTime, fuseau)}`,
    `Maintenant : ${formaterDateHeure(apres.startDateTime, fuseau)} → ${formaterDateHeure(apres.endDateTime, fuseau)}`,
  ]
  if ((avant.delayMinutes ?? null) !== (apres.delayMinutes ?? null)) {
    lignes.push(
      apres.delayMinutes
        ? `Retard annoncé : ${apres.delayMinutes} min`
        : 'Le retard annoncé a été retiré.'
    )
  }
  if (avant.teamId !== apres.teamId) {
    lignes.push("L'équipe de ce créneau a changé.")
  }

  await envoyer(destinataires, {
    editionId,
    titre: 'Un de vos créneaux a été déplacé',
    message: lignes.join('\n'),
    notificationType: 'volunteer_slot_changed',
  })
}

/** « Votre créneau a été supprimé » — envoyé AVANT que la suppression n'efface les affectations. */
export async function notifierCreneauSupprime({
  editionId,
  destinataires,
  creneau,
}: {
  editionId: number
  destinataires: number[]
  creneau: EtatDuCreneau
}): Promise<void> {
  if (destinataires.length === 0) return

  const fuseau = await fuseauDeLEdition(editionId)
  await envoyer(destinataires, {
    editionId,
    titre: 'Un de vos créneaux a été supprimé',
    message:
      `Le créneau du ${formaterDateHeure(creneau.startDateTime, fuseau)} ` +
      `→ ${formaterDateHeure(creneau.endDateTime, fuseau)} n'existe plus. ` +
      `Vous n'avez plus à vous y présenter.`,
    notificationType: 'volunteer_slot_removed',
  })
}

/** « Vous avez été retiré d'un créneau » — une seule personne, celle qu'on retire. */
export async function notifierRetraitDuCreneau({
  editionId,
  userId,
  creneau,
}: {
  editionId: number
  userId: number
  creneau: EtatDuCreneau
}): Promise<void> {
  const fuseau = await fuseauDeLEdition(editionId)
  await envoyer([userId], {
    editionId,
    titre: 'Vous avez été retiré d’un créneau',
    message:
      `Vous n'êtes plus affecté au créneau du ${formaterDateHeure(creneau.startDateTime, fuseau)} ` +
      `→ ${formaterDateHeure(creneau.endDateTime, fuseau)}.`,
    notificationType: 'volunteer_slot_unassigned',
  })
}

/**
 * L'envoi lui-même.
 *
 * 📍 PAS de `safeNotify` ici, et ce n'est pas un oubli : le port le dit dans son propre type —
 * « Notification in-app (englobe déjà le "safe" : ne lève pas) ». L'envelopper une seconde fois
 * n'ajouterait rien. Ce qui PEUT lever, ce sont les LECTURES qui précèdent (destinataires,
 * fuseau) : elles sont donc protégées chez l'appelant, après l'écriture. Protéger la boucle sans
 * protéger la lecture est un défaut déjà payé sur la messagerie — un 500 sur une opération
 * pourtant enregistrée.
 */
async function envoyer(
  destinataires: number[],
  {
    editionId,
    titre,
    message,
    notificationType,
  }: { editionId: number; titre: string; message: string; notificationType: string }
): Promise<void> {
  const { notifications } = useVolunteerPorts()
  await Promise.all(
    destinataires.map((userId) =>
      notifications.notify({
        userId,
        type: 'WARNING',
        titleText: titre,
        messageText: message,
        category: 'volunteer',
        entityType: 'Edition',
        entityId: String(editionId),
        actionUrl: `/editions/${editionId}/volunteers`,
        actionText: 'Voir mon planning',
        notificationType,
      })
    )
  )
}
