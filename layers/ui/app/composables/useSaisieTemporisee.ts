import { onScopeDispose, ref, watch, type Ref } from 'vue'

/**
 * Une saisie qui s'affiche tout de suite et ne filtre qu'après une pause.
 *
 * ⚠️ POURQUOI DEUX VALEURS ET NON UNE SEULE TEMPORISÉE. Reposer directement le champ sur une
 * valeur temporisée ferait traîner les lettres à l'écran : on tape « rallonge » et on voit
 * « rall » pendant un quart de seconde. C'est pire que le défaut qu'on corrige, parce que c'est
 * visible.
 *
 * D'où la séparation : `saisie` alimente le champ et suit la frappe au caractère, tandis que le
 * modèle — donc le filtrage, et l'écriture de l'adresse — n'est mis à jour qu'une fois la frappe
 * retombée.
 *
 * ⚠️ POURQUOI PAS `refDebounced` DE VUEUSE, qui fait déjà cela. Il ne rend qu'une valeur
 * temporisée, sans moyen de vider la file. Il manque donc les deux gestes qui doivent être
 * IMMÉDIATS :
 *
 * - la touche Entrée, qui veut dire « maintenant » et non « dans un quart de seconde » ;
 * - la croix d'effacement, qui doit tout rendre d'un coup — attendre après un clic sur une croix
 *   donne l'impression que le clic n'a pas été pris.
 *
 * `appliquer()` sert à ces deux-là.
 *
 * ⚠️ ET LE MODÈLE PEUT CHANGER DE L'EXTÉRIEUR : un bouton « tout effacer » chez le parent, un
 * filtre repris de l'adresse au chargement. La saisie suit alors le modèle, et l'écriture en
 * attente est ABANDONNÉE — sans cela elle réécrirait un quart de seconde plus tard la valeur qu'on
 * vient justement d'effacer, et la remise à zéro paraîtrait ne pas avoir marché.
 *
 * La file est vidée à la destruction de la portée. Ce n'est pas de la précaution : un minuteur qui
 * se déclenche après le démontage d'un composant produit, en test, un rejet non géré qui fait
 * rougir la CI sans nommer aucun test — le cas s'est déjà produit dans ce dépôt (#618).
 */
export function useSaisieTemporisee(modele: Ref<string>, delai = 250) {
  const saisie = ref(modele.value)
  let minuteur: ReturnType<typeof setTimeout> | undefined

  function annuler() {
    if (minuteur === undefined) return
    clearTimeout(minuteur)
    minuteur = undefined
  }

  /** Écrit la saisie dans le modèle sans attendre, et vide la file. */
  function appliquer() {
    annuler()
    if (modele.value !== saisie.value) modele.value = saisie.value
  }

  watch(saisie, () => {
    annuler()
    // Rien à écrire quand les deux coïncident déjà : c'est le cas juste après une reprise du
    // modèle ci-dessous, et poser un minuteur pour une écriture sans effet rallongerait pour rien
    // la fenêtre pendant laquelle une remise à zéro peut être défaite.
    if (saisie.value === modele.value) return
    minuteur = setTimeout(appliquer, delai)
  })

  watch(modele, (valeur) => {
    if (valeur === saisie.value) return
    annuler()
    saisie.value = valeur
  })

  onScopeDispose(annuler)

  return { saisie, appliquer }
}
