import { nettoyerEnvoisTemporaires, racineTemporaire } from '../utils/nettoyage-temp-uploads'

/**
 * Tâche planifiée : purge des envois temporaires abandonnés.
 *
 * Les formulaires déposent leurs images dans `temp/` avant enregistrement, et le fichier n'est
 * déplacé qu'à la validation. Une saisie abandonnée laissait donc son image là, définitivement —
 * aucune tâche ne nettoyait ce dossier.
 *
 * Une heure de grâce : en deçà, le fichier appartient sans doute à un formulaire encore ouvert,
 * et le supprimer ferait disparaître la photo sous les doigts de la personne qui saisit.
 */
export default defineTask({
  meta: {
    name: 'cleanup-temp-uploads',
    description: 'Delete abandoned uploads left in the temp folder',
  },
  async run() {
    try {
      const racine = racineTemporaire()
      const resultat = await nettoyerEnvoisTemporaires(racine)

      console.log(
        `[CRON cleanup-temp-uploads] ${resultat.fichiersSupprimes} fichier(s) et ` +
          `${resultat.dossiersSupprimes} dossier(s) supprimés, ` +
          `${Math.round(resultat.octetsLiberes / 1024)} Ko libérés`
      )

      return { success: true, ...resultat, timestamp: new Date().toISOString() }
    } catch (error) {
      console.error('[CRON cleanup-temp-uploads] Erreur:', error)
      throw error
    }
  },
})
