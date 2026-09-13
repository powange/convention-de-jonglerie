import {
  compterListesDeCoursesEnCours,
  type ReponseDesListes,
} from '../utils/compteur-listes-de-courses'

/**
 * `$fetch`, ramené à une signature simple.
 *
 * Même raison que pour le compteur d'emprunts du même layer : laisser le compilateur résoudre les
 * surcharges de `$fetch` dans un plugin le fait plonger — « type instantiation is excessively
 * deep ». Le contrat est énoncé plutôt que déduit.
 */
const recuperer = $fetch as unknown as <T>(url: string) => Promise<T>

/**
 * Déclare au menu comment compter les listes de courses qu'il reste à finir.
 *
 * Pas d'endpoint dédié au compte : la liste des listes rend déjà leurs articles, et en créer un
 * second ajouterait une deuxième description de la même chose, à tenir à jour en parallèle. Le
 * coût est le même pour l'utilisateur, qui ouvrira cette page de toute façon.
 *
 * Côté client seulement : une pastille ne sert à personne dans le rendu serveur, et l'appel
 * retarderait la première page pour une information qui peut arriver après.
 */
export default defineNuxtPlugin(() => {
  enregistrerFournisseurCompteur({
    cle: 'stock-courses',
    charger: async (contexte) => {
      const editionId = contexte.editionId
      if (typeof editionId !== 'number') return null

      const reponse = await recuperer<ReponseDesListes>(
        `/api/editions/${editionId}/stock-shopping-lists`
      )
      return compterListesDeCoursesEnCours(reponse)
    },
  })
})
