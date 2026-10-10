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
 * ligne de traçabilité n'a pas pu être insérée. Le geste métier aboutit donc quand même.
 *
 * ## ⚠️ MAIS UN ÉCHEC SILENCIEUX DOIT RESTER TROUVABLE
 *
 * Le constat A3 de l'audit relevait la bonne réserve : cette trace est au **mieux-effort**, elle ne
 * remplace pas la colonne pour qui a besoin d'une garantie. Le choix de ne pas bloquer est assumé
 * et ne change pas — mais son prix était payé **deux fois** : l'échec ne partait qu'en
 * `console.error`, c'est-à-dire dans les journaux du conteneur, que personne ne relit.
 *
 * Or c'est précisément ici que l'invisibilité coûte le plus cher : après une dévalidation, les
 * colonnes d'état sont remises à `null` et **le journal est la seule trace qui reste**. S'il n'a pas
 * pu s'écrire, il faut le savoir avant qu'on ne vienne demander à quelle heure quelqu'un est passé.
 *
 * L'échec est donc aussi consigné dans `ApiErrorLog`, que l'écran d'administration montre et qu'une
 * surveillance interroge. Lui non plus ne lève jamais : signaler un échec ne doit pas en créer un.
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
    await signalerEchec(erreur, options)
  }
}

/**
 * Rend visible un échec d'écriture du journal, sans jamais lever.
 *
 * ⚠️ `ApiErrorLog` est normalement alimenté depuis un point d'API, avec la requête sous la main.
 * Ici il n'y en a pas : les champs de contexte sont donc renseignés par ce que cet util SAIT —
 * l'édition, le genre de participant, le mouvement, les identifiants concernés. Un `method` et une
 * `url` synthétiques valent mieux qu'un enregistrement refusé par le schéma, qui sont obligatoires.
 *
 * `statusCode: 500` plutôt que 0 : l'écran d'administration et la surveillance filtrent sur les
 * 5xx, et un échec de traçabilité EST une défaillance serveur. Le mettre hors de ce filtre
 * reviendrait à le cacher une seconde fois.
 */
async function signalerEchec(
  erreur: unknown,
  options: {
    editionId: number
    type: TypeDeParticipant
    participantIds: number[]
    mouvement: EntryMovement
  }
): Promise<void> {
  try {
    await prisma.apiErrorLog.create({
      data: {
        message: `Journal des entrées : écriture impossible (${options.mouvement}, ${options.type}, ${options.participantIds.length} participant(s))`,
        statusCode: 500,
        errorType: 'EntryLogWriteError',
        stack: erreur instanceof Error ? erreur.stack : String(erreur),
        method: 'INTERNAL',
        url: 'server/utils/ticketing/journal-des-entrees.ts',
        path: 'server/utils/ticketing/journal-des-entrees.ts',
        prismaDetails: {
          editionId: options.editionId,
          participantKind: GENRES[options.type],
          movement: options.mouvement,
          participantIds: options.participantIds,
        },
      },
    })
  } catch (erreurDeSignalement) {
    // Dernier recours : si même le journal d'erreurs est inaccessible, la base entière l'est.
    console.error('[journal des entrées] signalement impossible', erreurDeSignalement)
  }
}
