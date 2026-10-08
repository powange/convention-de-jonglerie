import { currencySymbol, DEFAULT_CURRENCY, formatCents } from '~~/shared/utils/money'

/**
 * Met en forme un montant dans la devise de l'édition.
 *
 * Remplace les `(montant / 100).toFixed(2) + ' €'` disséminés dans les écrans : la division y
 * était refaite à chaque endroit, et le symbole écrit en dur affichait des euros sur une édition
 * réglée en francs suisses.
 *
 * Les commandes importées ne portent pas de devise propre : HelloAsso n'en renvoie aucune, et
 * chez Infomaniak la devise est un en-tête de requête indiquant dans laquelle exprimer les
 * montants. Celle de l'édition est donc la seule référence.
 *
 * L'identifiant est facultatif : sans lui, il est lu depuis la route, ces écrans vivant tous
 * sous `/editions/:id`.
 */
export function useEditionCurrency(editionId?: MaybeRefOrGetter<number | undefined>) {
  const route = useRoute()
  const editionStore = useEditionStore()
  const { locale } = useI18n()

  const resolvedId = computed(() => {
    const given = toValue(editionId)
    return given ?? parseInt(route.params.id as string)
  })

  const currency = computed(
    () => editionStore.getEditionById(resolvedId.value)?.currency || DEFAULT_CURRENCY
  )

  /** Montant en centimes → chaîne localisée, symbole compris. */
  const money = (cents: number | null | undefined) =>
    formatCents(cents, currency.value, locale.value)

  /**
   * Symbole seul, pour les suffixes de champs de saisie.
   *
   * `Intl` n'expose pas de méthode dédiée : on met en forme zéro et on retire chiffres,
   * séparateurs et espaces — y compris l'espace insécable étroit utilisé en français.
   */
  /**
   * Le seul symbole de la devise.
   *
   * 📍 La règle vit dans `money.ts` et nulle part ailleurs : elle était recopiée ici, dans
   * `ArtistModal` et dans `UiMoneyInput`. Trois copies d'une expression qui retire des espaces
   * insécables finissent par ne plus retirer les mêmes.
   */
  const symbol = computed(() => currencySymbol(currency.value, locale.value))

  return { currency, money, symbol }
}
