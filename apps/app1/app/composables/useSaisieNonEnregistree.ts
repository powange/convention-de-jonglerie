import type { Confirmation } from '~/composables/useConfirmation'

/**
 * Prévenir avant de quitter une page dont la saisie n'est pas enregistrée.
 *
 * Vérifié sur `general-info` avant d'être corrigé : un champ rempli, un clic dans la barre
 * latérale, un retour — et le champ était vide, **sans qu'aucune boîte ne se soit affichée**.
 *
 * ⚠️ Tous les écrans à bouton d'enregistrement n'en ont PAS besoin. Plusieurs — `ticketing/config`,
 * `volunteers/config` — enregistrent chaque réglage au fil de l'eau : y poser cette garde ferait
 * poser la question pour ce qui est déjà sauvegardé, et l'on apprend vite à cliquer sans lire.
 * Avant d'appliquer ce composable à un écran, vérifier qu'il a réellement quelque chose à perdre.
 *
 * ```ts
 * const formulaire = useTemplateRef<HTMLElement>('formulaire')
 * const { marquerEnregistre, confirmation } = useSaisieNonEnregistree(formulaire)
 * // après un enregistrement réussi :
 * marquerEnregistre()
 * ```
 * ```vue
 * <div ref="formulaire"> … </div>
 * <UiConfirmationDemandee :confirmation="confirmation" />
 * ```
 *
 * **Pourquoi écouter le formulaire plutôt que comparer un état.** Ces pages n'ont pas d'objet de
 * formulaire : leur état vit dans des dizaines de `ref` séparés. Les énumérer par page aurait
 * produit une liste à tenir à jour, qui aurait dérivé au premier champ ajouté — et un champ oublié
 * dans la liste, c'est une saisie perdue en silence, le défaut même qu'on corrige. Écouter les
 * événements `input` et `change` d'un conteneur ne demande rien à tenir : un champ nouveau est
 * couvert du seul fait d'exister.
 *
 * Le prix de ce choix, assumé : une valeur modifiée puis remise à la main compte comme une
 * modification, et la question sera posée pour rien. C'est le sens dans lequel on préfère se
 * tromper — l'erreur inverse fait perdre le travail.
 */
export function useSaisieNonEnregistree(
  conteneur: Ref<HTMLElement | null | undefined>,
  options: {
    /** La confirmation à réutiliser, si l'écran en a déjà une. Sinon le composable en crée une. */
    confirmation?: Confirmation
  } = {}
) {
  const confirmation = options.confirmation ?? useConfirmation()
  const modifie = ref(false)

  const surSaisie = () => {
    modifie.value = true
  }

  /*
   * En phase de CAPTURE, et sur les deux événements.
   *
   * `input` couvre la frappe, `change` les contrôles qui ne l'émettent pas — cases, listes,
   * sélecteurs de date. La capture évite qu'un composant qui arrête la propagation de son propre
   * événement nous rende aveugles à ce qu'il vient de modifier.
   */
  const ecouter = (element: HTMLElement) => {
    element.addEventListener('input', surSaisie, true)
    element.addEventListener('change', surSaisie, true)
  }
  const oublier = (element: HTMLElement) => {
    element.removeEventListener('input', surSaisie, true)
    element.removeEventListener('change', surSaisie, true)
  }

  watch(
    conteneur,
    (element, precedent) => {
      if (precedent) oublier(precedent)
      if (element) ecouter(element)
    },
    { immediate: true, flush: 'post' }
  )

  /** À appeler après un enregistrement réussi : ce qui est enregistré n'est plus à perdre. */
  function marquerEnregistre() {
    modifie.value = false
  }

  /*
   * La fermeture de l'onglet ou le rechargement.
   *
   * Le navigateur impose son propre libellé et ne laisse pas le choisir ; c'est le seul endroit où
   * l'on ne maîtrise pas le message. La garde de navigation interne, elle, passe par la modale de
   * l'application.
   */
  const surFermeture = (evenement: BeforeUnloadEvent) => {
    if (!modifie.value) return
    evenement.preventDefault()
  }
  onMounted(() => window.addEventListener('beforeunload', surFermeture))
  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', surFermeture)
    if (conteneur.value) oublier(conteneur.value)
  })

  useGardeDeSortie(() => modifie.value, confirmation)

  return { modifie, marquerEnregistre, confirmation }
}

/**
 * Demander confirmation avant de quitter la page, quand un écran sait déjà qu'il a été modifié.
 *
 * Séparée de la détection : deux écrans de spectacles tiennent leur propre `isDirty`, hérité du
 * composant de formulaire, et n'ont besoin que de la garde. Ils appelaient `confirm()` pour cela —
 * la boîte du navigateur, qui ne se traduit pas et que l'on peut désactiver.
 *
 * ⚠️ La garde ATTEND la réponse de la modale, là où `confirm()` bloquait le fil d'exécution. Le
 * routeur sait attendre une promesse ; il faut seulement la résoudre dans les DEUX cas, sans quoi
 * renoncer laisse la navigation en suspens pour toujours — et la page devient inquittable.
 */
export function useGardeDeSortie(modifie: () => boolean, confirmationExistante?: Confirmation) {
  const { t } = useI18n()
  const confirmation = confirmationExistante ?? useConfirmation()

  onBeforeRouteLeave(() => {
    if (!modifie()) return true
    return new Promise<boolean>((resoudre) => {
      confirmation.demanderConfirmation({
        titre: t('common.unsaved_changes'),
        description: t('common.unsaved_changes_warning'),
        libelleConfirmer: t('common.leave_without_saving'),
        agir: () => resoudre(true),
        renoncer: () => resoudre(false),
      })
    })
  })

  return { confirmation }
}
