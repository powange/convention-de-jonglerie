import { compterTachesEnRetard, type ReponseDesTachesEnRetard } from '../utils/compteur-taches'

/**
 * `$fetch`, ramené à une signature simple.
 *
 * Même raison que pour les compteurs du module stock : laisser le compilateur résoudre les
 * surcharges de `$fetch` dans un plugin le fait plonger — « type instantiation is excessively
 * deep ». Le contrat est énoncé plutôt que déduit.
 */
const recuperer = $fetch as unknown as <T>(url: string) => Promise<T>

/**
 * Déclare au menu comment compter les tâches en retard.
 *
 * Quatre modules avaient déjà leur pastille — les appels à spectacles, les emprunts, les listes de
 * courses, les bénévoles — et les tâches n'en avaient aucune. C'est pourtant le module où un
 * chiffre vaut le plus d'être vu sans ouvrir la page : une échéance dépassée ne se rappelle pas
 * autrement.
 *
 * Côté client seulement : une pastille ne sert à personne dans le rendu serveur, et l'appel
 * retarderait la première page pour une information qui peut arriver après.
 */
export default defineNuxtPlugin(() => {
  enregistrerFournisseurCompteur({
    cle: 'taches-en-retard',
    charger: async (contexte) => {
      const editionId = contexte.editionId
      if (typeof editionId !== 'number') return null

      const reponse = await recuperer<ReponseDesTachesEnRetard>(
        `/api/editions/${editionId}/tasks/overdue-count`
      )
      return compterTachesEnRetard(reponse)
    },
  })
})
