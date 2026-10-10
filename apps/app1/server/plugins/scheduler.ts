import { CronJob } from 'cron'

import { FUSEAU_DES_TACHES, TACHES_PLANIFIEES } from '#server/utils/scheduled-tasks'

/**
 * Les tâches en cours d'exécution.
 *
 * ## ⚠️ POURQUOI UN VERROU (constat A6)
 *
 * `volunteer-reminders` tourne **chaque minute** et envoie des notifications — SMTP, FCM, autant
 * d'attentes réseau. Rien ne vérifiait que l'exécution précédente était terminée : un envoi lent
 * se recouvrait avec le suivant, et le même rappel pouvait partir deux fois.
 *
 * Le verrou vit en mémoire, donc par processus. C'est suffisant ici : les crons ne tournent que
 * dans le conteneur applicatif, en un seul exemplaire. Le jour où il y en aurait deux, il faudrait
 * un verrou en base — et ce commentaire est là pour qu'on sache que ce n'est pas le cas.
 */
const enCours = new Set<string>()

/**
 * Lance une tâche, sauf si la précédente n'est pas finie.
 *
 * ⚠️ L'échec est JOURNALISÉ et non propagé : une tâche qui lève ne doit pas arrêter le
 * planificateur, sinon un défaut passager dans l'une d'elles éteindrait les huit autres.
 */
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

/**
 * Planifie une tâche du catalogue.
 *
 * ⚠️ NEUF BLOCS IDENTIQUES À UN NOM PRÈS, voilà ce que ce fichier contenait — chacun avec son
 * `try/catch` recopié, et aucun avec `timeZone`. Une règle écrite neuf fois est une règle qu'on
 * corrige huit fois : il suffisait d'en oublier un pour que la correction soit partielle, et rien
 * ne l'aurait signalé.
 *
 * L'expression cron vient du CATALOGUE et n'est plus écrite ici : c'est elle que l'écran
 * d'administration affiche, et les deux listes avaient déjà divergé une fois.
 */
function planifier(nom: string) {
  const tache = TACHES_PLANIFIEES.find((t) => t.name === nom)
  if (!tache) {
    console.error(`⚠️ ${nom} absente du catalogue des tâches planifiées : elle ne sera pas lancée`)
    return
  }

  CronJob.from({
    cronTime: tache.cronExpression,
    timeZone: FUSEAU_DES_TACHES,
    onTick: () => lancerSansRecouvrement(nom),
    start: true,
  })
}

export default defineNitroPlugin(async (_nitroApp) => {
  // Ne lancer les crons qu'en production ou si explicitement demandé
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_CRON === 'true') {
    console.log(`🕒 Initialisation du système de cron (fuseau : ${FUSEAU_DES_TACHES})...`)

    for (const tache of TACHES_PLANIFIEES) planifier(tache.name)

    console.log(`✅ ${TACHES_PLANIFIEES.length} tâches planifiées`)
  } else {
    console.log('⏸️ Système de cron désactivé (développement)')
  }
})

/** Exporté pour les tests : le verrou n'est observable que par là. */
export const _pourLesTests = { enCours, lancerSansRecouvrement }
