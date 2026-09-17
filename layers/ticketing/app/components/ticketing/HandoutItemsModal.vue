<script setup lang="ts">
/**
 * La coquille commune des modales « articles à remettre ».
 *
 * Sept écrans associent des articles à une cible — un tarif, une option, un spectacle, un
 * artiste, un repas, tous les artistes, une portée organisateur. Ils faisaient tous la même
 * chose : charger les articles de l'édition, afficher le sélecteur, enregistrer, fermer. Sept
 * fois le même squelette, donc sept endroits où une correction pouvait n'atterrir que six fois.
 *
 * Ce composant tient le squelette ; les écrans ne gardent que ce qui leur est propre : le titre,
 * la phrase d'aide, d'où vient la sélection courante, et la forme du corps de requête.
 *
 * **La modale des champs personnalisés reste à part, délibérément.** Elle porte une troisième
 * dimension — `choiceValue`, l'article conditionné à une réponse précise — qu'aucune des sept
 * autres cibles n'a. La faire entrer ici obligerait la coquille à porter un cas que presque
 * personne n'emploie, ce qui est la façon habituelle de rendre une abstraction pire que la
 * duplication qu'elle remplace.
 */
interface ArticleDisponible {
  id: number
  name: string
}

interface LigneDeSelection {
  handoutItemId: number
  quantity: number
}

/**
 * Ce que les écrans transmettent en entrée : la quantité y est facultative, parce qu'elle vient
 * d'objets Prisma où elle peut manquer. Elle vaut alors un exemplaire — la même règle que
 * `normalizeHandoutItemSelections` applique côté serveur.
 */
interface LigneRecue {
  handoutItemId: number
  quantity?: number | null
}

const props = withDefaults(
  defineProps<{
    open: boolean
    editionId: number
    /** Titre de la modale, composé par l'écran appelant. */
    title: string
    /** Phrase d'aide affichée au-dessus du sélecteur. Absente = pas de paragraphe. */
    help?: string
    /** Libellé du champ qui porte le sélecteur. */
    fieldLabel: string
    /**
     * La sélection courante de la cible. Un tableau quand l'écran la tient déjà (elle vient
     * alors de l'objet affiché), une fonction quand il faut aller la chercher.
     */
    initialSelection: LigneRecue[] | (() => LigneRecue[] | Promise<LigneRecue[]>)
    /** Point d'API d'écriture, à sémantique de remplacement complet. */
    saveUrl: string
    /** Corps de la requête, construit à partir de la sélection retenue. */
    saveBody: (selection: LigneDeSelection[]) => unknown
    /**
     * Restreint les articles proposés. Employé par les organisateurs, qui écartent du choix
     * d'une personne ce qui lui est déjà remis globalement.
     */
    filterItems?: (items: ArticleDisponible[], selection: LigneDeSelection[]) => ArticleDisponible[]
  }>(),
  { help: undefined, filterItems: undefined }
)

const emit = defineEmits<{
  'update:open': [v: boolean]
  saved: []
}>()

const { t } = useI18n()

const isOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

const availableItems = ref<ArticleDisponible[]>([])
const selection = ref<LigneDeSelection[]>([])
const chargement = ref(false)

/**
 * Charge ce qu'il faut à l'ouverture : les articles de l'édition, et la sélection de la cible.
 *
 * Les deux partent ensemble : la seconde ne dépend pas de la première, et les enchaîner ferait
 * clignoter le sélecteur entre deux états incomplets.
 */
async function charger() {
  chargement.value = true
  try {
    const [reponse, selectionInitiale] = await Promise.all([
      $fetch<any>(`/api/editions/${props.editionId}/ticketing/handout-items`),
      Promise.resolve(
        typeof props.initialSelection === 'function'
          ? props.initialSelection()
          : props.initialSelection
      ),
    ])
    availableItems.value = reponse?.data?.handoutItems ?? []
    selection.value = (selectionInitiale ?? []).map((ligne) => ({
      handoutItemId: ligne.handoutItemId,
      quantity: ligne.quantity ?? 1,
    }))
  } catch (error) {
    console.error('Erreur lors du chargement des articles à remettre :', error)
  } finally {
    chargement.value = false
  }
}

const articlesProposes = computed(() =>
  props.filterItems
    ? props.filterItems(availableItems.value, selection.value)
    : availableItems.value
)

const { execute: enregistrer, loading: enregistrement } = useApiAction(() => props.saveUrl, {
  method: 'PUT',
  body: () => props.saveBody(selection.value),
  successMessage: { title: t('common.saved') },
  errorMessages: { default: t('common.error') },
  onSuccess: () => {
    emit('saved')
    isOpen.value = false
  },
})

watch(
  () => props.open,
  (ouvert) => {
    if (ouvert) charger()
    else selection.value = []
  },
  { immediate: true }
)
</script>

<template>
  <UModal v-model:open="isOpen" :title="title" :ui="{ content: 'sm:max-w-xl' }">
    <template #body>
      <div v-if="chargement" class="text-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="animate-spin mx-auto h-8 w-8" />
      </div>

      <div v-else class="space-y-4">
        <p v-if="help" class="text-sm text-gray-600 dark:text-gray-400">{{ help }}</p>

        <UFormField :label="fieldLabel">
          <TicketingHandoutItemsQuantityPicker v-model="selection" :items="articlesProposes" />
        </UFormField>

        <p v-if="availableItems.length === 0" class="text-sm text-amber-600 dark:text-amber-400">
          {{ $t('gestion.ticketing.no_handout_items_created') }}
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton variant="ghost" color="neutral" @click="isOpen = false">
          {{ $t('common.cancel') }}
        </UButton>
        <UButton
          color="primary"
          :loading="enregistrement"
          :disabled="chargement"
          @click="enregistrer"
        >
          {{ $t('common.save') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
