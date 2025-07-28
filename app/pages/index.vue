<template>
  <div class="flex gap-6">
    <!-- Panneau de filtres à gauche -->
    <div class="w-80 flex-shrink-0 hidden lg:block">
      <UCard class="sticky top-4">
        <template #header>
          <div class="flex items-center gap-2">
            <h2 class="text-xl font-semibold">Filtres</h2>
            <UBadge v-if="activeFiltersCount > 0" :color="'primary'" variant="solid" size="xs">
              {{ activeFiltersCount }}
            </UBadge>
          </div>
        </template>
        
        <div class="space-y-6">
          <div class="space-y-6">

            <!-- Bouton réinitialiser les filtres -->
            <UButton icon="i-heroicons-arrow-path" type="button" color="neutral" variant="ghost" block @click="resetFilters">
              Réinitialiser
            </UButton>

            <!-- Filtres de recherche -->
            <div class="space-y-4">
              <UFormField label="Nom de la convention" name="name">
                <UInput v-model="filters.name" placeholder="Rechercher par nom" />
              </UFormField>
              <UFormField label="Pays" name="countries">
                <CountryMultiSelect v-model="filters.countries" placeholder="Sélectionner des pays..." />
              </UFormField>
            </div>
            
            <!-- Filtres de dates -->
            <div class="space-y-4">
              <h4 class="font-medium text-gray-700">Dates :</h4>
              <UFormField label="Date de début (min)" name="startDate">
                <UInput v-model="filters.startDate" type="date" />
              </UFormField>
              <UFormField label="Date de fin (max)" name="endDate">
                <UInput v-model="filters.endDate" type="date" />
              </UFormField>
            </div>
            
            <!-- Filtres services -->
            <div class="space-y-4">
              <h4 class="font-medium text-gray-700">Services recherchés :</h4>
              <div class="space-y-6">
                <div v-for="category in servicesByCategory" :key="category.category" class="space-y-3">
                  <h5 class="text-sm font-medium text-gray-600">{{ category.label }}</h5>
                  <div class="space-y-2">
                    <UCheckbox 
                      v-for="service in category.services" 
                      :key="service.key"
                      v-model="filters[service.key]" 
                      :name="service.key"
                    >
                      <template #label>
                        <div class="flex items-center gap-2">
                          <UIcon :name="service.icon" :class="service.color" size="16" />
                          <span>{{ service.label }}</span>
                        </div>
                      </template>
                    </UCheckbox>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Contenu principal à droite -->
    <div class="flex-1 min-w-0">
      <!-- En-tête avec titre et boutons -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 class="text-3xl font-bold">Conventions de Jonglerie</h1>
        <div class="flex items-center gap-3">
          <!-- Bouton filtres sur mobile -->
          <UButton 
            v-if="!showMobileFilters" 
            icon="i-heroicons-funnel" 
            size="md" 
            color="neutral" 
            variant="outline" 
            label="Filtres"
            class="lg:hidden"
            @click="showMobileFilters = true"
          />
        </div>
      </div>

      <!-- Filtres mobiles en overlay -->
      <UModal v-model:open="showMobileFilters" variant="subtle" size="lg" @close="closeMobileFilters">
        <template #header>
          <div class="flex items-center gap-2">
            <h2 class="text-xl font-semibold">Filtres</h2>
            <UBadge v-if="activeFiltersCount > 0" :color="'primary'" variant="solid" size="xs">
              {{ activeFiltersCount }}
            </UBadge>
          </div>
        </template>

        <template #body>
          <!-- Boutons de réinitialisation et fermeture -->
          <div class="flex items-center gap-2 mb-4">
            <UButton icon="i-heroicons-arrow-path" type="button" color="neutral" variant="ghost" block @click="resetFilters">
              Réinitialiser
            </UButton>
            <UButton icon="i-heroicons-x-mark" type="button" color="neutral" variant="ghost" block @click="closeMobileFilters" class="ml-auto">
              Fermer
            </UButton>
          </div>

          <div class="space-y-6">
            <div class="space-y-6">
              <!-- Filtres de recherche -->
              <div class="space-y-4">
                <UFormField label="Nom de la convention" name="name">
                  <UInput v-model="filters.name" placeholder="Rechercher par nom" />
                </UFormField>
                <UFormField label="Pays" name="countries">
                  <CountryMultiSelect v-model="filters.countries" placeholder="Sélectionner des pays..." />
                </UFormField>
              </div>
              
              <!-- Filtres de dates -->
              <div class="space-y-4">
                <h4 class="font-medium text-gray-700">Dates :</h4>
                <UFormField label="Date de début (min)" name="startDate">
                  <UInput v-model="filters.startDate" type="date" />
                </UFormField>
                <UFormField label="Date de fin (max)" name="endDate">
                  <UInput v-model="filters.endDate" type="date" />
                </UFormField>
              </div>
              
              <!-- Filtres services -->
              <div class="space-y-4">
                <h4 class="font-medium text-gray-700">Services recherchés :</h4>
                <div class="space-y-4">
                  <div v-for="category in servicesByCategory" :key="category.category" class="space-y-2">
                    <h5 class="text-sm font-medium text-gray-600">{{ category.label }}</h5>
                    <div class="grid grid-cols-2 gap-2">
                      <UCheckbox 
                        v-for="service in category.services" 
                        :key="service.key"
                        v-model="filters[service.key]" 
                        :name="service.key"
                      >
                        <template #label>
                          <div class="flex items-center gap-2">
                            <UIcon :name="service.icon" :class="service.color" size="16" />
                            <span class="text-sm">{{ service.label }}</span>
                          </div>
                        </template>
                      </UCheckbox>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </UModal>

      <div v-if="editionStore.loading">
        <p>Chargement des conventions...</p>
      </div>

      <div v-else-if="editionStore.error">
        <p class="text-red-500">Erreur: {{ editionStore.error }}</p>
      </div>

      <div v-else-if="editionStore.editions.length === 0">
        <p>Aucune convention trouvée. Soyez le premier à en ajouter une !</p>
      </div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <UCard v-for="edition in editionStore.editions" :key="edition.id" variant="subtle">
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div v-if="edition.convention?.logo" class="flex-shrink-0">
                  <img :src="normalizeImageUrl(edition.convention.logo)" :alt="edition.convention.name" class="w-16 h-16 object-cover rounded-lg" />
                </div>
                <div v-else class="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                  <UIcon name="i-heroicons-building-library" class="text-gray-400" size="24" />
                </div>
                <h2 class="text-xl font-semibold">{{ getEditionDisplayName(edition) }}</h2>
              </div>
              <UButton
                v-if="authStore.isAuthenticated"
                :icon="isFavorited(edition.id) ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
                :color="isFavorited(edition.id) ? 'warning' : 'neutral'"
                variant="ghost"
                size="sm"
                @click="toggleFavorite(edition.id)"
              />
            </div>
          </template>
          
          <p class="text-sm text-gray-500">Du: {{ new Date(edition.startDate).toLocaleDateString() }} au {{ new Date(edition.endDate).toLocaleDateString() }}</p>
          <p class="text-sm text-gray-500 flex items-center gap-1">
            <UIcon name="i-heroicons-map-pin" class="text-gray-400" size="16" />
            {{ edition.city }}, {{ edition.country }}
          </p>
          <p class="text-sm text-gray-500">Créé par: {{ edition.creator?.pseudo || 'Utilisateur inconnu' }}</p>
          
          <!-- Services avec pictos -->
          <div class="flex flex-wrap gap-1 mt-2">
            <UIcon 
              v-for="activeService in getActiveServices(edition)" 
              :key="activeService.key"
              :name="activeService.icon" 
              :class="activeService.color" 
              size="20" 
              :title="activeService.label" 
            />
          </div>
          <template #footer>
            <div class="flex justify-end">
              <NuxtLink :to="`/editions/${edition.id}`">
                <UButton icon="i-heroicons-eye" size="sm" color="info" variant="solid" label="Voir" />
              </NuxtLink>
            </div>
          </template>
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, reactive, watch } from 'vue';
import { useEditionStore } from '~/stores/editions';
import { useAuthStore } from '~/stores/auth';
import { useRouter } from 'vue-router';
import CountryMultiSelect from '~/components/CountryMultiSelect.vue';
import { getEditionDisplayName } from '~/utils/editionName';

const editionStore = useEditionStore();
const authStore = useAuthStore();
const toast = useToast();
const router = useRouter();

const showMobileFilters = ref(false);
const { services, servicesByCategory, getActiveServices } = useConventionServices();
const { normalizeImageUrl } = useImageUrl();


// Compteur de filtres actifs
const activeFiltersCount = computed(() => {
  let count = 0;
  if (filters.name) count++;
  if (filters.startDate) count++;
  if (filters.endDate) count++;
  if (filters.countries.length > 0) count++;
  // Compter les services actifs
  count += services.filter(service => filters[service.key]).length;
  return count;
});

const filters = reactive({
  name: '',
  startDate: '',
  endDate: '',
  countries: [] as string[],
  // Initialiser tous les services à false
  ...Object.fromEntries(services.map(service => [service.key, false])),
});

// Watcher pour appliquer automatiquement les filtres
watch(filters, () => {
  editionStore.fetchEditions(filters);
}, { deep: true, immediate: false });

const resetFilters = () => {
  filters.name = '';
  filters.startDate = '';
  filters.endDate = '';
  filters.countries = [];
  // Réinitialiser tous les services
  services.forEach(service => {
    filters[service.key] = false;
  });
  editionStore.fetchEditions(); // Fetch all conventions again
};

onMounted(() => {
  editionStore.fetchEditions();
});

const isFavorited = computed(() => (editionId: number) => {
  return editionStore.editions.find(c => c.id === editionId)?.favoritedBy.some(u => u.id === authStore.user?.id);
});

const toggleFavorite = async (id: number) => {
  try {
    await editionStore.toggleFavorite(id);
    toast.add({ title: 'Statut de favori mis à jour !', icon: 'i-heroicons-check-circle', color: 'success' });
  } catch (e: unknown) {
    toast.add({ title: e.statusMessage || 'Échec de la mise à jour du statut de favori', icon: 'i-heroicons-x-circle', color: 'error' });
  }
};

const closeMobileFilters = () => {
  showMobileFilters.value = false;
};
</script>