import { CronJob } from 'cron'

import { creerVerrouDeTaches } from '../../../../layers/core/server/socle/planificateur'
import { FUSEAU_DES_TACHES, TACHES_PLANIFIEES } from '../utils/taches-planifiees'

/**
 * Lance les tâches planifiées du layer bénévoles (catalogue : `server/utils/taches-planifiees.ts`),
 * chacune derrière le verrou de `layers/core/server/socle/planificateur.ts` (pas de recouvrement,
 * échec journalisé), à l'heure de Paris.
 *
 * En production seulement, ou avec `ENABLE_CRON=true` : en développement, la base est partagée
 * avec les essais, et des rappels y partiraient pour de faux créneaux.
 */
export default defineNitroPlugin(() => {
  if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_CRON !== 'true') {
    console.log('⏸️ Tâches planifiées désactivées (développement)')
    return
  }
  const { lancerSansRecouvrement } = creerVerrouDeTaches((nom) => runTask(nom))
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
