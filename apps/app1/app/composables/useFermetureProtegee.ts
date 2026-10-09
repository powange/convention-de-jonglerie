/**
 * Fermer une modale sans perdre une saisie non enregistrée.
 *
 * ## ⚠️ LE DÉFAUT QUE CE COMPOSABLE REFERME : LA GARDE NE COUVRAIT QU'UNE SORTIE SUR TROIS
 *
 * Les trois modales de repas gardaient leur saisie ainsi :
 *
 * ```ts
 * const isOpen = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) })
 *
 * const closeModal = () => {
 *   if (hasUnsavedChanges.value && !confirm(t('…confirm_close_unsaved'))) return
 *   isOpen.value = false
 * }
 * ```
 *
 * `closeModal` n'est appelé que par le bouton « Annuler ». Or `<UModal v-model:open="isOpen">` est
 * **contrôlée** : la touche **Échap** et le **clic à côté** écrivent directement dans le modèle,
 * donc dans le `set` — **sans passer par `closeModal`**. Les deux façons les plus naturelles de
 * fermer une modale contournaient la garde, et la saisie était perdue sans un mot.
 *
 * Une garde qui ne couvre qu'une sortie sur trois n'est pas une garde : elle donne la tranquillité
 * sans la protection.
 *
 * ## La correction : intercepter dans le `set`, et non à côté
 *
 * Le modèle rendu ici refuse lui-même de passer à `false` tant que la confirmation n'est pas
 * obtenue. Les trois sorties empruntent donc le même chemin, par construction — il n'y a plus de
 * « côté » à oublier.
 *
 * ## Et pourquoi la fermeture descend dans `agir`
 *
 * `confirm()` rendait un booléen **synchrone** : on pouvait écrire `if (!confirm(…)) return`. Une
 * modale ne répond pas tout de suite. La fermeture devient donc l'ACTION de la confirmation, et le
 * cas « on renonce » n'a rien à faire — renoncer, c'est laisser la modale ouverte.
 *
 * ## Emploi
 *
 * ```ts
 * const { confirmation, ouvert, demanderFermeture } = useFermetureProtegee({
 *   ouvert: () => props.modelValue,
 *   modifie: () => hasUnsavedMealChanges.value,
 *   description: () => t('artists.meals.confirm_close_unsaved'),
 *   appliquer: (valeur) => emit('update:modelValue', valeur),
 * })
 * ```
 * ```vue
 * <UModal v-model:open="ouvert" :title="title">
 *   <UButton @click="demanderFermeture">…</UButton>
 * </UModal>
 * <UiConfirmationDemandee :confirmation="confirmation" />
 * ```
 */
export interface FermetureProtegee {
  /** L'état d'ouverture, tel que le composant le connaît (le plus souvent `props.modelValue`). */
  ouvert: () => boolean
  /** Y a-t-il une saisie à perdre&nbsp;? Faux ⇒ la fermeture est immédiate, sans question. */
  modifie: () => boolean
  /** Ce qui va être perdu, nommé. Une fonction, pour que la langue courante soit relue à l'ouverture. */
  description: () => string
  /** Le libellé du bouton qui ferme. « Confirmer » par défaut. */
  libelleConfirmer?: () => string
  /** La fermeture réelle — d'ordinaire l'émission de `update:modelValue`. */
  appliquer: (valeur: boolean) => void
}

export function useFermetureProtegee(options: FermetureProtegee) {
  const confirmation = useConfirmation()

  const demanderFermeture = () => {
    if (!options.modifie()) {
      options.appliquer(false)
      return
    }

    confirmation.demanderConfirmation({
      description: options.description(),
      libelleConfirmer: options.libelleConfirmer?.(),
      agir: () => options.appliquer(false),
    })
  }

  /*
   * ⚠️ L'OUVERTURE PASSE DIRECTEMENT, LA FERMETURE EST FILTRÉE.
   *
   * C'est toute l'asymétrie du composable, et elle est volontaire : ouvrir ne fait rien perdre.
   * Écrire `true` doit donc rester instantané, sans quoi la modale ne s'ouvrirait plus.
   */
  const ouvert = computed({
    get: () => options.ouvert(),
    set: (valeur: boolean) => {
      if (valeur) {
        options.appliquer(true)
        return
      }
      demanderFermeture()
    },
  })

  return { confirmation, ouvert, demanderFermeture }
}
