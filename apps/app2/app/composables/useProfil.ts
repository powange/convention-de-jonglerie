/**
 * Données de l'espace « Mon profil » (GET /api/profile), partagées entre ses pages par une clé
 * commune : naviguer de l'une à l'autre ne refait pas la requête, et `refresh` les met toutes à
 * jour après une modification.
 */
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
  subscription: { plan: string; status: string; currentPeriodEnd: string } | null
}

export function useProfil() {
  return useFetch('/api/profile', {
    key: 'profil',
    transform: (reponse: { data: Profil }) => reponse.data,
  })
}
