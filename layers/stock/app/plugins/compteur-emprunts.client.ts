import { compterEmpruntsEnRetard } from '../utils/tableau-emprunts'

/** Un emprunt réduit à ce dont le comptage a besoin. */
interface EmpruntCompte {
  isExternalLoan?: boolean | null
  pickedUpAt?: string | null
  returnedAt?: string | null
  returnDueAt?: string | null
}

/**
 * `$fetch`, ramené à une signature simple.
 *
 * Sur cette route, laisser le compilateur résoudre les surcharges de `$fetch` le fait plonger
 * — « type instantiation is excessively deep » —, quelle que soit la forme donnée au générique.
 * La page qui appelle la même route depuis un composant n'a pas ce problème : c'est le contexte
 * de typage des plugins qui diffère. Le contrat est énoncé ici plutôt que déduit, et il est le
 * même qu'ailleurs.
 */
const recupererEmprunts = $fetch as unknown as (
  url: string
) => Promise<{ data: { loans: EmpruntCompte[] } }>

/**
 * Déclare au menu comment compter les emprunts en retard.
 *
 * C'est ici que le module se fait connaître de la navigation, et non l'inverse : le menu demande
 * un compte sans savoir ce qu'est un emprunt, et ce fichier sait compter sans savoir qu'il existe
 * un menu. Ajouter demain un compteur ailleurs ne demandera pas de rouvrir le menu.
 *
 * Côté client seulement : une pastille ne sert à personne dans le rendu serveur, et l'appel
 * retarderait la première page pour une information qui peut arriver après.
 */
export default defineNuxtPlugin(() => {
  enregistrerFournisseurCompteur({
    cle: 'stock-emprunts',
    charger: async (contexte) => {
      const editionId = contexte.editionId
      if (typeof editionId !== 'number') return null

      const reponse = await recupererEmprunts(`/api/editions/${editionId}/stock-loans`)
      // Le retard seul : ce qui est simplement à récupérer allumerait la pastille en permanence,
      // dès le premier emprunt convenu, et elle cesserait de vouloir dire quelque chose.
      return compterEmpruntsEnRetard(reponse.data.loans || [])
    },
  })
})
