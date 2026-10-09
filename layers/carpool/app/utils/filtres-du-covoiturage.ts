import { placesRestantes } from './places-restantes'

import type { OffreAPlaces } from './places-restantes'

import { contientLaSaisie } from '~~/shared/utils/recherche-texte'

/**
 * Affiner la liste des annonces de covoiturage, côté navigateur.
 *
 * ## Pourquoi un fichier, et pas trois `computed` dans le composant
 *
 * Deux raisons, dont une seule est de la commodité :
 *
 * 1. **la règle s'éprouve.** `USelect` est un composant à gabarit libre : le piloter dans jsdom
 *    revient à tester Reka UI, pas ce filtre. Ici, les trois critères se mesurent directement, y
 *    compris leurs croisements — c'est la seule façon de prouver que le sens du trajet et la ville
 *    s'ajoutent au lieu de se remplacer ;
 * 2. **le repos est une valeur, pas une liste de conditions.** `FILTRES_AU_REPOS` sert à la fois
 *    d'état initial, de cible du bouton « Réinitialiser » et de référence pour savoir si un filtre
 *    est posé. Un quatrième critère ajouté demain n'a donc rien à inscrire dans une liste
 *    parallèle — sans quoi le bouton resterait caché alors qu'il aurait quelque chose à faire.
 */
export interface FiltresDuCovoiturage {
  /**
   * `TOUTES` n'est PAS une valeur de l'énumération `CarpoolDirection`, et c'est volontaire : c'est
   * l'état au repos du champ. Le distinguer d'un sens réel évite la question « faut-il un `null` ? »
   * à chaque lecture, et un `null` se confondrait avec une donnée manquante.
   */
  direction: 'TOUTES' | 'TO_EVENT' | 'FROM_EVENT'
  ville: string
  /**
   * ⚠️ NE CONCERNE QUE LES OFFRES, délibérément : une demande ne transporte personne, elle n'a
   * aucune place à offrir. L'intitulé de la case le dit (« Offres avec… »), parce qu'un filtre qui
   * paraît ne rien faire est pire que son absence.
   */
  placesSeulement: boolean
}

/**
 * L'état au repos, gelé.
 *
 * `Object.freeze` plutôt qu'un simple objet : il est destiné à être copié (`{ ...FILTRES_AU_REPOS }`)
 * dans un `ref`, et une mutation par mégarde du modèle corromprait du même coup l'état initial, la
 * cible du bouton « Réinitialiser » et la comparaison ci-dessous — qui ne détecterait alors plus
 * jamais aucun filtre. Le gel fait échouer ce geste au lieu de le laisser passer.
 */
export const FILTRES_AU_REPOS: FiltresDuCovoiturage = Object.freeze({
  direction: 'TOUTES',
  ville: '',
  placesSeulement: false,
})

/** Un filtre est-il posé&nbsp;? Comparé au repos, jamais à une énumération de conditions. */
export function desFiltresSontPoses(filtres: FiltresDuCovoiturage): boolean {
  return (
    filtres.direction !== FILTRES_AU_REPOS.direction ||
    filtres.ville.trim() !== '' ||
    filtres.placesSeulement !== FILTRES_AU_REPOS.placesSeulement
  )
}

/** Annonce de covoiturage, offre ou demande, réduite à ce que le filtre regarde. */
export interface AnnonceFiltrable extends OffreAPlaces {
  direction?: string | null
  locationCity?: string | null
}

/**
 * Les deux critères communs aux offres et aux demandes.
 *
 * La ville passe par le comparateur PARTAGÉ du dépôt : « clermont » doit trouver
 * « Clermont-Ferrand », et « chalons » trouver « Châlons ». Les accents demandent un appui long sur
 * un clavier de téléphone — c'est le cas courant, pas l'exception —, et une recherche qui les exige
 * ne trouve rien. Une saisie vide laisse tout passer : c'est l'état au repos du champ, pas un
 * filtre.
 */
function correspondAuxCriteresCommuns(
  annonce: AnnonceFiltrable,
  filtres: FiltresDuCovoiturage
): boolean {
  if (filtres.direction !== 'TOUTES' && annonce.direction !== filtres.direction) return false
  return contientLaSaisie(filtres.ville, annonce.locationCity)
}

export function offresFiltrees<T extends AnnonceFiltrable>(
  offres: T[],
  filtres: FiltresDuCovoiturage
): T[] {
  return offres.filter(
    (offre) =>
      correspondAuxCriteresCommuns(offre, filtres) &&
      (!filtres.placesSeulement || placesRestantes(offre) > 0)
  )
}

export function demandesFiltrees<T extends AnnonceFiltrable>(
  demandes: T[],
  filtres: FiltresDuCovoiturage
): T[] {
  return demandes.filter((demande) => correspondAuxCriteresCommuns(demande, filtres))
}
