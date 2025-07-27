<template>
  <div>
    <div class="flex items-center gap-4 mb-6">
      <div class="relative">
        <img 
          v-if="authStore.user?.email"
          :src="currentAvatar" 
          :alt="`Avatar de ${authStore.user.pseudo || authStore.user.prenom}`"
          class="w-20 h-20 rounded-full border-4 border-primary-200 shadow-lg object-cover"
        >
        <UButton 
          icon="i-heroicons-camera" 
          size="xs" 
          color="primary" 
          variant="solid"
          class="absolute -bottom-1 -right-1 rounded-full"
          @click="showProfilePictureModal = true"
        />
      </div>
      <div>
        <h1 class="text-3xl font-bold">Bonjour, {{ authStore.user?.prenom || authStore.user?.pseudo }} !</h1>
        <p class="text-gray-600 text-sm mt-1">
          Membre depuis {{ new Date(authStore.user?.createdAt || Date.now()).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' }) }}
        </p>
        <p class="text-gray-500 text-xs mt-1">
          {{ authStore.user?.profilePicture ? 'Photo de profil personnalisée' : 'Avatar fourni par Gravatar' }}
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
            <UInput v-model="state.email" type="email" required placeholder="votre.email@example.com" size="lg" />
          </UFormField>
          
          <UFormField label="Pseudo" name="pseudo" hint="Visible publiquement sur vos conventions">
            <UInput v-model="state.pseudo" required placeholder="Votre pseudo unique" size="lg" />
          </UFormField>
          
          <UFormField label="Nom" name="nom">
            <UInput v-model="state.nom" required placeholder="Votre nom de famille" size="lg" />
          </UFormField>
          
          <UFormField label="Prénom" name="prenom">
            <UInput v-model="state.prenom" required placeholder="Votre prénom" size="lg" />
          </UFormField>
          
          <div class="flex justify-between">
            <UButton 
              type="submit" 
              :loading="loading"
              :disabled="!hasChanges"
              icon="i-heroicons-check"
              color="primary"
            >
              Sauvegarder
            </UButton>
            
            <UButton 
              v-if="hasChanges"
              type="button"
              variant="ghost"
              color="neutral"
              @click="resetForm"
            >
              Annuler les modifications
            </UButton>
          </div>
        </UForm>
      </UCard>

      <!-- Statistiques -->
      <div class="space-y-6">
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-chart-bar" class="text-blue-500" />
              <h3 class="text-lg font-semibold">Mes statistiques</h3>
            </div>
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
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-bolt" class="text-green-500" />
              <h3 class="text-lg font-semibold">Actions rapides</h3>
            </div>
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
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-shield-check" class="text-red-500" />
              <h3 class="text-lg font-semibold">Sécurité</h3>
            </div>
          </template>

          
          <!-- Modal pour changement de mot de passe -->
          <UModal v-model="showPasswordModal" title="Changer le mot de passe" size="md" close-icon="i-heroicons-x-mark">
            
            <UButton 
              icon="i-heroicons-key" 
              variant="outline" 
              color="neutral" 
              block
              @click="showPasswordModal = true"
            >
              Changer le mot de passe
            </UButton>

            <template #body>
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
            </template>
            
          </UModal>
        
        </UCard>
      </div>
    </div>

    <!-- Modal pour photo de profil -->
    <UModal v-model:open="showProfilePictureModal" title="Photo de profil" size="md">
      <template #body>
        <div class="space-y-6">
          <!-- Aperçu actuel -->
          <div class="flex justify-center">
            <img 
              :src="currentAvatar" 
              :alt="'Avatar actuel'"
              class="w-32 h-32 rounded-full border-4 border-gray-200 object-cover"
            >
          </div>

          <!-- Actions -->
          <div class="space-y-3">
            <UButton 
              icon="i-heroicons-arrow-up-tray" 
              variant="outline" 
              color="primary" 
              block
              :loading="pictureLoading"
              @click="triggerFileInput"
            >
              Changer la photo
            </UButton>
            
            <UButton 
              v-if="authStore.user?.profilePicture"
              icon="i-heroicons-trash" 
              variant="outline" 
              color="error" 
              block
              :loading="pictureLoading"
              @click="deleteProfilePicture"
            >
              Supprimer la photo
            </UButton>
            
            <input 
              ref="fileInput"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleFileUpload"
            >
          </div>

          <div class="text-xs text-gray-500 text-center">
            <p>Formats acceptés : JPG, PNG, GIF, WebP</p>
            <p>Taille maximale : 5MB</p>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue';
import { z } from 'zod';
import { useAuthStore } from '~/stores/auth';
import { useConventionStore } from '~/stores/conventions';
import { useAvatar } from '~/utils/avatar';

// Protéger cette page avec le middleware d'authentification
definePageMeta({
  middleware: 'auth-client'
});

const authStore = useAuthStore();
const conventionStore = useConventionStore();
const toast = useToast();
const { getUserAvatar } = useAvatar();

const loading = ref(false);
const passwordLoading = ref(false);
const pictureLoading = ref(false);
const showPasswordModal = ref(false);
const showProfilePictureModal = ref(false);
const fileInput = ref<HTMLInputElement>();
const avatarKey = ref(Date.now()); // Pour forcer le rechargement de l'avatar

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

// Avatar avec cache-busting
const currentAvatar = computed(() => {
  if (!authStore.user) return '';
  const baseUrl = getUserAvatar(authStore.user, 120);
  return `${baseUrl}&refresh=${avatarKey.value}`;
});

// Détection des changements
const hasChanges = computed(() => {
  return state.email !== (authStore.user?.email || '') ||
         state.pseudo !== (authStore.user?.pseudo || '') ||
         state.nom !== (authStore.user?.nom || '') ||
         state.prenom !== (authStore.user?.prenom || '');
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
  if (!hasChanges.value) return;
  
  loading.value = true;
  try {
    const updatedUser = await $fetch('/api/profile/update', {
      method: 'PUT',
      body: {
        email: state.email,
        pseudo: state.pseudo,
        nom: state.nom,
        prenom: state.prenom,
      },
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
      },
    });
    
    // Mettre à jour les données utilisateur dans le store
    authStore.updateUser(updatedUser);
    
    toast.add({ 
      title: 'Profil mis à jour', 
      description: 'Vos informations ont été sauvegardées',
      icon: 'i-heroicons-check-circle', 
      color: 'success' 
    });
  } catch (error: any) {
    toast.add({ 
      title: 'Erreur', 
      description: error.data?.message || 'Impossible de sauvegarder le profil',
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
    await $fetch('/api/profile/change-password', {
      method: 'POST',
      body: {
        currentPassword: passwordState.currentPassword,
        newPassword: passwordState.newPassword,
      },
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
      },
    });
    
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
  } catch (error: any) {
    toast.add({ 
      title: 'Erreur', 
      description: error.data?.message || 'Impossible de changer le mot de passe',
      icon: 'i-heroicons-x-circle', 
      color: 'error' 
    });
  } finally {
    passwordLoading.value = false;
  }
};

const triggerFileInput = () => {
  fileInput.value?.click();
};

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  
  if (!file) return;
  
  pictureLoading.value = true;
  try {
    const formData = new FormData();
    formData.append('profilePicture', file);
    
    const response = await $fetch('/api/profile/upload-picture', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
      },
    });
    
    // Mettre à jour les données utilisateur
    if (response.user) {
      authStore.updateUser(response.user);
    }
    
    // Forcer le rechargement de l'avatar
    avatarKey.value++;
    
    showProfilePictureModal.value = false;
    
    toast.add({ 
      title: 'Photo mise à jour', 
      description: 'Votre photo de profil a été changée',
      icon: 'i-heroicons-check-circle', 
      color: 'success' 
    });
  } catch (error: any) {
    toast.add({ 
      title: 'Erreur', 
      description: error.data?.message || 'Impossible de changer la photo',
      icon: 'i-heroicons-x-circle', 
      color: 'error' 
    });
  } finally {
    pictureLoading.value = false;
    // Reset file input
    if (target) target.value = '';
  }
};

const deleteProfilePicture = async () => {
  pictureLoading.value = true;
  try {
    const response = await $fetch('/api/profile/delete-picture', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
      },
    });
    
    // Mettre à jour les données utilisateur
    if (response.user) {
      authStore.updateUser(response.user);
    }
    
    // Forcer le rechargement de l'avatar
    avatarKey.value++;
    
    showProfilePictureModal.value = false;
    
    toast.add({ 
      title: 'Photo supprimée', 
      description: 'Votre photo de profil a été supprimée',
      icon: 'i-heroicons-check-circle', 
      color: 'success' 
    });
  } catch (error: any) {
    toast.add({ 
      title: 'Erreur', 
      description: error.data?.message || 'Impossible de supprimer la photo',
      icon: 'i-heroicons-x-circle', 
      color: 'error' 
    });
  } finally {
    pictureLoading.value = false;
  }
};

onMounted(async () => {
  await conventionStore.fetchConventions();
});
</script>