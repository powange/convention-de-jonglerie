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
  /** Bénévolat géré ici : en mode externe, aucune de ces deux surfaces n'est rendue. */
  modeInterne: boolean
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
 * L'appelant doit lire ce prédicat **après** avoir déclaré tout ce qu'il lui passe : il est évalué
 * pendant le `setup`, là où le template ne l'est qu'après. Un `computed` déclaré plus bas y serait
 * en zone morte temporelle et lèverait une `ReferenceError`.
 */
export function aDroitAuPlanning(etat: EtatDuVisiteur): boolean {
  if (!etat.authentifie) return false
  if (!etat.modeInterne) return false
  if (!etat.planningVisible) return false

  return (
    etat.statutCandidature === 'ACCEPTED' || etat.responsableDEquipe || etat.equipesOrganisateur > 0
  )
}
