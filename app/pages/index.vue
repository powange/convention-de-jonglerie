<template>
  <div class="flex gap-6">
    <!-- Panneau de filtres à gauche -->
    <div class="w-80 flex-shrink-0 hidden lg:block">
      <UCard class="sticky top-4">
        <template #header>
          <div class="flex items-center gap-2">
            <h2 class="text-xl font-semibold">{{ $t('homepage.filters') }}</h2>
            <UBadge v-if="activeFiltersCount > 0" :color="'primary'" variant="solid" size="xs">
              {{ activeFiltersCount }}
            </UBadge>
          </div>
        </template>
        
        <div class="space-y-6">
          <div class="space-y-6">

            <!-- Bouton réinitialiser les filtres -->
            <UButton icon="i-heroicons-arrow-path" type="button" color="neutral" variant="ghost" block @click="resetFilters">
              {{ $t('homepage.reset_filters') }}
            </UButton>

            <!-- Filtres de recherche -->
            <div class="space-y-4">
              <UFormField :label="$t('forms.labels.convention_name')" name="name">
                <UInput v-model="filters.name" :placeholder="$t('forms.placeholders.search_by_name')" />
              </UFormField>
              <UFormField :label="$t('common.country')" name="countries">
                <CountryMultiSelect v-model="filters.countries" :placeholder="$t('forms.placeholders.select_countries')" />
              </UFormField>
            </div>
            
            <!-- Filtres de dates -->
            <div class="space-y-4">
              <h4 class="font-medium text-gray-700">{{ $t('common.dates') }} :</h4>
              <UFormField :label="$t('forms.labels.from_date')" name="startDate">
                <UPopover :popper="{ placement: 'bottom-start' }">
                  <UButton 
                    color="neutral" 
                    variant="outline" 
                    icon="i-heroicons-calendar-days"
                    :label="filters.startDate ? formatDateForDisplay(filters.startDate) : $t('forms.labels.select_date')"
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
              <UFormField :label="$t('forms.labels.until_date')" name="endDate">
                <UPopover :popper="{ placement: 'bottom-start' }">
                  <UButton 
                    color="neutral" 
                    variant="outline" 
                    icon="i-heroicons-calendar-days"
                    :label="filters.endDate ? formatDateForDisplay(filters.endDate) : $t('forms.labels.select_date')"
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
            
            <!-- Filtre temporel -->
            <div class="space-y-4">
              <h4 class="font-medium text-gray-700">{{ $t('homepage.period') }} :</h4>
              <div class="space-y-3">
                <UCheckbox v-model="filters.showPast" name="showPast">
                  <template #label>
                    <div class="flex items-center gap-2">
                      <span class="text-base">✅</span>
                      <span>{{ $t('homepage.finished_editions') }}</span>
                    </div>
                  </template>
                </UCheckbox>
                <UCheckbox v-model="filters.showCurrent" name="showCurrent">
                  <template #label>
                    <div class="flex items-center gap-2">
                      <span class="text-base">🔥</span>
                      <span>{{ $t('homepage.current_editions') }}</span>
                    </div>
                  </template>
                </UCheckbox>
                <UCheckbox v-model="filters.showFuture" name="showFuture">
                  <template #label>
                    <div class="flex items-center gap-2">
                      <span class="text-base">🔄</span>
                      <span>{{ $t('homepage.upcoming_editions') }}</span>
                    </div>
                  </template>
                </UCheckbox>
              </div>
            </div>
            
            <!-- Filtres services -->
            <div class="space-y-4">
              <h4 class="font-medium text-gray-700">{{ $t('homepage.searched_services') }} :</h4>
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
              :color="viewMode === 'grid' ? 'primary' : 'neutral'"
              :variant="viewMode === 'grid' ? 'solid' : 'ghost'"
              icon="i-heroicons-squares-2x2"
              size="sm"
              @click="viewMode = 'grid'"
            >
              {{ $t('homepage.grid') }}
            </UButton>
            <UButton
              :color="viewMode === 'map' ? 'primary' : 'neutral'"
              :variant="viewMode === 'map' ? 'solid' : 'ghost'"
              icon="i-heroicons-map"
              size="sm"
              @click="viewMode = 'map'"
            >
              {{ $t('homepage.map') }}
            </UButton>
          </div>
          <!-- Bouton filtres sur mobile -->
          <UButton 
            v-if="!showMobileFilters" 
            icon="i-heroicons-funnel" 
            size="md" 
            color="neutral" 
            variant="outline" 
            :label="$t('homepage.filters')"
            class="lg:hidden"
            @click="showMobileFilters = true"
          />
      </div>

      <!-- Filtres mobiles en overlay -->
      <UModal v-model:open="showMobileFilters" variant="subtle" size="lg" @close="closeMobileFilters">
        <template #header>
          <div class="flex items-center gap-2">
            <h2 class="text-xl font-semibold">{{ $t('homepage.filters') }}</h2>
            <UBadge v-if="activeFiltersCount > 0" :color="'primary'" variant="solid" size="xs">
              {{ activeFiltersCount }}
            </UBadge>
          </div>
        </template>

        <template #body>
          <!-- Boutons de réinitialisation et fermeture -->
          <div class="flex items-center gap-2 mb-4">
            <UButton icon="i-heroicons-arrow-path" type="button" color="neutral" variant="ghost" block @click="resetFilters">
              {{ $t('homepage.reset_filters') }}
            </UButton>
            <UButton icon="i-heroicons-x-mark" type="button" color="neutral" variant="ghost" block class="ml-auto" @click="closeMobileFilters">
              {{ $t('common.close') }}
            </UButton>
          </div>

          <div class="space-y-6">
            <div class="space-y-6">
              <!-- Filtres de recherche -->
              <div class="space-y-4">
                <UFormField label="Nom de la convention" name="name">
                  <UInput v-model="filters.name" placeholder="Rechercher par nom" />
                </UFormField>
                <UFormField :label="$t('common.country')" name="countries">
                  <CountryMultiSelect v-model="filters.countries" :placeholder="$t('forms.placeholders.select_countries')" />
                </UFormField>
              </div>
              
              <!-- Filtres de dates -->
              <div class="space-y-4">
                <h4 class="font-medium text-gray-700">{{ $t('common.dates') }} :</h4>
                <UFormField :label="$t('forms.labels.from_date')" name="startDate">
                  <UPopover :popper="{ placement: 'bottom-start' }">
                    <UButton 
                      color="neutral" 
                      variant="outline" 
                      icon="i-heroicons-calendar-days"
                      :label="filters.startDate ? formatDateForDisplay(filters.startDate) : $t('forms.labels.select_date')"
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
                <UFormField :label="$t('forms.labels.until_date')" name="endDate">
                  <UPopover :popper="{ placement: 'bottom-start' }">
                    <UButton 
                      color="neutral" 
                      variant="outline" 
                      icon="i-heroicons-calendar-days"
                      :label="filters.endDate ? formatDateForDisplay(filters.endDate) : $t('forms.labels.select_date')"
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
              
              <!-- Filtre temporel -->
              <div class="space-y-4">
                <h4 class="font-medium text-gray-700">{{ $t('homepage.period') }} :</h4>
                <div class="space-y-3">
                  <UCheckbox v-model="filters.showPast" name="showPast">
                    <template #label>
                      <div class="flex items-center gap-2">
                        <span class="text-base">✅</span>
                        <span>{{ $t('homepage.finished_editions') }}</span>
                      </div>
                    </template>
                  </UCheckbox>
                  <UCheckbox v-model="filters.showCurrent" name="showCurrent">
                    <template #label>
                      <div class="flex items-center gap-2">
                        <span class="text-base">🔥</span>
                        <span>{{ $t('homepage.current_editions') }}</span>
                      </div>
                    </template>
                  </UCheckbox>
                  <UCheckbox v-model="filters.showFuture" name="showFuture">
                    <template #label>
                      <div class="flex items-center gap-2">
                        <span class="text-base">🔄</span>
                        <span>{{ $t('homepage.upcoming_editions') }}</span>
                      </div>
                    </template>
                  </UCheckbox>
                </div>
              </div>
              
              <!-- Filtres services -->
              <div class="space-y-4">
                <h4 class="font-medium text-gray-700">{{ $t('homepage.searched_services') }} :</h4>
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
        <p>{{ $t('common.loading') }}...</p>
      </div>

      <div v-else-if="editionStore.error">
        <p class="text-red-500">{{ $t('common.error') }}: {{ editionStore.error }}</p>
      </div>

      <div v-else-if="editionStore.editions.length === 0">
        <div class="text-center py-8">
          <UIcon name="i-heroicons-magnifying-glass" class="text-gray-400 text-4xl mb-4" />
          <p v-if="activeFiltersCount > 0" class="text-gray-600">
            {{ $t('homepage.no_conventions_match_criteria') }}
          </p>
          <p v-else class="text-gray-600">
            {{ $t('homepage.no_conventions_found') }}
          </p>
          <UButton 
            v-if="activeFiltersCount > 0" 
            color="neutral" 
            variant="outline" 
            icon="i-heroicons-arrow-path" 
            class="mt-4"
            @click="resetFilters"
          >
            {{ $t('homepage.reset_filters') }}
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
            :show-status="true"
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
import { onMounted, computed, reactive, watch, ref, defineAsyncComponent } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { useEditionStore } from '~/stores/editions';
import { useAuthStore } from '~/stores/auth';
import { useRouter } from 'vue-router';
import { CalendarDate, DateFormatter, getLocalTimeZone } from '@internationalized/date';
import { useTranslatedConventionServices } from '~/composables/useConventionServices';
import CountryMultiSelect from '~/components/CountryMultiSelect.vue';

// Lazy loading du composant HomeMap
const HomeMap = defineAsyncComponent(() => import('~/components/HomeMap.vue'));

const editionStore = useEditionStore();
const authStore = useAuthStore();
const toast = useToast();
const router = useRouter();
const { t, locale } = useI18n();

const showMobileFilters = ref(false);
const { getTranslatedServices, getTranslatedServicesByCategory } = useTranslatedConventionServices();
const services = getTranslatedServices;
const servicesByCategory = getTranslatedServicesByCategory;
const viewMode = ref<'grid' | 'map'>('grid');

// Date formatter pour l'affichage
const df = computed(() => {
  const localeCode = locale.value === 'fr' ? 'fr-FR' : 'en-US';
  return new DateFormatter(localeCode, { dateStyle: 'medium' });
});

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
  // Compter le filtre temporel si pas tous cochés (par défaut showPast=false, showCurrent=true, showFuture=true)
  if (!(filters.showPast === false && filters.showCurrent === true && filters.showFuture === true)) count++;
  // Compter les services actifs
  count += services.value.filter(service => filters[service.key]).length;
  return count;
});

const filters = reactive({
  name: '',
  startDate: '',
  endDate: '',
  countries: [] as string[],
  // Filtre temporel - par défaut : en cours et à venir cochés
  showPast: false,
  showCurrent: true,
  showFuture: true,
  // Initialiser tous les services à false
  ...Object.fromEntries(services.value.map(service => [service.key, false])),
});

// Créer une fonction debounced pour éviter les appels API trop fréquents
// Délai de 300ms pour tous les changements de filtres pour éviter la surcharge
const debouncedFetchEditions = useDebounceFn((newFilters) => {
  editionStore.fetchEditions(newFilters);
}, 300);

// Variable pour tracker le dernier nom recherché
let lastNameFilter = '';

// Watcher pour appliquer automatiquement les filtres
watch(filters, (newFilters) => {
  // Si c'est uniquement le champ name qui a changé, utiliser le debounce
  // Sinon (checkbox, dates, etc.), appliquer immédiatement pour une meilleure réactivité
  const nameChanged = filters.name !== lastNameFilter;
  lastNameFilter = filters.name;
  
  if (nameChanged && filters.name !== '') {
    // Debounce pour le champ de recherche texte
    debouncedFetchEditions(newFilters);
  } else {
    // Application immédiate pour les autres filtres (checkbox, dates, pays)
    editionStore.fetchEditions(newFilters);
  }
}, { deep: true, immediate: false });

// Fonctions pour gérer les dates
const formatDateForDisplay = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return df.value.format(date);
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
  // Réinitialiser les filtres temporels aux valeurs par défaut
  filters.showPast = false;
  filters.showCurrent = true;
  filters.showFuture = true;
  // Réinitialiser tous les services
  services.value.forEach(service => {
    filters[service.key] = false;
  });
  editionStore.fetchEditions(filters); // Fetch all conventions again
};

onMounted(() => {
  editionStore.fetchEditions(filters);
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
    toast.add({ title: t('messages.favorite_status_updated'), icon: 'i-heroicons-check-circle', color: 'success' });
  } catch (e: unknown) {
    toast.add({ title: e.statusMessage || t('errors.favorite_update_failed'), icon: 'i-heroicons-x-circle', color: 'error' });
  }
};

const closeMobileFilters = () => {
  showMobileFilters.value = false;
};
</script>