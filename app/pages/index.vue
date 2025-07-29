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
              <UFormField label="À partir du" name="startDate">
                <UPopover :popper="{ placement: 'bottom-start' }">
                  <UButton 
                    color="neutral" 
                    variant="outline" 
                    icon="i-heroicons-calendar-days"
                    :label="filters.startDate ? formatDateForDisplay(filters.startDate) : 'Sélectionner une date'"
                    block
                  />
                  <template #content>
                    <UCalendar 
                      v-model="calendarStartDate" 
                      class="p-2"
                      @update:model-value="updateStartDate"
                    />
                  </template>
                </UPopover>
              </UFormField>
              <UFormField label="Jusqu'au" name="endDate">
                <UPopover :popper="{ placement: 'bottom-start' }">
                  <UButton 
                    color="neutral" 
                    variant="outline" 
                    icon="i-heroicons-calendar-days"
                    :label="filters.endDate ? formatDateForDisplay(filters.endDate) : 'Sélectionner une date'"
                    block
                  />
                  <template #content>
                    <UCalendar 
                      v-model="calendarEndDate" 
                      class="p-2"
                      :is-date-disabled="(date) => calendarStartDate && date < calendarStartDate"
                      @update:model-value="updateEndDate"
                    />
                  </template>
                </UPopover>
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
      <!-- En-tête avec boutons -->
      <div class="flex justify-end items-center gap-3 mb-6">
          <!-- Sélecteur de vue -->
          <div class="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            <UButton
              :color="viewMode === 'grid' ? 'primary' : 'gray'"
              :variant="viewMode === 'grid' ? 'solid' : 'ghost'"
              icon="i-heroicons-squares-2x2"
              size="sm"
              @click="viewMode = 'grid'"
            >
              Grille
            </UButton>
            <UButton
              :color="viewMode === 'map' ? 'primary' : 'gray'"
              :variant="viewMode === 'map' ? 'solid' : 'ghost'"
              icon="i-heroicons-map"
              size="sm"
              @click="viewMode = 'map'"
            >
              Carte
            </UButton>
          </div>
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
            <UButton icon="i-heroicons-x-mark" type="button" color="neutral" variant="ghost" block class="ml-auto" @click="closeMobileFilters">
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
                <UFormField label="À partir du" name="startDate">
                  <UPopover :popper="{ placement: 'bottom-start' }">
                    <UButton 
                      color="neutral" 
                      variant="outline" 
                      icon="i-heroicons-calendar-days"
                      :label="filters.startDate ? formatDateForDisplay(filters.startDate) : 'Sélectionner une date'"
                      block
                    />
                    <template #content>
                      <UCalendar 
                        v-model="calendarStartDate" 
                        class="p-2"
                        @update:model-value="updateStartDate"
                      />
                    </template>
                  </UPopover>
                </UFormField>
                <UFormField label="Jusqu'au" name="endDate">
                  <UPopover :popper="{ placement: 'bottom-start' }">
                    <UButton 
                      color="neutral" 
                      variant="outline" 
                      icon="i-heroicons-calendar-days"
                      :label="filters.endDate ? formatDateForDisplay(filters.endDate) : 'Sélectionner une date'"
                      block
                    />
                    <template #content>
                      <UCalendar 
                        v-model="calendarEndDate" 
                        class="p-2"
                        :is-date-disabled="(date) => calendarStartDate && date < calendarStartDate"
                        @update:model-value="updateEndDate"
                      />
                    </template>
                  </UPopover>
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
        <div class="text-center py-8">
          <UIcon name="i-heroicons-magnifying-glass" class="text-gray-400 text-4xl mb-4" />
          <p v-if="activeFiltersCount > 0" class="text-gray-600">
            Aucune convention ne correspond à vos critères de recherche.
          </p>
          <p v-else class="text-gray-600">
            Aucune convention trouvée. Soyez le premier à en ajouter une !
          </p>
          <UButton 
            v-if="activeFiltersCount > 0" 
            color="neutral" 
            variant="outline" 
            icon="i-heroicons-arrow-path" 
            class="mt-4"
            @click="resetFilters"
          >
            Réinitialiser les filtres
          </UButton>
        </div>
      </div>

      <div v-else>
        <!-- Vue en grille -->
        <div v-if="viewMode === 'grid'" class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          <EditionCard 
            v-for="edition in editionStore.editions" 
            :key="edition.id" 
            :edition="edition"
          >
            <template #actions="{ edition }">
              <UButton
                v-if="authStore.isAuthenticated"
                :icon="isFavorited(edition.id) ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
                :color="isFavorited(edition.id) ? 'warning' : 'neutral'"
                variant="ghost"
                size="sm"
                @click="toggleFavorite(edition.id)"
              />
            </template>
          </EditionCard>
        </div>

        <!-- Vue carte -->
        <div v-else-if="viewMode === 'map'">
          <HomeMap :editions="editionsWithCoordinates" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, reactive, watch, ref } from 'vue';
import { useEditionStore } from '~/stores/editions';
import { useAuthStore } from '~/stores/auth';
import { useRouter } from 'vue-router';
import { CalendarDate, DateFormatter, getLocalTimeZone } from '@internationalized/date';
import CountryMultiSelect from '~/components/CountryMultiSelect.vue';

const editionStore = useEditionStore();
const authStore = useAuthStore();
const toast = useToast();
const router = useRouter();

const showMobileFilters = ref(false);
const { services, servicesByCategory } = useConventionServices();
const viewMode = ref<'grid' | 'map'>('grid');

// Date formatter pour l'affichage
const df = new DateFormatter('fr-FR', { dateStyle: 'medium' });

// CalendarDate objects pour les sélecteurs de date
const calendarStartDate = ref<CalendarDate | null>(null);
const calendarEndDate = ref<CalendarDate | null>(null);

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

// Fonctions pour gérer les dates
const formatDateForDisplay = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return df.format(date);
};

const updateStartDate = (date: CalendarDate | null) => {
  if (date) {
    // Convertir CalendarDate en string ISO
    filters.startDate = date.toString();
  } else {
    filters.startDate = '';
  }
};

const updateEndDate = (date: CalendarDate | null) => {
  if (date) {
    // Convertir CalendarDate en string ISO
    filters.endDate = date.toString();
  } else {
    filters.endDate = '';
  }
};

// Initialiser les CalendarDate quand les filtres changent
watch(() => filters.startDate, (newValue) => {
  if (newValue) {
    const [year, month, day] = newValue.split('-').map(Number);
    calendarStartDate.value = new CalendarDate(year, month, day);
  } else {
    calendarStartDate.value = null;
  }
});

watch(() => filters.endDate, (newValue) => {
  if (newValue) {
    const [year, month, day] = newValue.split('-').map(Number);
    calendarEndDate.value = new CalendarDate(year, month, day);
  } else {
    calendarEndDate.value = null;
  }
});

const resetFilters = () => {
  filters.name = '';
  filters.startDate = '';
  filters.endDate = '';
  filters.countries = [];
  calendarStartDate.value = null;
  calendarEndDate.value = null;
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

// Éditions avec coordonnées pour la carte
const editionsWithCoordinates = computed(() => {
  return editionStore.editions.filter(edition => 
    edition.latitude !== null && edition.longitude !== null
  );
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