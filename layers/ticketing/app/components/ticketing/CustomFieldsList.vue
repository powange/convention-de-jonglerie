<template>
  <div class="space-y-4">
    <!-- En-tête avec bouton ajouter -->
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Champs personnalisés</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Gérez les champs personnalisés pour vos tarifs
        </p>
      </div>
      <UButton icon="i-heroicons-plus" color="primary" @click="openCreateModal">
        Ajouter un champ
      </UButton>
    </div>

    <!-- État de chargement -->
    <div v-if="loading" class="flex justify-center py-8">
      <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin text-primary-500" />
    </div>

    <!-- Liste vide -->
    <div
      v-else-if="customFields.length === 0"
      class="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg"
    >
      <UIcon name="i-heroicons-adjustments-horizontal" class="mx-auto h-12 w-12 text-gray-400" />
      <h3 class="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
        Aucun champ personnalisé
      </h3>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Commencez par créer un champ personnalisé pour vos tarifs
      </p>
      <div class="mt-6">
        <UButton icon="i-heroicons-plus" color="primary" @click="openCreateModal">
          Ajouter un champ
        </UButton>
      </div>
    </div>

    <!-- Liste des custom fields -->
    <div v-else class="space-y-3">
      <UCard
        v-for="field in customFields"
        :key="field.id"
        :ui="{
          body: { padding: 'p-4 sm:p-5' },
        }"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <!-- En-tête avec nom et icône HelloAsso -->
            <div class="flex items-center gap-2 mb-2">
              <!-- La provenance AVANT le nom : c'est elle qui situe le champ, et la chercher
                   après un intitulé de longueur variable obligeait à balayer la ligne.

                   Par `provider` et non par `helloAssoCustomFieldId` : la colonne d'un seul
                   fournisseur laissait un champ importé d'ailleurs sans logo. Et il y en a
                   toujours un — celui du site quand le champ a été saisi ici. -->
              <img
                :src="logoDuFournisseur(field.provider)"
                :alt="nomDuFournisseur(field.provider) ?? $t('gestion.ticketing.origin_site')"
                :title="infobulleProvenance(field)"
                class="h-5 w-5 object-contain flex-shrink-0"
              />
              <h4 class="text-base font-semibold text-gray-900 dark:text-white truncate">
                {{ field.label }}
              </h4>
              <UBadge v-if="field.isRequired" color="orange" variant="subtle"> Obligatoire </UBadge>
            </div>

            <!-- Type et valeurs -->
            <div class="space-y-2">
              <div class="flex items-center gap-2 text-sm">
                <UIcon name="i-heroicons-tag" class="h-4 w-4 text-gray-400" />
                <span class="text-gray-600 dark:text-gray-400">
                  Type : {{ getTypeLabel(field.type) }}
                </span>
              </div>

              <!-- Choix pour ChoiceList -->
              <div v-if="field.type === 'ChoiceList' && field.values" class="text-sm">
                <div class="flex items-start gap-2">
                  <UIcon name="i-heroicons-list-bullet" class="h-4 w-4 text-gray-400 mt-0.5" />
                  <div class="flex-1">
                    <span class="text-gray-600 dark:text-gray-400">Choix : </span>
                    <div class="flex flex-wrap gap-1 mt-1">
                      <UBadge
                        v-for="(value, idx) in field.values"
                        :key="idx"
                        color="neutral"
                        variant="subtle"
                      >
                        {{ value }}
                      </UBadge>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Tarifs associés -->
              <div v-if="field.tiers && field.tiers.length > 0" class="text-sm">
                <div class="flex items-start gap-2">
                  <UIcon name="i-heroicons-ticket" class="h-4 w-4 text-gray-400 mt-0.5" />
                  <div class="flex-1">
                    <span class="text-gray-600 dark:text-gray-400">Tarifs : </span>
                    <div class="flex flex-wrap gap-1 mt-1">
                      <UBadge
                        v-for="tier in field.tiers"
                        :key="tier.tier.id"
                        color="primary"
                        variant="subtle"
                      >
                        {{ tier.tier.name }}
                      </UBadge>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Quotas associés -->
              <div v-if="field.quotas && field.quotas.length > 0" class="text-sm">
                <div class="flex items-start gap-2">
                  <UIcon name="i-heroicons-chart-bar" class="h-4 w-4 text-gray-400 mt-0.5" />
                  <div class="flex-1">
                    <span class="text-gray-600 dark:text-gray-400">Quotas : </span>
                    <div class="flex flex-wrap gap-1 mt-1">
                      <UBadge
                        v-for="quota in field.quotas"
                        :key="`${quota.quota.id}-${quota.choiceValue || 'all'}`"
                        color="warning"
                        variant="subtle"
                      >
                        {{ quota.quota.title }}
                        <span v-if="quota.choiceValue"> ({{ quota.choiceValue }})</span>
                      </UBadge>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Articles à remettre -->
              <div v-if="field.handoutItems && field.handoutItems.length > 0" class="text-sm">
                <div class="flex items-start gap-2">
                  <UIcon name="i-heroicons-gift" class="h-4 w-4 text-gray-400 mt-0.5" />
                  <div class="flex-1">
                    <span class="text-gray-600 dark:text-gray-400">Articles à remettre : </span>
                    <div class="flex flex-wrap gap-1 mt-1">
                      <UBadge
                        v-for="item in field.handoutItems"
                        :key="`${item.handoutItem.id}-${item.choiceValue || 'all'}`"
                        color="info"
                        variant="subtle"
                      >
                        {{ item.handoutItem.name
                        }}{{ item.quantity > 1 ? ` ×${item.quantity}` : '' }}
                        <span v-if="item.choiceValue"> ({{ item.choiceValue }})</span>
                      </UBadge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2 flex-shrink-0">
            <UButton
              icon="i-heroicons-cog-6-tooth"
              color="neutral"
              variant="ghost"
              size="sm"
              title="Gérer les associations"
              @click="openAssociationsModal(field)"
            />
            <UButton
              v-if="!field.helloAssoCustomFieldId"
              icon="i-heroicons-pencil"
              color="neutral"
              variant="ghost"
              size="sm"
              title="Modifier le champ"
              @click="openEditModal(field)"
            />
            <UButton
              v-if="!field.helloAssoCustomFieldId"
              icon="i-heroicons-trash"
              color="error"
              variant="ghost"
              size="sm"
              title="Supprimer le champ"
              @click="confirmDelete(field)"
            />
          </div>
        </div>
      </UCard>
    </div>

    <!-- Modal de création/édition -->
    <TicketingCustomFieldModal
      v-model:open="isModalOpen"
      :custom-field="selectedCustomField"
      :edition-id="editionId"
      @refresh="$emit('refresh')"
    />

    <!-- Modal de gestion des associations -->
    <TicketingCustomFieldAssociationsModal
      v-model:open="isAssociationsModalOpen"
      :custom-field="selectedCustomFieldForAssociations"
      :edition-id="editionId"
      @refresh="$emit('refresh')"
    />

    <!-- Modal de confirmation de suppression -->
    <UiConfirmModal
      v-model="showDeleteModal"
      title="Supprimer le champ personnalisé"
      :description="`Êtes-vous sûr de vouloir supprimer le champ &quot;${customFieldToDelete?.label}&quot; ? Cette action est irréversible.`"
      confirm-label="Supprimer"
      confirm-color="error"
      confirm-icon="i-heroicons-trash"
      icon-name="i-heroicons-exclamation-triangle"
      icon-color="text-red-500"
      :loading="deleting"
      @confirm="deleteCustomField"
      @cancel="showDeleteModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { logoDuFournisseur, nomDuFournisseur } from '../../utils/ticketing/fournisseur'

const { t } = useI18n()

interface CustomField {
  id: number
  label: string
  type: string
  isRequired: boolean
  values?: string[]
  helloAssoCustomFieldId?: number | null
  /** Le fournisseur d'où vient ce champ, `null` s'il a été saisi sur le site. */
  provider?: string | null
  tiers?: Array<{
    tier: {
      id: number
      name: string
    }
  }>
  quotas?: Array<{
    quota: {
      id: number
      title: string
    }
    choiceValue?: string | null
  }>
  handoutItems?: Array<{
    handoutItem: {
      id: number
      name: string
    }
    choiceValue?: string | null
  }>
}

const props = defineProps<{
  customFields: CustomField[]
  loading: boolean
  editionId: number
}>()

const emit = defineEmits<{
  refresh: []
}>()

const isModalOpen = ref(false)
const selectedCustomField = ref<CustomField | null>(null)
const isAssociationsModalOpen = ref(false)
const selectedCustomFieldForAssociations = ref<CustomField | null>(null)
const showDeleteModal = ref(false)
const customFieldToDelete = ref<CustomField | null>(null)

const getTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    TextInput: 'Texte court',
    YesNo: 'Oui/Non',
    ChoiceList: 'Liste de choix',
    FreeText: 'Texte long',
  }
  return labels[type] || type
}

const openCreateModal = () => {
  selectedCustomField.value = null
  isModalOpen.value = true
}

const openEditModal = (field: CustomField) => {
  selectedCustomField.value = field
  isModalOpen.value = true
}

const openAssociationsModal = (field: CustomField) => {
  selectedCustomFieldForAssociations.value = field
  isAssociationsModalOpen.value = true
}

const confirmDelete = (field: CustomField) => {
  customFieldToDelete.value = field
  showDeleteModal.value = true
}

const { execute: executeDeleteCustomField, loading: deleting } = useApiAction(
  () => `/api/editions/${props.editionId}/ticketing/custom-fields/${customFieldToDelete.value?.id}`,
  {
    method: 'DELETE',
    successMessage: {
      title: 'Champ supprimé',
      description: 'Le champ personnalisé a été supprimé avec succès',
    },
    errorMessages: { default: 'Impossible de supprimer le champ personnalisé' },
    onSuccess: () => {
      showDeleteModal.value = false
      customFieldToDelete.value = null
      emit('refresh')
    },
  }
)

const deleteCustomField = () => {
  if (!customFieldToDelete.value) return
  executeDeleteCustomField()
}

/**
 * L'infobulle du logo de provenance.
 *
 * Reprend l'identifiant chez le fournisseur, que portait l'ancien logo — celui qui suivait le nom
 * et n'affichait que HelloAsso. L'information est rare mais utile quand on recoupe avec la
 * billetterie externe : elle change de place, elle ne disparaît pas.
 */
const infobulleProvenance = (field: CustomField) => {
  const fournisseur = nomDuFournisseur(field.provider)
  if (!fournisseur) return t('gestion.ticketing.origin_site')
  return field.helloAssoCustomFieldId
    ? `${fournisseur} (ID : ${field.helloAssoCustomFieldId})`
    : fournisseur
}
</script>
