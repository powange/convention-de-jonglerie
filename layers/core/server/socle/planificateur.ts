/**
 * Verrou d'un planificateur de tâches : une tâche ne se recouvre jamais avec son passage
 * précédent, et son échec est journalisé sans être propagé. Flowvent s'en sert
 * (`apps/app2/server/plugins/planificateur.ts`) ; app1 a la même logique écrite dans son propre
 * plugin (`apps/app1/server/plugins/scheduler.ts`), dont le test lit la source — d'où deux copies
 * plutôt qu'un déplacement.
 *
 * - **Pas de recouvrement** : une tâche lancée chaque minute (rappels de créneau) ne doit pas
 *   tourner deux fois en même temps, sinon le même rappel part deux fois. Verrou en mémoire, donc
 *   par processus : suffisant pour un conteneur applicatif unique par environnement.
 * - **Échec journalisé, jamais propagé** : une tâche qui lève n'arrête pas les autres.
 *
 * Aucun import de paquet ici (pas même `cron`) : le module se charge tel quel dans les tests
 * unitaires, qui résolvent les paquets des layers depuis la racine du dépôt.
 */
export function creerVerrouDeTaches(lancer: (nom: string) => Promise<unknown>) {
  const enCours = new Set<string>()

  async function lancerSansRecouvrement(nom: string) {
    if (enCours.has(nom)) {
      console.warn(`⏭️ ${nom} : exécution précédente encore en cours, ce passage est ignoré`)
      return
    }
    enCours.add(nom)
    try {
      await lancer(nom)
    } catch (error) {
      console.error(`Erreur lors de l'exécution de ${nom}:`, error)
    } finally {
      enCours.delete(nom)
    }
  }

  return { enCours, lancerSansRecouvrement }
}
