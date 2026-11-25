import type { ComputedRef } from 'vue'

/**
 * L'id NUMÉRIQUE de l'événement de la page courante — celui que les API des layers attendent.
 * Ici, dans `core`, parce que chaque layer d'événement s'en sert (bénévoles, carte, et chaque module
 * porté ensuite dans Flowvent).
 *
 * Contrat d'hôte côté interface : app1 met ce numéro dans ses adresses (`/editions/12/…`), il se lit
 * donc tel quel dans `route.params.id`. Flowvent met un identifiant public aléatoire
 * (`/events/58e143cb3f/…`) : son middleware de route le résout AVANT l'affichage de la page et
 * range la correspondance dans l'état `identifiants-evenements`, que ce composable consulte.
 *
 * Toute page d'un layer lit l'événement par ici, jamais par `Number(route.params.id)` : ce dernier
 * rendrait `NaN` dans Flowvent.
 */
export function useEditionIdRef(): ComputedRef<number> {
  const route = useRoute()
  const correspondances = useState<Record<string, number>>('identifiants-evenements', () => ({}))
  return computed(() => {
    const brut = String(route.params.id ?? '')
    return correspondances.value[brut] ?? Number(brut)
  })
}

/** La valeur, pour une page qui ne change pas d'événement sans se recréer. */
export function useEditionId(): number {
  return useEditionIdRef().value
}
