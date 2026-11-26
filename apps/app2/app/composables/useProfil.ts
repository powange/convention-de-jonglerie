/**
 * Données de l'espace « Mon profil » (GET /api/profile), partagées entre ses pages par une clé
 * commune : naviguer de l'une à l'autre ne refait pas la requête, et `refresh` les met toutes à
 * jour après une modification.
 */
import type { WatchSource } from 'vue'

export interface Profil {
  id: number
  email: string
  pseudo: string
  prenom: string | null
  nom: string | null
  profilePicture: string | null
  createdAt: string
  hasPassword: boolean
  googleLinked: boolean
  facebookLinked: boolean
  eventsCount: number
  subscription: {
    plan: string
    formule: string
    modules: unknown
    status: string
    currentPeriodEnd: string
  } | null
}

/**
 * `immediate` : l'en-tête, présent sur toutes les pages, ne doit pas interroger l'API pour un
 * visiteur anonyme (401). Il passe la session, et `watch` relance la requête à la connexion.
 */
export function useProfil(options: { immediate?: boolean; watch?: WatchSource[] } = {}) {
  return useFetch('/api/profile', {
    key: 'profil',
    transform: (reponse: { data: Profil }) => reponse.data,
    immediate: options.immediate ?? true,
    watch: options.watch,
  })
}
