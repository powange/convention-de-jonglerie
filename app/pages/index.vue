<template>
  <div>
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-3xl font-bold">Conventions de Jonglerie</h1>
      <UButton v-if="authStore.isAuthenticated" icon="i-heroicons-plus" size="md" color="primary" variant="solid" label="Ajouter une Convention" @click="navigateToAddConvention" />
    </div>

    <UCard class="mb-4">
      <UCollapsible v-model:open="showFilters">
        <template #default="{ open, toggle }">
          <div class="flex justify-between items-center p-4 cursor-pointer" @click="toggle">
            <div class="flex items-center gap-2">
              <h2 class="text-xl font-semibold">Filtrer les Conventions</h2>
              <UBadge v-if="activeFiltersCount > 0" :color="'primary'" variant="solid" size="xs">
                {{ activeFiltersCount }}
              </UBadge>
            </div>
            <UIcon 
              :name="open ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" 
              class="transition-transform duration-200"
            />
          </div>
        </template>
        <template #content>
          <div class="p-4 pt-0">
            <UForm :state="filters" class="space-y-4" @submit="applyFilters">
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <!-- Filtres texte et dates -->
                <div class="space-y-4">
                  <UFormField label="Nom de la convention" name="name">
                    <UInput v-model="filters.name" placeholder="Rechercher par nom" />
                  </UFormField>
                  <UFormField label="Pays" name="countries">
                    <CountryMultiSelect v-model="filters.countries" placeholder="Sélectionner des pays..." />
                  </UFormField>
                </div>
                
                <div class="space-y-4">
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
                  <div class="space-y-2">
                    <UCheckbox v-model="filters.hasFastfood" name="hasFastfood">
                      <template #label>
                        <div class="flex items-center gap-2">
                          <UIcon name="i-heroicons-building-storefront" class="text-orange-500" size="16" />
                          <span>Restauration</span>
                        </div>
                      </template>
                    </UCheckbox>
                    
                    <UCheckbox v-model="filters.hasKidsZone" name="hasKidsZone">
                      <template #label>
                        <div class="flex items-center gap-2">
                          <UIcon name="i-heroicons-face-smile" class="text-pink-500" size="16" />
                          <span>Zone enfants</span>
                        </div>
                      </template>
                    </UCheckbox>
                    
                    <UCheckbox v-model="filters.acceptsPets" name="acceptsPets">
                      <template #label>
                        <div class="flex items-center gap-2">
                          <UIcon name="i-heroicons-heart" class="text-red-500" size="16" />
                          <span>Animaux acceptés</span>
                        </div>
                      </template>
                    </UCheckbox>
                    
                    <UCheckbox v-model="filters.hasTentCamping" name="hasTentCamping">
                      <template #label>
                        <div class="flex items-center gap-2">
                          <UIcon name="i-heroicons-home" class="text-green-500" size="16" />
                          <span>Camping tente</span>
                        </div>
                      </template>
                    </UCheckbox>
                    
                    <UCheckbox v-model="filters.hasTruckCamping" name="hasTruckCamping">
                      <template #label>
                        <div class="flex items-center gap-2">
                          <UIcon name="i-heroicons-truck" class="text-blue-500" size="16" />
                          <span>Camping camion</span>
                        </div>
                      </template>
                    </UCheckbox>
                    
                    <UCheckbox v-model="filters.hasGym" name="hasGym">
                      <template #label>
                        <div class="flex items-center gap-2">
                          <UIcon name="i-heroicons-trophy" class="text-purple-500" size="16" />
                          <span>Salle de sport</span>
                        </div>
                      </template>
                    </UCheckbox>
                  </div>
                </div>
              </div>
              
              <div class="flex gap-2 pt-4 border-t">
                <UButton icon="i-heroicons-magnifying-glass" type="submit" color="primary">
                  Appliquer les filtres
                </UButton>
                <UButton icon="i-heroicons-arrow-path" type="button" color="neutral" variant="ghost" @click="resetFilters">
                  Réinitialiser
                </UButton>
              </div>
            </UForm>
          </div>
        </template>
      </UCollapsible>
    </UCard>

    <div v-if="conventionStore.loading">
      <p>Chargement des conventions...</p>
    </div>
    <div v-else-if="conventionStore.error">
      <p class="text-red-500">Erreur: {{ conventionStore.error }}</p>
    </div>
    <div v-else-if="conventionStore.conventions.length === 0">
      <p>Aucune convention trouvée. Soyez le premier à en ajouter une !</p>
    </div>
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <UCard v-for="convention in conventionStore.conventions" :key="convention.id">
        <template #header>
          <div class="flex items-center gap-3">
            <div v-if="convention.imageUrl" class="flex-shrink-0">
              <img :src="convention.imageUrl" :alt="convention.name" class="w-16 h-16 object-cover rounded-lg" />
            </div>
            <div v-else class="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
              <UIcon name="i-heroicons-photo" class="text-gray-400" size="24" />
            </div>
            <h2 class="text-xl font-semibold">{{ convention.name }}</h2>
          </div>
        </template>
        <p class="text-sm text-gray-500">Du: {{ new Date(convention.startDate).toLocaleDateString() }} au {{ new Date(convention.endDate).toLocaleDateString() }}</p>
        <p class="text-sm text-gray-500 flex items-center gap-1">
          <UIcon name="i-heroicons-map-pin" class="text-gray-400" size="16" />
          {{ convention.city }}, {{ convention.country }}
        </p>
        <p class="text-sm text-gray-500">Créé par: {{ convention.creator.pseudo }}</p>
        
        <!-- Services avec pictos -->
        <div class="flex flex-wrap gap-1 mt-2">
          <UIcon v-if="convention.hasFastfood" name="i-heroicons-building-storefront" class="text-orange-500" size="20" title="Restauration" />
          <UIcon v-if="convention.hasKidsZone" name="i-heroicons-face-smile" class="text-pink-500" size="20" title="Zone enfants" />
          <UIcon v-if="convention.acceptsPets" name="i-heroicons-heart" class="text-red-500" size="20" title="Animaux acceptés" />
          <UIcon v-if="convention.hasTentCamping" name="i-heroicons-home" class="text-green-500" size="20" title="Camping tente" />
          <UIcon v-if="convention.hasTruckCamping" name="i-heroicons-truck" class="text-blue-500" size="20" title="Camping camion" />
          <UIcon v-if="convention.hasGym" name="i-heroicons-trophy" class="text-purple-500" size="20" title="Salle de sport" />
        </div>
        <template #footer>
          <div class="flex justify-end space-x-2">
            <UButton
              v-if="authStore.isAuthenticated"
              :icon="isFavorited(convention.id) ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
              :color="isFavorited(convention.id) ? 'warning' : 'neutral'"
              variant="ghost"
              @click="toggleFavorite(convention.id)"
            />
            <NuxtLink :to="`/conventions/${convention.id}`">
              <UButton icon="i-heroicons-eye" size="sm" color="info" variant="solid" label="Voir" />
            </NuxtLink>
            <UButton
              v-if="authStore.user?.id === convention.creatorId"
              icon="i-heroicons-pencil"
              size="sm"
              color="success"
              variant="solid"
              label="Modifier"
              @click="editConvention(convention.id)"
            />
            <UButton
              v-if="authStore.user?.id === convention.creatorId"
              icon="i-heroicons-trash"
              size="sm"
              color="error"
              variant="solid"
              label="Supprimer"
              @click="deleteConvention(convention.id)"
            />
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, reactive } from 'vue';
import { useConventionStore } from '~/stores/conventions';
import { useAuthStore } from '~/stores/auth';
import { useRouter } from 'vue-router';
import CountryMultiSelect from '~/components/CountryMultiSelect.vue';

const conventionStore = useConventionStore();
const authStore = useAuthStore();
const toast = useToast();
const router = useRouter();

const showFilters = ref(false);

// Compteur de filtres actifs
const activeFiltersCount = computed(() => {
  let count = 0;
  if (filters.name) count++;
  if (filters.startDate) count++;
  if (filters.endDate) count++;
  if (filters.countries.length > 0) count++;
  if (filters.hasFastfood) count++;
  if (filters.hasKidsZone) count++;
  if (filters.acceptsPets) count++;
  if (filters.hasTentCamping) count++;
  if (filters.hasTruckCamping) count++;
  if (filters.hasGym) count++;
  return count;
});

const filters = reactive({
  name: '',
  startDate: '',
  endDate: '',
  countries: [] as string[],
  hasFastfood: false,
  hasKidsZone: false,
  acceptsPets: false,
  hasTentCamping: false,
  hasTruckCamping: false,
  hasGym: false,
});

const applyFilters = () => {
  conventionStore.fetchConventions(filters);
};

const resetFilters = () => {
  filters.name = '';
  filters.startDate = '';
  filters.endDate = '';
  filters.countries = [];
  filters.hasFastfood = false;
  filters.hasKidsZone = false;
  filters.acceptsPets = false;
  filters.hasTentCamping = false;
  filters.hasTruckCamping = false;
  filters.hasGym = false;
  conventionStore.fetchConventions(); // Fetch all conventions again
};

onMounted(() => {
  conventionStore.fetchConventions();
});

const isFavorited = computed(() => (conventionId: number) => {
  return conventionStore.conventions.find(c => c.id === conventionId)?.favoritedBy.some(u => u.id === authStore.user?.id);
});

const toggleFavorite = async (id: number) => {
  try {
    await conventionStore.toggleFavorite(id);
    toast.add({ title: 'Statut de favori mis à jour !', icon: 'i-heroicons-check-circle', color: 'success' });
  } catch (e: unknown) {
    toast.add({ title: e.statusMessage || 'Échec de la mise à jour du statut de favori', icon: 'i-heroicons-x-circle', color: 'error' });
  }
};

const editConvention = (id: number) => {
  router.push(`/conventions/${id}/edit`);
};

const deleteConvention = async (id: number) => {
  if (confirm('Êtes-vous sûr de vouloir supprimer cette convention ?')) {
    try {
      await conventionStore.deleteConvention(id);
      toast.add({ title: 'Convention supprimée avec succès !', icon: 'i-heroicons-check-circle', color: 'success' });
    } catch (e: unknown) {
      toast.add({ title: e.statusMessage || 'Échec de la suppression de la convention', icon: 'i-heroicons-x-circle', color: 'error' });
    }
  }
};

const navigateToAddConvention = () => {
  router.push('/conventions/add');
};
</script>