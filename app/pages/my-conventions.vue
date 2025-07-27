<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold">Mes Conventions</h1>
      <UButton 
        icon="i-heroicons-plus" 
        size="md" 
        color="primary" 
        variant="solid" 
        label="Créer une Convention" 
        to="/conventions/add"
      />
    </div>

    <div v-if="loading" class="text-center py-8">
      <p>Chargement de vos conventions...</p>
    </div>

    <div v-else-if="myConventions.length === 0" class="text-center py-12">
      <UIcon name="i-heroicons-calendar-days" class="mx-auto h-12 w-12 text-gray-400 mb-4" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">Aucune convention créée</h3>
      <p class="text-gray-500 mb-4">Vous n'avez pas encore créé de convention.</p>
      <UButton 
        icon="i-heroicons-plus" 
        color="primary" 
        variant="solid" 
        label="Créer ma première convention"
        to="/conventions/add"
      />
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <UCard v-for="convention in myConventions" :key="convention.id">
        <template #header>
          <div class="flex items-center gap-3">
            <div v-if="convention.imageUrl" class="flex-shrink-0">
              <img :src="convention.imageUrl" :alt="convention.name" class="w-16 h-16 object-cover rounded-lg" />
            </div>
            <div v-else class="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
              <UIcon name="i-heroicons-photo" class="text-gray-400" size="24" />
            </div>
            <div class="flex-1">
              <h2 class="text-xl font-semibold">{{ convention.name }}</h2>
              <UBadge :color="getStatusColor(convention)" variant="subtle" class="mt-1">
                {{ getStatusText(convention) }}
              </UBadge>
            </div>
          </div>
        </template>
        
        <p class="text-sm text-gray-500 mb-2">Du: {{ new Date(convention.startDate).toLocaleDateString() }} au {{ new Date(convention.endDate).toLocaleDateString() }}</p>
        <p class="text-sm text-gray-500 flex items-center gap-1 mb-2">
          <UIcon name="i-heroicons-map-pin" class="text-gray-400" size="16" />
          {{ convention.city }}, {{ convention.country }}
        </p>
        <p class="text-sm text-gray-500 flex items-center gap-1">
          <UIcon name="i-heroicons-star" class="text-gray-400" size="16" />
          {{ convention.favoritedBy.length }} favoris
        </p>

        <template #footer>
          <div class="flex justify-end space-x-2">
            <UButton
              icon="i-heroicons-eye"
              size="sm"
              color="info"
              variant="solid"
              label="Voir"
              :to="`/conventions/${convention.id}`"
            />
            <UButton
              v-if="conventionStore.canEditConvention(convention, authStore.user?.id || 0)"
              icon="i-heroicons-pencil"
              size="sm"
              color="yellow"
              variant="solid"
              label="Modifier"
              :to="`/conventions/${convention.id}/edit`"
            />
            <UButton
              v-if="conventionStore.canDeleteConvention(convention, authStore.user?.id || 0)"
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
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '~/stores/auth';
import { useConventionStore } from '~/stores/conventions';

// Protéger cette page avec le middleware d'authentification
definePageMeta({
  middleware: 'auth-client'
});

const authStore = useAuthStore();
const conventionStore = useConventionStore();
const toast = useToast();

const loading = ref(true);

// Calculer les conventions de l'utilisateur
const myConventions = computed(() => {
  return conventionStore.conventions.filter(
    convention => convention.creatorId === authStore.user?.id
  );
});

// Déterminer le statut d'une convention
const getStatusColor = (convention: any) => {
  const now = new Date();
  const startDate = new Date(convention.startDate);
  const endDate = new Date(convention.endDate);
  
  if (now < startDate) return 'info';  // À venir
  if (now > endDate) return 'neutral';  // Passée
  return 'success';  // En cours
};

const getStatusText = (convention: any) => {
  const now = new Date();
  const startDate = new Date(convention.startDate);
  const endDate = new Date(convention.endDate);
  
  if (now < startDate) return 'À venir';
  if (now > endDate) return 'Terminée';
  return 'En cours';
};

const deleteConvention = async (id: number) => {
  if (confirm('Êtes-vous sûr de vouloir supprimer cette convention ?')) {
    try {
      await conventionStore.deleteConvention(id);
      toast.add({ 
        title: 'Convention supprimée avec succès !', 
        icon: 'i-heroicons-check-circle', 
        color: 'success' 
      });
    } catch (e: any) {
      toast.add({ 
        title: 'Erreur lors de la suppression', 
        description: e.statusMessage || 'Une erreur est survenue',
        icon: 'i-heroicons-x-circle', 
        color: 'error' 
      });
    }
  }
};

onMounted(async () => {
  try {
    await conventionStore.fetchConventions();
  } catch (error) {
    toast.add({ 
      title: 'Erreur', 
      description: 'Impossible de charger les conventions',
      icon: 'i-heroicons-exclamation-triangle', 
      color: 'error' 
    });
  } finally {
    loading.value = false;
  }
});
</script>