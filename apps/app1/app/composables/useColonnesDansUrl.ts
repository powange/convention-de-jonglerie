import {
  colonnesMasqueesDepuisUrl,
  colonnesMasqueesVersUrl,
  PARAMETRE_DE_COLONNES,
} from '~/utils/colonnes-url'

/**
 * Retenir dans l'URL les colonnes qu'on a masquées.
 *
 * À brancher sur le `v-model:column-visibility` d'un `UTable`, et non sur l'API TanStack : cet
 * état doit exister AVANT le montage du tableau, puisqu'on le lit dans l'URL alors qu'il n'y a
 * encore rien à l'écran. `UiColumnsMenu`, lui, continue de piloter l'API — TanStack tient les deux
 * synchronisés, et chacun garde le rôle qui lui convient.
 *
 * ```ts
 * const colonnesMasquables = computed(() => colonnes.value.filter((c) => c.enableHiding !== false).map((c) => c.id))
 * const { visibilite } = useColonnesDansUrl(colonnesMasquables)
 * ```
 * ```vue
 * <UTable ref="tableRef" v-model:column-visibility="visibilite" … />
 * <UiColumnsMenu :table-api="tableRef?.tableApi" />
 * ```
 *
 * `replace` et non `push` : choisir ses colonnes n'est pas une navigation, et chaque case cochée
 * laisserait autrement un pas dans l'historique qu'il faudrait défaire un par un.
 */
export function useColonnesDansUrl(
  masquables: MaybeRefOrGetter<readonly string[]>,
  options: {
    /**
     * Les colonnes masquées DÈS L'ARRIVÉE, s'il y en a.
     *
     * Trois tableaux en ont : sans les déclarer ici, un lien sans paramètre les rendrait visibles,
     * ce qui n'est pas leur état d'origine. L'URL porte alors l'ÉCART à ces défauts, et non l'état
     * absolu — c'est ce qui permet de retenir « j'ai révélé la description ».
     */
    defauts?: Record<string, boolean>
    /** Le nom du paramètre, si l'écran en porte déjà un autre. */
    parametre?: string
  } = {}
) {
  const defauts = options.defauts ?? {}
  const parametre = options.parametre ?? PARAMETRE_DE_COLONNES
  const route = useRoute()
  const router = useRouter()

  const visibilite = ref<Record<string, boolean>>(
    colonnesMasqueesDepuisUrl(route.query[parametre], toValue(masquables), defauts)
  )

  /*
   * Les colonnes masquables ne sont pas toujours connues au premier rendu : elles viennent de la
   * définition des colonnes, qui dépend souvent de `t()` ou des droits. On relit donc l'URL quand
   * la liste arrive — sans quoi un lien portant `colonnes=ip` ouvrait le tableau complet.
   */
  watch(
    () => toValue(masquables),
    (liste, precedente) => {
      if (precedente?.length || !liste.length) return
      visibilite.value = colonnesMasqueesDepuisUrl(route.query[parametre], liste, defauts)
    },
    { immediate: true }
  )

  watch(
    visibilite,
    (etat) => {
      const valeur = colonnesMasqueesVersUrl(etat, defauts)
      // Le paramètre DISPARAÎT quand tout est visible : une URL ne porte que ce qui s'écarte de
      // l'état d'arrivée, et « colonnes= » vide se lirait comme un choix. On reconstruit donc la
      // requête sans lui, plutôt que d'en retirer la clé après coup.
      const query = Object.fromEntries(
        Object.entries(route.query).filter(([cle]) => cle !== parametre)
      )
      if (valeur) query[parametre] = valeur

      router.replace({ query })
    },
    { deep: true }
  )

  return { visibilite }
}
