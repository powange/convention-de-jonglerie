/**
 * Qui a de quoi consommer les créneaux du planning sur la page publique de bénévolat.
 *
 * La page instanciait `useVolunteerTimeSlots` sans condition. Ce composable s'auto-appelle au
 * montage, et aucun `v-if` ne peut l'en empêcher : le `setup` s'exécute pour tout visiteur. Un
 * visiteur connecté n'ayant jamais candidaté déclenchait donc un appel aux créneaux, auquel l'API
 * répond 403 — invisible à l'écran, le rejet étant absorbé pour ne pas figer l'hydratation, mais
 * consigné dans les logs de production.
 *
 * La condition vit ici plutôt qu'en ligne dans la page pour être vérifiable : monter cette page
 * demanderait une demi-douzaine d'endpoints, alors que la règle, elle, se lit en table de vérité.
 */

export interface EtatDuVisiteur {
  authentifie: boolean
  /** Planning publié, ou relu en avance par un responsable d'équipe. */
  planningVisible: boolean
  statutCandidature: string | null | undefined
  responsableDEquipe: boolean
  /** Nombre d'équipes où la personne figure en tant qu'organisateur. */
  equipesOrganisateur: number
}

/**
 * Vrai si l'une des deux surfaces qui affichent ces créneaux peut apparaître.
 *
 * C'est l'union de leurs conditions — la carte de planning et « mes créneaux » —, et rien de plus :
 * hors de ces cas, la donnée n'irait nulle part. Un gestionnaire qui n'est ni bénévole accepté ni
 * responsable n'en fait pas partie, et c'est voulu : la page publique ne lui montre aucune des
 * deux.
 *
 * `volunteersMode` ne figure pas ici, alors qu'il conditionne aussi ces surfaces. Il est déclaré
 * très bas dans la page et ce prédicat est évalué pendant le `setup` : s'y référer y lèverait une
 * `ReferenceError`. Son absence ne coûte qu'une requête inutile mais AUTORISÉE — un bénévole
 * accepté d'une édition en mode externe —, jamais le 403 que l'on corrige.
 */
export function aDroitAuPlanning(etat: EtatDuVisiteur): boolean {
  if (!etat.authentifie) return false
  if (!etat.planningVisible) return false

  return (
    etat.statutCandidature === 'ACCEPTED' || etat.responsableDEquipe || etat.equipesOrganisateur > 0
  )
}
