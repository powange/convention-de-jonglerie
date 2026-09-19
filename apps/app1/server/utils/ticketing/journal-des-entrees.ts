/**
 * Journal des mouvements d'entrée : qui est passé la porte, quand, et qui l'a annulé.
 *
 * Les quatre tables du contrôle d'accès ne portent que l'ÉTAT courant — `entryValidated`, la date
 * et l'auteur. Une dévalidation les remettait à `null`, et il ne restait alors plus rien : ni que
 * la personne était entrée, ni à quelle heure, ni qui avait annulé. C'est exactement ce qu'on a
 * besoin de relire à l'entrée d'une convention, quand quelqu'un affirme être passé à 14 h ou que
 * deux agents se contredisent.
 *
 * Écrire ici est **délibérément silencieux** : un journal qui fait échouer la validation coûterait
 * plus cher qu'il ne rapporte. Une file d'attente à l'entrée ne doit pas s'arrêter parce qu'une
 * ligne de traçabilité n'a pas pu être insérée. Le défaut est donc journalisé côté serveur, et le
 * geste métier aboutit quand même.
 */

import type { EntryMovement, EntryParticipantKind } from '#server/types/prisma'

/** Le genre de participant, tel que les points d'API le nomment dans leur corps de requête. */
export type TypeDeParticipant = 'ticket' | 'volunteer' | 'artist' | 'organizer'

const GENRES: Record<TypeDeParticipant, EntryParticipantKind> = {
  ticket: 'TICKET',
  volunteer: 'VOLUNTEER',
  artist: 'ARTIST',
  organizer: 'ORGANIZER',
}

/**
 * Enregistre un mouvement pour un ou plusieurs participants du même genre.
 *
 * La liste est vide dans un cas courant et légitime : `updateMany` n'a rien changé parce que tout
 * était déjà validé. On n'écrit alors rien — un journal ne consigne pas les gestes sans effet.
 */
export async function journaliserMouvementDEntree(options: {
  editionId: number
  type: TypeDeParticipant
  participantIds: number[]
  mouvement: EntryMovement
  actorId: number
}): Promise<void> {
  if (options.participantIds.length === 0) return

  try {
    await prisma.entryValidationLog.createMany({
      data: options.participantIds.map((participantId) => ({
        editionId: options.editionId,
        participantKind: GENRES[options.type],
        participantId,
        movement: options.mouvement,
        actorId: options.actorId,
      })),
    })
  } catch (erreur) {
    console.error('[journal des entrées] écriture impossible', erreur)
  }
}
