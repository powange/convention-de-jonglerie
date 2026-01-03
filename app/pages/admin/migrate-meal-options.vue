<template>
  <div>
    <!-- Breadcrumb -->
    <nav class="flex mb-4" aria-label="Breadcrumb">
      <ol class="inline-flex items-center space-x-1 md:space-x-3">
        <li class="inline-flex items-center">
          <NuxtLink
            to="/admin"
            class="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white"
          >
            <UIcon name="i-heroicons-squares-2x2" class="w-4 h-4 mr-2" />
            Administration
          </NuxtLink>
        </li>
        <li>
          <div class="flex items-center">
            <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-400" />
            <span class="ml-1 text-sm font-medium text-gray-500 md:ml-2 dark:text-gray-400">
              Migration des options de repas
            </span>
          </div>
        </li>
      </ol>
    </nav>

    <!-- En-tête -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold flex items-center gap-3">
        <UIcon name="i-heroicons-arrow-path" class="text-teal-600" />
        Migration des options de repas
      </h1>
      <p class="text-gray-600 dark:text-gray-400 mt-2">
        Migrer les options depuis customFields vers la structure de base de données appropriée
      </p>
    </div>

    <!-- Contenu principal -->
    <div class="space-y-6">
      <!-- Avertissement -->
      <UAlert
        icon="i-heroicons-exclamation-triangle"
        color="warning"
        variant="soft"
        title="Attention"
        description="Cette migration va créer les entrées manquantes dans TicketingOrderItemOption et TicketingOrderItemMeal. Les données existantes ne seront pas modifiées."
      />

      <!-- Sélection de l'édition -->
      <UFormField
        label="Édition"
        :help="
          editionId
            ? `Migration limitée à l'édition ${editionId}`
            : 'Migration pour toutes les éditions'
        "
      >
        <USelect
          v-model="editionId"
          :items="editionOptions"
          placeholder="Toutes les éditions"
          :loading="loadingEditions"
        />
      </UFormField>

      <!-- Bouton de migration -->
      <div class="flex gap-3">
        <UButton
          icon="i-heroicons-play"
          color="primary"
          size="lg"
          :loading="migrating"
          :disabled="migrating"
          @click="startMigration"
        >
          Lancer la migration
        </UButton>

        <UButton
          v-if="result"
          icon="i-heroicons-arrow-path"
          color="neutral"
          variant="soft"
          size="lg"
          @click="reset"
        >
          Réinitialiser
        </UButton>
      </div>

      <!-- Résultats -->
      <div v-if="result" class="space-y-4">
        <div class="border-t pt-4">
          <h2 class="text-lg font-semibold mb-3">Résultats de la migration</h2>

          <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
            <UCard>
              <div class="text-center">
                <div class="text-3xl font-bold text-green-600">
                  {{ result.optionsMigrated }}
                </div>
                <div class="text-sm text-gray-600 mt-1">Options migrées</div>
              </div>
            </UCard>

            <UCard>
              <div class="text-center">
                <div class="text-3xl font-bold text-blue-600">
                  {{ result.mealAccessCreated }}
                </div>
                <div class="text-sm text-gray-600 mt-1">Accès repas créés</div>
              </div>
            </UCard>

            <UCard>
              <div class="text-center">
                <div class="text-3xl font-bold text-gray-600">
                  {{ result.skipped }}
                </div>
                <div class="text-sm text-gray-600 mt-1">Ignorés</div>
              </div>
            </UCard>

            <UCard>
              <div class="text-center">
                <div class="text-3xl font-bold text-purple-600">
                  {{ result.totalOrderItems }}
                </div>
                <div class="text-sm text-gray-600 mt-1">OrderItems traités</div>
              </div>
            </UCard>

            <UCard v-if="result.errors > 0">
              <div class="text-center">
                <div class="text-3xl font-bold text-red-600">
                  {{ result.errors }}
                </div>
                <div class="text-sm text-gray-600 mt-1">Erreurs</div>
              </div>
            </UCard>
          </div>

          <UAlert
            v-if="result.errors > 0"
            icon="i-heroicons-exclamation-circle"
            color="error"
            variant="soft"
            title="Erreurs détectées"
            description="Consultez les logs Docker pour plus de détails : npm run docker:dev:logs"
            class="mt-4"
          />

          <UAlert
            v-else
            icon="i-heroicons-check-circle"
            color="success"
            variant="soft"
            title="Migration réussie !"
            description="Toutes les options ont été migrées avec succès."
            class="mt-4"
          />
        </div>
      </div>

      <!-- Logs en temps réel (optionnel) -->
      <div v-if="logs.length > 0" class="space-y-2">
        <h3 class="text-sm font-semibold text-gray-700">Logs de migration :</h3>
        <div
          class="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-xs max-h-96 overflow-y-auto"
        >
          <div v-for="(log, index) in logs" :key="index">
            {{ log }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['auth-protected', 'super-admin'],
})

const toast = useToast()

const editionId = ref<number | null>(null)
const loadingEditions = ref(false)
const editionOptions = ref<Array<{ label: string; value: number | null }>>([
  { label: 'Toutes les éditions', value: null },
])

const migrating = ref(false)
const result = ref<any>(null)
const logs = ref<string[]>([])

// Charger les éditions disponibles
onMounted(async () => {
  loadingEditions.value = true
  try {
    const data = await $fetch('/api/editions', {
      query: {
        limit: 1000, // Récupérer toutes les éditions
        showPast: true,
        showCurrent: true,
        showFuture: true,
      },
    })
    if (data?.data) {
      editionOptions.value = [
        { label: 'Toutes les éditions', value: null },
        ...data.data.map((edition: any) => ({
          label: `${edition.name} (ID: ${edition.id})`,
          value: edition.id,
        })),
      ]
    }
  } catch (error) {
    console.error('Erreur lors du chargement des éditions:', error)
  } finally {
    loadingEditions.value = false
  }
})

const startMigration = async () => {
  migrating.value = true
  result.value = null
  logs.value = []

  try {
    const { data, error } = await useFetch('/api/admin/migrate-meal-options', {
      method: 'POST',
      body: {
        editionId: editionId.value,
      },
    })

    if (error.value) {
      throw new Error(error.value.message || 'Erreur lors de la migration')
    }

    result.value = data.value

    toast.add({
      title: 'Migration terminée',
      description: `${data.value?.optionsMigrated || 0} options migrées avec succès`,
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (error: any) {
    console.error('Erreur lors de la migration:', error)
    toast.add({
      title: 'Erreur',
      description: error.message || 'Impossible de lancer la migration',
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    migrating.value = false
  }
}

const reset = () => {
  result.value = null
  logs.value = []
}
</script>
