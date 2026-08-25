<template>
  <!-- Non modifiable : l'affichage seul, sans rien qui laisse croire qu'on peut cliquer. -->
  <ProgramLieuBadges v-if="!modifiable" :entree="entree" />

  <UPopover v-else v-model:open="ouvert">
    <UButton
      variant="ghost"
      color="neutral"
      size="sm"
      class="-mx-2 max-w-full"
      :aria-label="$t('gestion.program.edit_place')"
      :title="$t('gestion.program.edit_place')"
      :loading="enregistrement"
    >
      <ProgramLieuBadges :entree="entree" />
    </UButton>

    <template #content>
      <div class="w-80 space-y-3 p-4">
        <EditionLocationPicker
          v-model:location-name="brouillon.locationName"
          v-model:zone-id="brouillon.zoneId"
          v-model:marker-id="brouillon.markerId"
          :edition-id="editionId"
          :site-map-enabled="siteMapEnabled"
          :label="$t('gestion.program.field.place')"
        />

        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="neutral" size="sm" @click="ouvert = false">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton color="primary" size="sm" :loading="enregistrement" @click="enregistrer">
            {{ $t('common.save') }}
          </UButton>
        </div>
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
/**
 * Lieu d'une entrée du programme : affiché comme sur la page des spectacles, et modifiable sur
 * place.
 *
 * Changer un lieu est le geste le plus courant de la composition d'un programme — une salle qui
 * change à la veille de l'événement — et passer par la modale complète pour cela faisait rouvrir
 * titre, description et horaires, avec le risque d'en toucher un au passage.
 *
 * Les workshops restent en lecture seule : leur lieu est un enregistrement **partagé** entre
 * plusieurs workshops, si bien que le modifier ici renommerait l'endroit pour tous les autres.
 * C'est la même asymétrie que pour leur visibilité, et elle se règle sur leur propre page.
 */
import type { EntreeProgramme } from '~~/shared/utils/program-timeline'

const props = defineProps<{
  entree: EntreeProgramme
  editionId: number
  /** Sans carte du site, seul le texte libre est proposé. */
  siteMapEnabled?: boolean
}>()

const emit = defineEmits<{ enregistre: [] }>()

const { t } = useI18n()

/** Le lieu d'un workshop appartient à son module : voir l'en-tête. */
const modifiable = computed(() => props.entree.source !== 'workshop')

const ouvert = ref(false)

/**
 * Copie de travail : le lieu n'est envoyé qu'à l'enregistrement.
 *
 * Modifier l'entrée en place aurait montré le nouveau lieu sur la frise avant que la base en sache
 * quoi que ce soit — et l'y aurait laissé si l'appel échouait.
 */
const brouillon = reactive({
  locationName: null as string | null,
  zoneId: null as number | null,
  markerId: null as number | null,
})

/**
 * Le brouillon se recharge à chaque ouverture, et non au montage : la frise se recharge après
 * chaque écriture, mais une modification faite ailleurs — ou abandonnée ici — laisserait sinon un
 * brouillon périmé prêt à être renvoyé tel quel.
 */
watch(ouvert, (estOuvert) => {
  if (!estOuvert) return
  brouillon.locationName = props.entree.lieuTexte
  brouillon.zoneId = props.entree.zone?.id ?? null
  brouillon.markerId = props.entree.repere?.id ?? null
})

/**
 * Deux actions plutôt qu'une, parce que les deux sources n'ont ni la même table ni les mêmes
 * règles : le spectacle accepte une mise à jour partielle, l'élément libre passe par un point
 * dédié — son `PUT` attend l'objet complet pour pouvoir vérifier que la fin suit le début.
 *
 * La méthode HTTP se fixe à la construction du composable : la choisir au moment de l'appel
 * demanderait de la relire à chaque exécution, ce que l'interface ne prévoit pas.
 */
const apresEnregistrement = () => {
  ouvert.value = false
  emit('enregistre')
}

const { execute: enregistrerSpectacle, loading: chargeSpectacle } = useApiAction(
  // `sourceId` désigne la représentation : c'est elle qui porte le lieu, pas le spectacle.
  () => `/api/editions/${props.editionId}/shows/performances/${props.entree.sourceId}`,
  {
    method: 'PATCH',
    // Le spectacle nomme son texte libre `location`, l'élément `locationName` : deux tables, deux
    // colonnes, et rien qui justifie d'en renommer une pour l'autre.
    body: () => ({
      location: brouillon.locationName,
      zoneId: brouillon.zoneId,
      markerId: brouillon.markerId,
    }),
    silentSuccess: true,
    errorMessages: { default: t('gestion.program.place_error') },
    onSuccess: apresEnregistrement,
  }
)

const { execute: enregistrerElement, loading: chargeElement } = useApiAction(
  () => `/api/editions/${props.editionId}/program-items/${props.entree.sourceId}/location`,
  {
    method: 'PATCH',
    body: () => ({
      locationName: brouillon.locationName,
      zoneId: brouillon.zoneId,
      markerId: brouillon.markerId,
    }),
    silentSuccess: true,
    errorMessages: { default: t('gestion.program.place_error') },
    onSuccess: apresEnregistrement,
  }
)

const enregistrement = computed(() => chargeSpectacle.value || chargeElement.value)

const enregistrer = async () => {
  if (props.entree.source === 'spectacle') await enregistrerSpectacle()
  else await enregistrerElement()
}
</script>
