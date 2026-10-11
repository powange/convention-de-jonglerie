import { envoyerLesRappelsDEdition } from '../utils/rappels-editions'

/**
 * Tâche planifiée : les rappels « votre édition commence bientôt ».
 *
 * ## ⚠️⚠️ CETTE TÂCHE N'ENVOYAIT RIEN — constat B4
 *
 * Le corps de sa boucle était un `// TODO: Intégrer avec le système de notifications` qui
 * incrémentait un compteur **sans créer aucune notification**. Elle tournait chaque jour à 10 h, le
 * journal écrivait « N notifications », le catalogue de `/admin/crons` promettait qu'elle notifiait
 * les favoris, et un administrateur qui la lançait à la main lisait un succès et un compteur non
 * nul. Rien ne partait, depuis toujours.
 *
 * La règle vit désormais dans `utils/rappels-editions.ts`, et le point d'API d'administration —
 * qui, lui, faisait le travail mais n'était jamais planifié — l'appelle aussi.
 *
 * ## 📍 LES COMPTEURS SONT RENDUS À PLAT
 *
 * Ils étaient enveloppés dans `{ result: {...} }`, là où toutes les autres tâches les rendent au
 * premier niveau. `getExecutionStats`, dans `/admin/crons`, parcourt les clés NUMÉRIQUES du
 * premier niveau : il ne trouvait donc aucun nombre à afficher, et l'écran restait muet sur une
 * tâche qui prétendait avoir travaillé.
 */
export default defineTask({
  meta: {
    name: 'convention-favorites-reminders',
    description: 'Notify favorited editions and accepted volunteers 3 and 7 days before the start',
  },
  async run({ payload: _payload }) {
    try {
      const resultat = await envoyerLesRappelsDEdition()

      console.log(
        `[CRON convention-favorites-reminders] ${resultat.editionsProcessed} édition(s) examinée(s), ` +
          `${resultat.notificationsSent} notification(s) envoyée(s)`
      )

      return { success: true, ...resultat, timestamp: new Date().toISOString() }
    } catch (error) {
      console.error('[CRON convention-favorites-reminders] Erreur:', error)
      throw error
    }
  },
})
