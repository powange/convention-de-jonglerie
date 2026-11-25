import { CronJob } from 'cron'

import { FUSEAU_DES_TACHES, TACHES_PLANIFIEES } from '../utils/taches-planifiees'

/**
 * Lance les tâches planifiées du layer bénévoles (catalogue : `server/utils/taches-planifiees.ts`).
 * Même mécanique que le planificateur d'app1 (`apps/app1/server/plugins/scheduler.ts`), dont les
 * raisons sont détaillées là-bas :
 *
 * - **un verrou par tâche** : `volunteer-reminders` tourne chaque minute ; un passage lent ne doit
 *   pas se recouvrir avec le suivant, sinon le même rappel part deux fois. Le verrou vit en
 *   mémoire : Flowvent tourne en un seul conteneur par environnement ;
 * - **un échec journalisé, jamais propagé** : une tâche qui lève n'arrête pas les autres ;
 * - **en production seulement**, ou avec `ENABLE_CRON=true` : en développement, la base est
 *   partagée avec les essais, et des rappels y partiraient pour de faux créneaux.
 */
const enCours = new Set<string>()

async function lancerSansRecouvrement(nom: string) {
  if (enCours.has(nom)) {
    console.warn(`⏭️ ${nom} : exécution précédente encore en cours, ce passage est ignoré`)
    return
  }
  enCours.add(nom)
  try {
    await runTask(nom)
  } catch (error) {
    console.error(`Erreur lors de l'exécution de ${nom}:`, error)
  } finally {
    enCours.delete(nom)
  }
}

export default defineNitroPlugin(() => {
  if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_CRON !== 'true') {
    console.log('⏸️ Tâches planifiées désactivées (développement)')
    return
  }
  for (const tache of TACHES_PLANIFIEES) {
    CronJob.from({
      cronTime: tache.cronExpression,
      timeZone: FUSEAU_DES_TACHES,
      onTick: () => lancerSansRecouvrement(tache.name),
      start: true,
    })
  }
  console.log(`🕒 ${TACHES_PLANIFIEES.length} tâches planifiées (fuseau : ${FUSEAU_DES_TACHES})`)
})

/** Exporté pour les tests : le verrou n'est observable que par là. */
export const _pourLesTests = { enCours, lancerSansRecouvrement }
