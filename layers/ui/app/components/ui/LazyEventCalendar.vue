<template>
  <div>
    <div v-if="loading" class="flex items-center gap-2 text-sm text-gray-500 p-4">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin" />
      <span>{{ t('common.loading') }}...</span>
    </div>
    <div v-else-if="error" class="p-4 text-red-500">
      <UIcon name="i-heroicons-exclamation-circle" />
      <span>{{ t('errors.error_occurred') }}</span>
    </div>
    <!-- Le conteneur existe dès le départ : EventCalendar s'y monte une fois son module chargé. -->
    <div
      v-show="!loading && !error"
      ref="conteneurRef"
      :class="['ui-event-calendar', classeCalendrier]"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * EventCalendar (`@event-calendar/core`, licence MIT), chargé à la demande.
 *
 * Remplace le composant de FullCalendar pour les plannings des bénévoles et du stock : leurs vues
 * « ligne de temps par ressource » relevaient des modules PREMIUM de FullCalendar, sous licence
 * commerciale, et Flowvent est payant. EventCalendar offre la même vue sous licence MIT.
 *
 * ## Le pont entre Vue et le calendrier
 *
 * EventCalendar est un composant Svelte, piloté par `setOption`. Les pages lui passent un objet
 * d'options RÉACTIF (comme elles le faisaient pour FullCalendar) : chaque clé qui change est
 * renvoyée au calendrier, et à lui seul — le reconstruire perdrait la position de défilement et la
 * vue choisie.
 *
 * ⚠️ Les données sont transmises DÉBALLÉES (`toRaw`, copie profonde des tableaux) : un proxy Vue
 * passé à un état Svelte serait suivi par les deux systèmes de réactivité à la fois.
 */
import { toRaw } from 'vue'

type Options = Record<string, any>
type NomDeGreffon = 'ResourceTimeline' | 'Interaction' | 'DayGrid' | 'TimeGrid' | 'List'

interface Props {
  options: Options
  /** Greffons d'EventCalendar à activer, par leur nom d'export. */
  plugins?: NomDeGreffon[]
  class?: string
  /**
   * Position de défilement de la frise depuis le début de la vue, `HH:MM:SS` — au-delà de 24 h
   * pour viser un jour suivant (« 34:00:00 » = le deuxième jour à 10 h).
   *
   * ⚠️ Pas `scrollTime` : dans la ligne de temps d'EventCalendar, il est PLAFONNÉ à la journée et
   * appliqué au premier jour affiché. FullCalendar acceptait plus de 24 h, et le planning s'en
   * servait pour s'ouvrir sur son premier créneau, fût-il le lendemain.
   */
  defilement?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  plugins: () => ['ResourceTimeline', 'Interaction'],
  class: '',
  defilement: null,
})
const { t } = useI18n()

const conteneurRef = ref<HTMLElement | null>(null)
const loading = ref(true)
const error = ref(false)
const classeCalendrier = computed(() => props.class)

let calendrier: any = null
let module: any = null

/** Une copie détachée de toute réactivité Vue, fonctions comprises (elles ne se copient pas). */
function deballer(valeur: any): any {
  const brute = toRaw(valeur)
  if (Array.isArray(brute)) return brute.map(deballer)
  if (brute && typeof brute === 'object' && !(brute instanceof Date) && !(brute instanceof Node)) {
    return Object.fromEntries(Object.entries(brute).map(([cle, v]) => [cle, deballer(v)]))
  }
  return brute
}

/** Dernière valeur transmise pour chaque option : seules celles qui changent repartent. */
const transmis = new Map<string, string | unknown>()
const empreinte = (valeur: unknown) => {
  if (typeof valeur === 'function') return valeur
  try {
    return JSON.stringify(valeur)
  } catch {
    return valeur
  }
}

function synchroniser() {
  if (!calendrier) return
  for (const [cle, valeur] of Object.entries(toRaw(props.options))) {
    const marque = empreinte(valeur)
    if (transmis.get(cle) === marque) continue
    transmis.set(cle, marque)
    calendrier.setOption(cle, deballer(valeur))
  }
}

onMounted(async () => {
  try {
    const [charge] = await Promise.all([
      import('@event-calendar/core'),
      import('@event-calendar/core/index.css'),
    ])
    module = charge
    loading.value = false
    await nextTick()
    if (!conteneurRef.value) return
    const options = deballer(props.options)
    for (const [cle, valeur] of Object.entries(options)) transmis.set(cle, empreinte(valeur))
    calendrier = module.createCalendar(
      conteneurRef.value,
      props.plugins.map((nom) => module[nom]),
      options
    )
    setTimeout(defiler, 60)
  } catch (err) {
    console.error('Error loading EventCalendar:', err)
    error.value = true
    loading.value = false
  }
})

watch(() => props.options, synchroniser, { deep: true })

/** Secondes d'une durée `HH:MM(:SS)`, ou `null`. */
const enSecondes = (duree: unknown): number | null => {
  const morceaux = String(duree ?? '')
    .split(':')
    .map(Number)
  if (morceaux.length < 2 || morceaux.some((n) => !Number.isFinite(n))) return null
  return morceaux[0]! * 3600 + morceaux[1]! * 60 + (morceaux[2] ?? 0)
}

/**
 * Fait défiler la frise à la position demandée, APRÈS le défilement que le calendrier pose
 * lui-même au rendu (il l'emporterait sinon). Une case de la frise couvre `slotDuration` et mesure
 * `slotWidth` pixels.
 */
function defiler() {
  const cible = enSecondes(props.defilement)
  const conteneur = conteneurRef.value?.querySelector<HTMLElement>('.ec-main')
  if (cible === null || !conteneur || !calendrier) return
  const pas = enSecondes(props.options.slotDuration) ?? 1800
  const largeur = Number(props.options.slotWidth) || 32
  conteneur.scrollLeft = (cible / pas) * largeur
}

watch(
  () => props.defilement,
  () => setTimeout(defiler, 60)
)

onBeforeUnmount(() => {
  if (calendrier && module) module.destroyCalendar(calendrier)
  calendrier = null
})

// Même contrat que l'ancien composant : le parent obtient l'API par `getApi()`.
defineExpose({
  getApi: () => calendrier,
})
</script>
