<template>
  <div>
    <div class="flex items-center gap-4 mb-6">
      <img 
        v-if="authStore.user?.email"
        :src="getUserAvatar(authStore.user.email, 80)" 
        :alt="`Avatar de ${authStore.user.pseudo || authStore.user.prenom}`"
        class="w-20 h-20 rounded-full border-4 border-primary-200"
      />
      <div>
        <h1 class="text-3xl font-bold">Mon Profil</h1>
        <p class="text-gray-600 text-sm mt-1">
          Avatar fourni par <a href="https://gravatar.com" target="_blank" class="text-primary-600 hover:underline">Gravatar</a>
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Informations utilisateur -->
      <UCard class="lg:col-span-2">
        <template #header>
          <h2 class="text-xl font-semibold">Informations personnelles</h2>
        </template>
        
        <UForm :state="state" :schema="schema" class="space-y-4" @submit="updateProfile">
          <UFormField label="Adresse e-mail" name="email">
            <UInput v-model="state.email" type="email" required placeholder="votre.email@example.com" />
          </UFormField>
          
          <UFormField label="Pseudo" name="pseudo">
            <UInput v-model="state.pseudo" required placeholder="Votre pseudo unique" />
          </UFormField>
          
          <UFormField label="Nom" name="nom">
            <UInput v-model="state.nom" required placeholder="Votre nom de famille" />
          </UFormField>
          
          <UFormField label="Prénom" name="prenom">
            <UInput v-model="state.prenom" required placeholder="Votre prénom" />
          </UFormField>
          
          <div class="flex justify-between">
            <UButton 
              type="submit" 
              :loading="loading"
              icon="i-heroicons-check"
              color="primary"
            >
              Sauvegarder
            </UButton>
            
            <UButton 
              type="button"
              variant="ghost"
              color="neutral"
              @click="resetForm"
            >
              Annuler
            </UButton>
          </div>
        </UForm>
      </UCard>

      <!-- Statistiques -->
      <div class="space-y-6">
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">Mes statistiques</h3>
          </template>
          
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-calendar-days" class="text-blue-500" />
                <span class="text-sm">Conventions créées</span>
              </div>
              <UBadge color="primary" variant="subtle">{{ myConventionsCount }}</UBadge>
            </div>
            
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-star" class="text-yellow-500" />
                <span class="text-sm">Favoris</span>
              </div>
              <UBadge color="warning" variant="subtle">{{ favoritesCount }}</UBadge>
            </div>
            
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-heart" class="text-red-500" />
                <span class="text-sm">Total favoris reçus</span>
              </div>
              <UBadge color="error" variant="subtle">{{ totalFavoritesReceived }}</UBadge>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">Actions rapides</h3>
          </template>
          
          <div class="space-y-3">
            <UButton 
              icon="i-heroicons-plus" 
              variant="outline" 
              color="primary" 
              block
              to="/conventions/add"
            >
              Créer une convention
            </UButton>
            
            <UButton 
              icon="i-heroicons-calendar-days" 
              variant="outline" 
              color="info" 
              block
              to="/my-conventions"
            >
              Mes conventions
            </UButton>
            
            <UButton 
              icon="i-heroicons-star" 
              variant="outline" 
              color="warning" 
              block
              to="/favorites"
            >
              Mes favoris
            </UButton>
          </div>
        </UCard>

        <!-- Changement de mot de passe -->
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">Sécurité</h3>
          </template>
          
          <UButton 
            icon="i-heroicons-key" 
            variant="outline" 
            color="neutral" 
            block
            @click="showPasswordModal = true"
          >
            Changer le mot de passe
          </UButton>
        </UCard>
      </div>
    </div>

    <!-- Modal pour changement de mot de passe -->
    <UModal v-model="showPasswordModal">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Changer le mot de passe</h3>
        </template>
        
        <UForm :state="passwordState" :schema="passwordSchema" class="space-y-4" @submit="changePassword">
          <UFormField label="Mot de passe actuel" name="currentPassword">
            <UInput v-model="passwordState.currentPassword" type="password" required />
          </UFormField>
          
          <UFormField label="Nouveau mot de passe" name="newPassword">
            <UInput v-model="passwordState.newPassword" type="password" required />
          </UFormField>
          
          <UFormField label="Confirmer le nouveau mot de passe" name="confirmPassword">
            <UInput v-model="passwordState.confirmPassword" type="password" required />
          </UFormField>
          
          <div class="flex justify-end space-x-2">
            <UButton 
              type="button" 
              variant="ghost" 
              @click="showPasswordModal = false"
            >
              Annuler
            </UButton>
            <UButton 
              type="submit" 
              :loading="passwordLoading"
              color="primary"
            >
              Changer
            </UButton>
          </div>
        </UForm>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue';
import { z } from 'zod';
import { useAuthStore } from '~/stores/auth';
import { useConventionStore } from '~/stores/conventions';
import { useGravatar } from '~/utils/gravatar';

// Protéger cette page avec le middleware d'authentification
definePageMeta({
  middleware: 'auth-client'
});

const authStore = useAuthStore();
const conventionStore = useConventionStore();
const toast = useToast();
const { getUserAvatar } = useGravatar();

const loading = ref(false);
const passwordLoading = ref(false);
const showPasswordModal = ref(false);

// Schéma de validation pour le profil
const schema = z.object({
  email: z.string().email('Email invalide'),
  pseudo: z.string().min(3, 'Le pseudo doit contenir au moins 3 caractères'),
  nom: z.string().min(1, 'Le nom est requis'),
  prenom: z.string().min(1, 'Le prénom est requis'),
});

// Schéma pour le changement de mot de passe
const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword: z.string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .regex(/(?=.*[A-Z])/, 'Le mot de passe doit contenir au moins une majuscule')
    .regex(/(?=.*\d)/, 'Le mot de passe doit contenir au moins un chiffre'),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

// État du formulaire principal
const state = reactive({
  email: authStore.user?.email || '',
  pseudo: authStore.user?.pseudo || '',
  nom: authStore.user?.nom || '',
  prenom: authStore.user?.prenom || '',
});

// État du formulaire de mot de passe
const passwordState = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});

// Statistiques calculées
const myConventionsCount = computed(() => {
  return conventionStore.conventions.filter(
    convention => convention.creatorId === authStore.user?.id
  ).length;
});

const favoritesCount = computed(() => {
  return conventionStore.conventions.filter(
    convention => convention.favoritedBy.some(user => user.id === authStore.user?.id)
  ).length;
});

const totalFavoritesReceived = computed(() => {
  return conventionStore.conventions
    .filter(convention => convention.creatorId === authStore.user?.id)
    .reduce((total, convention) => total + convention.favoritedBy.length, 0);
});

const resetForm = () => {
  state.email = authStore.user?.email || '';
  state.pseudo = authStore.user?.pseudo || '';
  state.nom = authStore.user?.nom || '';
  state.prenom = authStore.user?.prenom || '';
};

const updateProfile = async () => {
  loading.value = true;
  try {
    // TODO: Créer une API pour mettre à jour le profil
    toast.add({ 
      title: 'Profil mis à jour', 
      description: 'Vos informations ont été sauvegardées',
      icon: 'i-heroicons-check-circle', 
      color: 'success' 
    });
  } catch (error) {
    toast.add({ 
      title: 'Erreur', 
      description: 'Impossible de sauvegarder le profil',
      icon: 'i-heroicons-x-circle', 
      color: 'error' 
    });
  } finally {
    loading.value = false;
  }
};

const changePassword = async () => {
  passwordLoading.value = true;
  try {
    // TODO: Créer une API pour changer le mot de passe
    showPasswordModal.value = false;
    passwordState.currentPassword = '';
    passwordState.newPassword = '';
    passwordState.confirmPassword = '';
    
    toast.add({ 
      title: 'Mot de passe changé', 
      description: 'Votre mot de passe a été mis à jour',
      icon: 'i-heroicons-check-circle', 
      color: 'success' 
    });
  } catch (error) {
    toast.add({ 
      title: 'Erreur', 
      description: 'Impossible de changer le mot de passe',
      icon: 'i-heroicons-x-circle', 
      color: 'error' 
    });
  } finally {
    passwordLoading.value = false;
  }
};

onMounted(async () => {
  await conventionStore.fetchConventions();
});
</script>