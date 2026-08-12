<template>
  <UFormField :label="label">
    <div class="space-y-2">
      <!-- Le choix n'a de sens que si l'édition a une carte : sans elle, il ne resterait qu'une
           seule option, et un sélecteur à un choix est une gêne, pas une aide. -->
      <URadioGroup
        v-if="siteMapEnabled"
        v-model="mode"
        orientation="horizontal"
        :items="optionsDeMode"
      />

      <!-- `USelectMenu` et non `USelect` : il apporte une recherche, indispensable dès qu'une
           édition compte une dizaine de zones et autant de repères. `value-key` est nécessaire —
           sans lui le composant lie l'objet entier, là où le modèle attend « zone:12 ». -->
      <USelectMenu
        v-if="siteMapEnabled && mode === 'carte'"
        v-model="referenceChoisie"
        :items="lieuxDeLaCarte"
        value-key="value"
        :placeholder="placeholderCarte ?? t('components.location_picker.select')"
        class="w-full"
      />

      <UInput
        v-else
        v-model="texteLibreSaisi"
        :placeholder="placeholderTexte ?? t('components.location_picker.free_text_placeholder')"
        class="w-full"
      />
    </div>
  </UFormField>
</template>

<script setup lang="ts">
/**
 * Choix d'un lieu pour un élément rattaché à une édition : une zone ou un repère de la carte du
 * site, ou bien du texte libre.
 *
 * Extrait du formulaire de spectacle, où il vivait en double avec celui du programme. Les deux
 * s'étaient déjà mis à diverger — l'un avec recherche, l'autre sans.
 *
 * Ne couvre volontairement que le cas **exclusif** : la carte ou le texte, pas les deux. Les
 * modales de stock affichent les deux côte à côte, avec une mise en page et une icône propres ;
 * les y faire entrer changerait leur apparence sans que personne l'ait demandé.
 */
const props = defineProps<{
  editionId: number
  /** Sans carte du site, seul le texte libre est proposé. */
  siteMapEnabled?: boolean
  label?: string
  placeholderCarte?: string
  placeholderTexte?: string
}>()

const texteLibre = defineModel<string | null>('locationName', { default: null })
const zoneId = defineModel<number | null>('zoneId', { default: null })
const markerId = defineModel<number | null>('markerId', { default: null })

const { t } = useI18n()

/**
 * `UInput` ne sait pas manipuler `null`, alors que l'API attend `null` pour « pas de lieu ».
 * Ce relais fait la conversion aux deux bouts plutôt que de laisser une chaîne vide filer en base.
 */
const texteLibreSaisi = computed({
  get: () => texteLibre.value ?? '',
  set: (v: string) => {
    texteLibre.value = v || null
  },
})

const zones = ref<{ id: number; name: string }[]>([])
const reperes = ref<{ id: number; name: string }[]>([])

/** Le mode se déduit de ce qui est déjà renseigné : on rouvre le formulaire là où on l'a laissé. */
const mode = ref<'carte' | 'texte'>(zoneId.value || markerId.value ? 'carte' : 'texte')

const optionsDeMode = computed(() => [
  { label: t('components.location_picker.on_map'), value: 'carte' },
  { label: t('components.location_picker.free_text'), value: 'texte' },
])

/**
 * Les deux identifiants tiennent dans une seule chaîne (« zone:12 »).
 *
 * Un seul champ pour deux colonnes : la carte ne saurait pas laquelle montrer si les deux étaient
 * renseignées, et deux listes séparées laisseraient composer un état que le serveur refuse.
 */
const referenceChoisie = computed({
  get: () =>
    zoneId.value ? `zone:${zoneId.value}` : markerId.value ? `marker:${markerId.value}` : '',
  set: (valeur: string) => {
    const [genre, id] = valeur ? valeur.split(':') : []
    zoneId.value = genre === 'zone' ? Number(id) : null
    markerId.value = genre === 'marker' ? Number(id) : null
  },
})

/** Zones puis repères, chacun sous son intitulé : la liste reste lisible même longue. */
const lieuxDeLaCarte = computed(() => {
  const groupes: unknown[][] = []
  if (zones.value.length) {
    groupes.push([
      { label: t('components.location_picker.zones'), type: 'label' as const },
      ...zones.value.map((z) => ({ label: z.name, value: `zone:${z.id}` })),
    ])
  }
  if (reperes.value.length) {
    groupes.push([
      { label: t('components.location_picker.markers'), type: 'label' as const },
      ...reperes.value.map((m) => ({ label: m.name, value: `marker:${m.id}` })),
    ])
  }
  return groupes
})

/**
 * Bascule sur la carte quand un lieu y arrive après coup.
 *
 * Les formulaires appelants hydratent leurs champs **après** le montage : sans ce suivi, ouvrir un
 * spectacle déjà rattaché à une zone afficherait « texte libre », et le lieu enregistré resterait
 * invisible. On ne fait le trajet que dans ce sens — repasser en texte efface les identifiants,
 * donc rien ne peut rebasculer tout seul.
 */
watch([zoneId, markerId], ([z, m]) => {
  if ((z || m) && mode.value !== 'carte') mode.value = 'carte'
})

/** Changer de mode efface l'autre saisie : la garder enverrait un lieu que l'on croyait remplacé. */
watch(mode, (nouveau) => {
  if (nouveau === 'carte') {
    texteLibre.value = null
  } else {
    zoneId.value = null
    markerId.value = null
  }
})

const charger = async () => {
  if (!props.siteMapEnabled) return
  try {
    const [z, m] = await Promise.all([
      $fetch<{ data?: { zones?: { id: number; name: string }[] } }>(
        `/api/editions/${props.editionId}/zones`
      ),
      $fetch<{ data?: { markers?: { id: number; name: string }[] } }>(
        `/api/editions/${props.editionId}/markers`
      ),
    ])
    zones.value = z.data?.zones ?? []
    reperes.value = m.data?.markers ?? []
  } catch (error) {
    // Un lieu introuvable ne doit pas empêcher de saisir le reste du formulaire : on retombe sur
    // le texte libre plutôt que de bloquer.
    console.error('Chargement des lieux de la carte impossible', error)
  }
}

onMounted(charger)
watch(() => [props.editionId, props.siteMapEnabled], charger)
</script>
