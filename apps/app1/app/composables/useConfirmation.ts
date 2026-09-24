/**
 * Une seule modale de confirmation par écran, quel que soit le nombre d'actions qui en demandent.
 *
 * Elle remplace `confirm()`, la boîte du navigateur, qui avait quatre défauts : elle bloque la
 * page, ne suit pas la langue choisie, ne montre jamais SUR QUOI porte l'action, et certains
 * navigateurs laissent l'utilisateur la désactiver définitivement — auquel cas la suppression
 * part sans être demandée.
 *
 * Le motif vient de `/admin/error-logs` : plutôt qu'un booléen d'ouverture par action, un seul
 * objet décrit la demande en cours. Un écran qui supprime un objet, annule une réservation et
 * retire un organisateur porte donc une modale, pas trois.
 *
 * ```ts
 * const confirmation = useConfirmation()
 *
 * function supprimer(objet: Objet) {
 *   confirmation.demanderConfirmation({
 *     description: t('gestion.stock.confirm_delete_item', { name: objet.nom }),
 *     libelleConfirmer: t('common.delete'),
 *     agir: () => executerSuppression(objet.id),
 *   })
 * }
 * ```
 * ```vue
 * <UiConfirmationDemandee :confirmation="confirmation" />
 * ```
 *
 * L'objet se passe entier au composant plutôt que déstructuré : sans cela, chaque écran recopiait
 * les treize lignes de gabarit qui câblent la modale — neuf copies pour la seule gestion d'une
 * édition, et la première divergence à venir.
 */
export interface DemandeDeConfirmation {
  /** Le titre de la modale. Celui de `ConfirmModal` — « Confirmation » — par défaut. */
  titre?: string
  /**
   * Ce qui va se passer, et sur quoi.
   *
   * C'est ici que se joue le gain sur `confirm()` : nommer l'objet, la question, le créneau. Une
   * description qui dit seulement « Êtes-vous sûr ? » ne vaut pas mieux que la boîte native.
   */
  description: string
  /** Le libellé du bouton qui engage. « Confirmer » par défaut. */
  libelleConfirmer?: string
  /** `error` pour ce qui détruit — le cas le plus fréquent, et donc le défaut des appelants. */
  couleurConfirmer?: 'primary' | 'warning' | 'error'
  /** L'action elle-même. Une promesse tient le bouton en chargement jusqu'à son terme. */
  agir: () => void | Promise<void>
}

export function useConfirmation() {
  const demande = ref<DemandeDeConfirmation | null>(null)
  const enCours = ref(false)

  /*
   * L'ouverture se déduit de la demande plutôt que de vivre à côté : deux états pour une seule
   * chose finissent toujours par diverger — une modale ouverte sans demande n'a rien à afficher.
   *
   * La fermeture est refusée pendant l'action : cliquer à côté d'une suppression déjà partie
   * laisserait croire qu'on l'a annulée.
   */
  const ouverte = computed({
    get: () => demande.value !== null,
    set: (valeur: boolean) => {
      if (!valeur && !enCours.value) demande.value = null
    },
  })

  function demanderConfirmation(nouvelle: DemandeDeConfirmation) {
    demande.value = nouvelle
  }

  /**
   * Exécute l'action demandée, puis referme.
   *
   * Un rejet de `agir` remonte à l'appelant — la modale se referme quand même, comme le faisait
   * `confirm()`, dont l'échec survenait aussi après la fermeture. À l'appelant de dire l'erreur ;
   * c'est ce que fait `useApiAction`, qui ne lève pas.
   */
  async function confirmer() {
    const enAttente = demande.value
    if (!enAttente || enCours.value) return
    enCours.value = true
    try {
      await enAttente.agir()
    } finally {
      enCours.value = false
      demande.value = null
    }
  }

  function annuler() {
    if (!enCours.value) demande.value = null
  }

  return { demande, ouverte, enCours, demanderConfirmation, confirmer, annuler }
}

/** Ce que `useConfirmation` rend, et que `UiConfirmationDemandee` reçoit entier. */
export type Confirmation = ReturnType<typeof useConfirmation>
