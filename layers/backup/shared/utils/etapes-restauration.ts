/**
 * Les étapes d'une restauration de sauvegarde, et celles qui comptent comme « en cours ».
 *
 * ⚠️ POURQUOI CE FICHIER EXISTE. Cette liste était écrite DEUX FOIS — dans
 * `server/utils/backup-restore-job.ts` et dans `app/composables/useBackupRestoreProgress.ts` —
 * avec chacune son `ETAPES_EN_COURS`. Ajouter une étape d'un seul côté suffisait à casser le suivi
 * EN SILENCE, et de deux façons distinctes :
 *
 * • côté SERVEUR, une étape absente de la liste fait que `estEnCours` la déclare terminée : un
 *   redémarrage pendant cette étape laisse sur le disque un état jamais requalifié en
 *   `INTERROMPUE`, et l'écran annonce une restauration réussie qui ne l'est pas ;
 * • côté CLIENT, la même absence fait cesser le sondage au milieu de la restauration et afficher
 *   l'encart final à la place de la carte d'avancement.
 *
 * Aucun des deux ne lève, aucun des deux ne se voit en relisant le diff de l'autre. C'est le motif
 * que ce dépôt a déjà payé sur « qui gère les bénévoles ? » et « cette candidature est-elle
 * modifiable ? » : une règle recopiée finit par diverger, et la divergence est muette.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Les étapes traversées par une restauration, dans l'ordre. */
export type EtapeRestauration =
  | 'PREPARATION'
  | 'BASE_DE_DONNEES'
  | 'MIGRATIONS'
  | 'FICHIERS'
  | 'TERMINEE'
  | 'ECHOUEE'
  | 'INTERROMPUE'

/**
 * Celles pendant lesquelles la restauration travaille encore.
 *
 * 📍 `MIGRATIONS` en fait partie : c'est une étape longue — elle rejoue les migrations Prisma — et
 * l'omettre produirait les deux défauts décrits en tête de fichier.
 */
export const ETAPES_DE_RESTAURATION_EN_COURS = [
  'PREPARATION',
  'BASE_DE_DONNEES',
  'MIGRATIONS',
  'FICHIERS',
] as const satisfies readonly EtapeRestauration[]

/** Cette restauration travaille-t-elle encore ? */
export function restaurationEnCoursDapres(etape: unknown): boolean {
  return (ETAPES_DE_RESTAURATION_EN_COURS as readonly unknown[]).includes(etape)
}
