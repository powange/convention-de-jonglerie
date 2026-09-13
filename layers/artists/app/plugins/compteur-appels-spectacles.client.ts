import {
  compterCandidaturesDeSpectaclesEnAttente,
  type ReponseDesAppels,
} from '../utils/compteur-appels-spectacles'

/**
 * `$fetch`, ramené à une signature simple.
 *
 * Laisser le compilateur résoudre les surcharges de `$fetch` dans un plugin le fait plonger —
 * « type instantiation is excessively deep ». Le contexte de typage d'un plugin diffère de celui
 * d'un composant, où la même route ne pose pas ce problème. Le contrat est donc énoncé plutôt que
 * déduit, comme pour les compteurs bénévoles et les emprunts de matériel.
 */
const recuperer = $fetch as unknown as <T>(url: string) => Promise<T>

/**
 * Déclare au menu comment compter les candidatures de spectacles qui attendent une décision.
 *
 * Un seul appel réseau pour toute l'édition : `/shows-call` rend déjà chaque appel avec ses
 * statistiques, dont le nombre de candidatures en attente. Créer un endpoint dédié au compte aurait
 * ajouté une seconde description de la même chose, à tenir à jour en parallèle.
 *
 * Côté client seulement : une pastille ne sert à personne dans le rendu serveur, et l'appel
 * retarderait la première page pour une information qui peut arriver après.
 */
export default defineNuxtPlugin(() => {
  enregistrerFournisseurCompteur({
    cle: 'appels-spectacles',
    charger: async (contexte) => {
      const editionId = contexte.editionId
      if (typeof editionId !== 'number') return null

      const reponse = await recuperer<ReponseDesAppels>(`/api/editions/${editionId}/shows-call`)
      return compterCandidaturesDeSpectaclesEnAttente(reponse)
    },
  })
})
