<template>
  <UInput
    v-model="texte"
    type="text"
    inputmode="decimal"
    :placeholder="placeholder"
    :disabled="disabled"
    :size="size"
    autocomplete="off"
    @blur="reformater"
  >
    <template v-if="symbole" #trailing>
      <span class="text-gray-500 dark:text-gray-400 text-sm">{{ symbole }}</span>
    </template>
  </UInput>
</template>

<script setup lang="ts">
import { currencySymbol, parseMontantSaisi } from '~~/shared/utils/money'

/**
 * Un champ de montant qui accepte la virgule ET le point.
 *
 * ## ⚠️ POURQUOI IL EXISTE : UN FACTEUR CENT, SILENCIEUX
 *
 * Mesuré le 08/10/2026 sur les deux composants que le dépôt employait :
 *
 * | tapé      | `UInput type="number"` | `UInputNumber` (locale anglaise) |
 * | --------- | ---------------------- | -------------------------------- |
 * | `12,50`   | `1250`, **valide**     | `1,250` → envoyé `1250`          |
 * | `1234,56` | `123456`               | `123,456`                        |
 *
 * Un champ natif **avale** la virgule et `checkValidity()` rend quand même `true` ; `UInputNumber`
 * la lit comme un séparateur de milliers. Dans les deux cas, cent fois trop sur un nombre
 * plausible — et la virgule est le séparateur décimal de tout francophone.
 *
 * Câbler la locale française dans Nuxt UI ne suffit pas : mesuré aussi, cela **retourne** le
 * défaut sur le point (`12.50` → `1 250`), qui est justement l'habitude prise faute de mieux.
 * D'où un champ TEXTE, et une analyse qui accepte les deux — `parseMontantSaisi`.
 *
 * ## Le reformatage en sortie de saisie n'est pas cosmétique
 *
 * En quittant le champ, il réaffiche le montant COMPRIS. C'est ce qui rend visible la seule
 * ambiguïté que l'analyse ne peut pas lever : `1.000` est lu `1,00`, et on le voit immédiatement
 * au lieu de l'enregistrer. Voir la note de `parseMontantSaisi` sur le sens dans lequel elle
 * tranche, et pourquoi.
 *
 * 📍 `type="text"` et non `number` : c'est le navigateur qui décidait du séparateur, et il décidait
 * mal. `inputmode="decimal"` garde le pavé numérique sur mobile.
 *
 * 📍 Pas de `min`/`max` ici : les montants sont validés par les schémas zod des formulaires et par
 * le serveur. Les redire ici en ferait une troisième place à tenir d'accord.
 */
const modele = defineModel<number | null>({ default: null })

const props = withDefaults(
  defineProps<{
    placeholder?: string
    disabled?: boolean
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    /** Le code de la devise, pour afficher son symbole à droite du champ. */
    currency?: string | null
  }>(),
  { size: 'md' }
)

const { locale } = useI18n()

const symbole = computed(() =>
  props.currency ? currencySymbol(props.currency, locale.value) : null
)

const texte = ref('')

/**
 * L'affichage d'un montant compris : groupé et avec ses décimales, dans la locale du lecteur.
 *
 * `maximumFractionDigits: 2` sans minimum : un montant rond s'affiche « 12 » et non « 12,00 », ce
 * qui évite d'ajouter des zéros que personne n'a tapés.
 */
const afficher = (valeur: number) =>
  new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }).format(valeur)

/*
 * ⚠️ NE PAS RÉÉCRIRE LE CHAMP PENDANT LA SAISIE. Le `watch` ne remplace le texte que si la valeur
 * venue de l'extérieur DIFFÈRE de ce que le champ désigne déjà : sans cette garde, taper « 12, »
 * se verrait aussitôt réécrit en « 12 », et les centimes seraient impossibles à saisir.
 */
watch(
  modele,
  (valeur) => {
    if (parseMontantSaisi(texte.value) === valeur) return
    texte.value = valeur === null || valeur === undefined ? '' : afficher(valeur)
  },
  { immediate: true }
)

watch(texte, (saisie) => {
  modele.value = parseMontantSaisi(saisie)
})

/** En quittant le champ, réafficher ce qui a été COMPRIS — voir la note en tête. */
function reformater() {
  const valeur = parseMontantSaisi(texte.value)
  texte.value = valeur === null ? '' : afficher(valeur)
}
</script>
