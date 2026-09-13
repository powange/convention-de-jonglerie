<!--
  Créer une liste de courses, ou verser une sélection dans une liste existante.

  Une seule modale pour les deux gestes, et c'est délibéré : au moment où l'on vient de cocher du
  matériel manquant, « nouvelle liste » et « ajouter à la liste de samedi » sont la même décision,
  prise au même instant. Deux boutons distincts obligeraient à choisir avant de savoir ce qui
  existe déjà.

  Elle sert aussi à renommer, ce qui n'ajoute qu'un champ : le reste du formulaire disparaît.
-->
<template>
  <UModal v-model:open="ouvert" :title="titre">
    <template #body>
      <div class="space-y-4">
        <!-- En renommage, la destination n'a pas lieu d'être : il n'y a rien à verser. -->
        <UFormField v-if="!renommage" :label="t('gestion.stock.shopping_destination')">
          <USelect v-model="destination" :items="destinations" class="w-full" />
        </UFormField>

        <UFormField
          v-if="renommage || destination === NOUVELLE"
          :label="t('gestion.stock.shopping_list_name')"
          :error="erreurNom"
        >
          <UInput
            v-model="nom"
            :placeholder="t('gestion.stock.shopping_list_name_placeholder')"
            autofocus
            class="w-full"
            @update:model-value="touche = true"
            @keyup.enter="valider"
          />
        </UFormField>

        <!-- Dire ce qui va être versé, et non le laisser deviner : on arrive ici après avoir coché
             des cases plus haut, et le compte est la seule confirmation que la bonne sélection a
             suivi. -->
        <p v-if="!renommage" class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('gestion.stock.shopping_will_add', { count: itemIds.length }) }}
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton color="neutral" variant="ghost" @click="ouvert = false">
          {{ t('common.cancel') }}
        </UButton>
        <UButton :loading="enCours" :disabled="!valide" @click="valider">
          {{ renommage ? t('common.save') : t('gestion.stock.shopping_add') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
interface ListeExistante {
  id: number
  name: string
}

const props = defineProps<{
  editionId: number
  /** Le matériel à verser. Vide en renommage. */
  itemIds: number[]
  listes: ListeExistante[]
  /** Renseigné, la modale renomme cette liste au lieu d'en remplir une. */
  listeARenommer?: ListeExistante | null
}>()

const emit = defineEmits<{ saved: [] }>()

const ouvert = defineModel<boolean>('open', { default: false })

const { t } = useI18n()

/** Valeur sentinelle de la destination « nouvelle liste ». Négative : aucun identifiant ne la vaut. */
const NOUVELLE = -1

const nom = ref('')
const destination = ref<number>(NOUVELLE)

const renommage = computed(() => !!props.listeARenommer)

const titre = computed(() =>
  renommage.value ? t('gestion.stock.shopping_rename') : t('gestion.stock.shopping_add_to_list')
)

const destinations = computed(() => [
  { label: t('gestion.stock.shopping_new_list'), value: NOUVELLE },
  ...props.listes.map((liste) => ({ label: liste.name, value: liste.id })),
])

/**
 * Le champ a-t-il été touché par une VRAIE frappe&nbsp;?
 *
 * Marqué depuis l'événement de saisie, et non par un `watch` sur la valeur : la remise à zéro à
 * l'ouverture change elle aussi `nom`, et son watcher se serait exécuté APRÈS le `touche = false`
 * qui la suit. Rouvrir la modale après avoir créé une liste affichait alors « Le nom est requis »
 * avant qu'on ait tapé quoi que ce soit — le reproche exact que ce drapeau existe pour éviter.
 */
const touche = ref(false)

const erreurNom = computed(() => {
  // Le message n'apparaît qu'une fois le champ touché puis vidé : l'afficher à l'ouverture
  // reprocherait de n'avoir pas encore tapé.
  if (!touche.value) return undefined
  return nom.value.trim() ? undefined : t('gestion.stock.shopping_name_required')
})

const valide = computed(() => {
  if (renommage.value || destination.value === NOUVELLE) return nom.value.trim().length > 0
  return true
})

/**
 * À l'ouverture, la modale repart de zéro — sauf en renommage, où elle part du nom actuel.
 *
 * Sans cette remise à zéro, le nom de la liste créée la fois précédente reste dans le champ et
 * l'on crée « Quincaillerie » deux fois sans s'en apercevoir : les noms ne sont pas uniques.
 */
watch(ouvert, (estOuvert) => {
  if (!estOuvert) return
  nom.value = props.listeARenommer?.name ?? ''
  destination.value = NOUVELLE
  touche.value = false
})

const { execute: creer, loading: creation } = useApiAction(
  () => `/api/editions/${props.editionId}/stock-shopping-lists`,
  {
    method: 'POST',
    body: () => ({ name: nom.value.trim(), itemIds: props.itemIds }),
    successMessage: { title: t('gestion.stock.shopping_list_created') },
    errorMessages: { default: t('gestion.stock.shopping_list_error') },
    onSuccess: () => fini(),
  }
)

const { execute: ajouter, loading: ajout } = useApiAction(
  () => `/api/editions/${props.editionId}/stock-shopping-lists/${destination.value}/items`,
  {
    method: 'POST',
    body: () => ({ itemIds: props.itemIds }),
    successMessage: { title: t('gestion.stock.shopping_items_added') },
    errorMessages: { default: t('gestion.stock.shopping_list_error') },
    onSuccess: () => fini(),
  }
)

const { execute: renommer, loading: renommageEnCours } = useApiAction(
  () => `/api/editions/${props.editionId}/stock-shopping-lists/${props.listeARenommer?.id}`,
  {
    method: 'PUT',
    body: () => ({ name: nom.value.trim() }),
    successMessage: { title: t('common.saved') },
    errorMessages: { default: t('gestion.stock.shopping_list_error') },
    onSuccess: () => fini(),
  }
)

const enCours = computed(() => creation.value || ajout.value || renommageEnCours.value)

function fini() {
  ouvert.value = false
  emit('saved')
}

function valider() {
  if (!valide.value || enCours.value) return
  if (renommage.value) return renommer()
  return destination.value === NOUVELLE ? creer() : ajouter()
}
</script>
