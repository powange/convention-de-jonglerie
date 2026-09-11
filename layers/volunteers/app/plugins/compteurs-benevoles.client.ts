import {
  compterCandidaturesEnAttente,
  compterEchangesATrancher,
  type DemandeDEchange,
  type ReponsePaginee,
} from '../utils/compteurs-benevoles'

/**
 * `$fetch`, ramené à une signature simple.
 *
 * Sur ces routes, laisser le compilateur résoudre les surcharges de `$fetch` le fait plonger —
 * « type instantiation is excessively deep » —, quelle que soit la forme donnée au générique. Le
 * contexte de typage des plugins diffère de celui d'un composant, où la même route ne pose pas ce
 * problème. Le contrat est énoncé plutôt que déduit, comme pour les emprunts de matériel.
 */
const recuperer = $fetch as unknown as <T>(url: string) => Promise<T>

/**
 * Déclare au menu comment compter ce qui attend une décision côté bénévolat.
 *
 * Deux compteurs distincts plutôt qu'un seul, parce qu'ils pendent à deux entrées différentes du
 * menu : les candidatures et les échanges. Le parent en fait la somme tout seul — c'est le rôle du
 * cumul, et il évite d'inventer ici un troisième compteur qui aurait fallu tenir à jour.
 *
 * Côté client seulement : une pastille ne sert à personne dans le rendu serveur, et l'appel
 * retarderait la première page pour une information qui peut arriver après.
 */
export default defineNuxtPlugin(() => {
  enregistrerFournisseurCompteur({
    cle: 'benevoles-candidatures',
    charger: async (contexte) => {
      const editionId = contexte.editionId
      if (typeof editionId !== 'number') return null

      // `pageSize=1` : seul le total compte. Rapatrier les candidatures pour les compter serait
      // absurde pour une pastille, et coûteux sur une grosse édition.
      const reponse = await recuperer<ReponsePaginee>(
        `/api/editions/${editionId}/volunteers/applications?status=PENDING&pageSize=1`
      )
      return compterCandidaturesEnAttente(reponse)
    },
  })

  enregistrerFournisseurCompteur({
    cle: 'benevoles-echanges',
    charger: async (contexte) => {
      const editionId = contexte.editionId
      if (typeof editionId !== 'number') return null

      const reponse = await recuperer<{ data?: { requests?: DemandeDEchange[] } }>(
        `/api/editions/${editionId}/volunteers/swaps/pending`
      )
      return compterEchangesATrancher(reponse?.data?.requests)
    },
  })
})
