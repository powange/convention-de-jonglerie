<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- En-tête profil moderne -->
    <div class="bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 rounded-2xl p-6 sm:p-8 mb-8">
      <div class="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <div class="relative group">
          <UserAvatar
            v-if="authStore.user"
            :user="authStore.user"
            size="xl"
            border
            class="w-24 h-24 sm:w-28 sm:h-28 shadow-xl transition-transform group-hover:scale-105"
          />
          <UButton 
            icon="i-heroicons-camera" 
            size="sm" 
            color="primary" 
            variant="solid"
            class="absolute -bottom-2 -right-2 rounded-full shadow-lg transition-all hover:scale-110"
            @click="showProfilePictureModal = true"
          />
        </div>
        <div class="text-center sm:text-left flex-1">
          <h1 class="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Bonjour, {{ authStore.user?.prenom || authStore.user?.pseudo }} ! 👋
          </h1>
          <div class="space-y-2">
            <div class="flex items-center justify-center sm:justify-start gap-2 text-gray-600 dark:text-gray-300">
              <UIcon name="i-heroicons-calendar-days" class="w-4 h-4" />
              <span class="text-sm">
                Membre depuis {{ new Date(authStore.user?.createdAt || Date.now()).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' }) }}
              </span>
            </div>
            <div class="flex items-center justify-center sm:justify-start gap-2 text-gray-500 dark:text-gray-400">
              <UIcon name="i-heroicons-photo" class="w-4 h-4" />
              <span class="text-xs">
                {{ authStore.user?.profilePicture ? 'Photo de profil personnalisée' : 'Avatar fourni par Gravatar' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Informations utilisateur -->
      <UCard class="lg:col-span-2 shadow-lg border-0">
        <template #header>
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
              <UIcon name="i-heroicons-user" class="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Informations personnelles</h2>
              <p class="text-sm text-gray-500 dark:text-gray-400">Gérez vos informations de profil</p>
            </div>
          </div>
        </template>
        
        <UForm :state="state" :schema="schema" class="space-y-6" @submit="updateProfile">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <UFormField label="Prénom" name="prenom" class="md:col-span-1">
              <UInput 
                v-model="state.prenom" 
                icon="i-heroicons-user"
                required 
                placeholder="Votre prénom" 
                size="lg"
                class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]" 
              />
            </UFormField>
            
            <UFormField label="Nom" name="nom" class="md:col-span-1">
              <UInput 
                v-model="state.nom" 
                icon="i-heroicons-user"
                required 
                placeholder="Votre nom de famille" 
                size="lg"
                class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]" 
              />
            </UFormField>
          </div>
          
          <UFormField label="Pseudo" name="pseudo" hint="Visible publiquement par les autres utilisateurs">
            <UInput 
              v-model="state.pseudo" 
              icon="i-heroicons-at-symbol"
              required 
              placeholder="Votre pseudo unique" 
              size="lg"
              class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]" 
            />
          </UFormField>
          
          <UFormField label="Adresse e-mail" name="email">
            <UInput 
              v-model="state.email" 
              type="email" 
              icon="i-heroicons-envelope"
              required 
              placeholder="votre.email@example.com" 
              size="lg"
              class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]" 
            />
          </UFormField>
          
          <!-- Actions avec indicateur de modifications -->
          <div class="border-t border-gray-100 dark:border-gray-700 pt-6">
            <div v-if="hasChanges" class="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div class="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4" />
                <span class="text-sm font-medium">Vous avez des modifications non sauvegardées</span>
              </div>
            </div>
            
            <div class="flex flex-col sm:flex-row gap-3 justify-between">
              <UButton 
                type="submit" 
                :loading="loading"
                :disabled="!hasChanges"
                icon="i-heroicons-check"
                color="primary"
                size="lg"
                class="transition-all duration-200 hover:transform hover:scale-105"
              >
                {{ loading ? 'Sauvegarde...' : 'Sauvegarder les modifications' }}
              </UButton>
              
              <UButton 
                v-if="hasChanges"
                type="button"
                variant="outline"
                color="neutral"
                size="lg"
                icon="i-heroicons-arrow-path"
                @click="resetForm"
                class="transition-all duration-200 hover:transform hover:scale-105"
              >
                Annuler
              </UButton>
            </div>
          </div>
        </UForm>
      </UCard>

      <!-- Statistiques -->
      <div class="space-y-6">
        <UCard class="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900">
          <template #header>
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <UIcon name="i-heroicons-chart-bar" class="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Mes statistiques</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">Votre activité sur la plateforme</p>
              </div>
            </div>
          </template>
          
          <div class="space-y-4">
            <div class="group p-4 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 transition-all duration-200 hover:shadow-md">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 bg-primary-100 dark:bg-primary-800 rounded-lg flex items-center justify-center">
                    <UIcon name="i-heroicons-calendar-days" class="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  </div>
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Conventions créées</span>
                </div>
                <UBadge color="primary" variant="soft" size="lg">{{ myConventionsCount }}</UBadge>
              </div>
            </div>
            
            <div class="group p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 transition-all duration-200 hover:shadow-md">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 bg-yellow-100 dark:bg-yellow-800 rounded-lg flex items-center justify-center">
                    <UIcon name="i-heroicons-star" class="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Favoris</span>
                </div>
                <UBadge color="warning" variant="soft" size="lg">{{ favoritesCount }}</UBadge>
              </div>
            </div>
            
            <div class="group p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 transition-all duration-200 hover:shadow-md">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 bg-red-100 dark:bg-red-800 rounded-lg flex items-center justify-center">
                    <UIcon name="i-heroicons-heart" class="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Favoris reçus</span>
                </div>
                <UBadge color="error" variant="soft" size="lg">{{ totalFavoritesReceived }}</UBadge>
              </div>
            </div>
          </div>
        </UCard>

        <UCard class="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900">
          <template #header>
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <UIcon name="i-heroicons-bolt" class="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Actions rapides</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">Accès direct aux fonctionnalités</p>
              </div>
            </div>
          </template>
          
          <div class="space-y-3">
            <UButton 
              icon="i-heroicons-plus" 
              variant="soft" 
              color="primary" 
              size="lg"
              block
              to="/conventions/add"
              class="transition-all duration-200 hover:transform hover:scale-105 justify-start"
            >
              Créer une convention
            </UButton>
            
            <UButton 
              icon="i-heroicons-calendar-days" 
              variant="soft" 
              color="info" 
              size="lg"
              block
              to="/my-conventions"
              class="transition-all duration-200 hover:transform hover:scale-105 justify-start"
            >
              Mes conventions
            </UButton>
            
            <UButton 
              icon="i-heroicons-star" 
              variant="soft" 
              color="warning" 
              size="lg"
              block
              to="/favorites"
              class="transition-all duration-200 hover:transform hover:scale-105 justify-start"
            >
              Mes favoris
            </UButton>
          </div>
        </UCard>

        <!-- Changement de mot de passe -->
        <UCard class="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900">
          <template #header>
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                <UIcon name="i-heroicons-shield-check" class="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Sécurité</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">Gérez votre mot de passe</p>
              </div>
            </div>
          </template>

          <UButton 
            icon="i-heroicons-key" 
            variant="soft" 
            color="error" 
            size="lg"
            block
            @click="showPasswordModal = true"
            class="transition-all duration-200 hover:transform hover:scale-105 justify-start"
          >
            Changer le mot de passe
          </UButton>
        </UCard>

        <!-- Administration globale -->
        <UCard v-if="authStore.isGlobalAdmin" class="shadow-lg border-0 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20">
          <template #header>
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                <UIcon name="i-heroicons-shield-exclamation" class="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Administration</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">Gestion des privilèges d'administrateur</p>
              </div>
            </div>
          </template>

          <div class="space-y-4">
            <!-- Statut actuel -->
            <div class="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-orange-200 dark:border-orange-800">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 bg-orange-100 dark:bg-orange-800 rounded-lg flex items-center justify-center">
                  <UIcon name="i-heroicons-crown" class="w-4 h-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">Administrateur global</p>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    Mode {{ authStore.isAdminModeActive ? 'Administrateur' : 'Utilisateur normal' }}
                  </p>
                </div>
              </div>
              <UBadge 
                :color="authStore.isAdminModeActive ? 'warning' : 'gray'" 
                variant="soft" 
                size="lg"
              >
                {{ authStore.isAdminModeActive ? '👑 Admin actif' : '👤 Mode normal' }}
              </UBadge>
            </div>

            <!-- Switch toggle -->
            <div class="p-4 bg-white dark:bg-gray-800 rounded-lg border border-orange-200 dark:border-orange-800">
              <div class="flex items-center justify-between">
                <div>
                  <h4 class="font-medium text-gray-900 dark:text-white">Mode administrateur</h4>
                  <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {{ authStore.isAdminModeActive 
                      ? 'Vous avez accès à toutes les fonctionnalités administrateur' 
                      : 'Activez pour accéder aux privilèges d\'administrateur' 
                    }}
                  </p>
                </div>
                <USwitch 
                  v-model="adminModeToggle"
                  color="warning"
                  size="lg"
                  @update:model-value="toggleAdminMode"
                />
              </div>
            </div>

            <!-- Avertissement -->
            <div class="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
              <div class="flex items-start gap-3">
                <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p class="text-sm font-medium text-orange-800 dark:text-orange-200 mb-1">Utilisation responsable</p>
                  <ul class="text-xs text-orange-700 dark:text-orange-300 space-y-1">
                    <li>• En mode admin, vous pouvez modifier toutes les conventions</li>
                    <li>• Utilisez ces privilèges avec précaution</li>
                    <li>• Basculez en mode normal pour tester l'expérience utilisateur</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Modal pour changement de mot de passe -->
    <UModal v-model:open="showPasswordModal" size="md">
      <template #header>
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
            <UIcon name="i-heroicons-key" class="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Changer le mot de passe</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">Saisissez votre mot de passe actuel et le nouveau</p>
          </div>
        </div>
      </template>
      
      <template #body>
        <UForm :state="passwordState" :schema="passwordSchema" class="space-y-6" @submit="changePassword">
          <UFormField label="Mot de passe actuel" name="currentPassword">
            <UInput 
              v-model="passwordState.currentPassword" 
              type="password" 
              icon="i-heroicons-lock-closed"
              required 
              placeholder="Votre mot de passe actuel"
              size="lg"
              class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]"
            />
          </UFormField>
          
          <UFormField label="Nouveau mot de passe" name="newPassword">
            <UInput 
              v-model="passwordState.newPassword" 
              type="password" 
              icon="i-heroicons-key"
              required 
              placeholder="Votre nouveau mot de passe"
              size="lg"
              class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]"
            />
          </UFormField>
          
          <UFormField label="Confirmer le nouveau mot de passe" name="confirmPassword">
            <UInput 
              v-model="passwordState.confirmPassword" 
              type="password" 
              icon="i-heroicons-shield-check"
              required 
              placeholder="Confirmez votre nouveau mot de passe"
              size="lg"
              class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]"
            />
          </UFormField>
          
          <div class="flex flex-col sm:flex-row gap-3 justify-end">
            <UButton 
              type="button"
              variant="outline"
              color="neutral"
              size="lg"
              @click="showPasswordModal = false"
              class="transition-all duration-200 hover:transform hover:scale-105"
            >
              Annuler
            </UButton>
            <UButton 
              type="submit" 
              :loading="passwordLoading"
              color="error"
              size="lg"
              icon="i-heroicons-key"
              class="transition-all duration-200 hover:transform hover:scale-105"
            >
              {{ passwordLoading ? 'Modification...' : 'Changer le mot de passe' }}
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Modal pour photo de profil -->
    <UModal v-model:open="showProfilePictureModal" size="md">
      <template #header>
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
            <UIcon name="i-heroicons-camera" class="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Photo de profil</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">Personnalisez votre avatar</p>
          </div>
        </div>
      </template>
      
      <template #body>
        <div class="space-y-8">
          <!-- Aperçu actuel -->
          <div class="flex justify-center">
            <div class="relative group">
              <UserAvatar
                v-if="authStore.user"
                :user="authStore.user"
                size="xl"
                border
                class="w-32 h-32 border-primary-200 dark:border-primary-700 shadow-xl transition-transform group-hover:scale-105"
              />
              <div class="absolute inset-0 rounded-full bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                <UIcon name="i-heroicons-camera" class="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="space-y-3">
            <UButton 
              icon="i-heroicons-arrow-up-tray" 
              variant="soft" 
              color="primary" 
              size="lg"
              block
              :loading="pictureLoading"
              @click="triggerFileInput"
              class="transition-all duration-200 hover:transform hover:scale-105 justify-start"
            >
              {{ pictureLoading ? 'Téléchargement...' : 'Changer la photo' }}
            </UButton>
            
            <UButton 
              v-if="authStore.user?.profilePicture"
              icon="i-heroicons-trash" 
              variant="soft" 
              color="error" 
              size="lg"
              block
              :loading="pictureLoading"
              @click="deleteProfilePicture"
              class="transition-all duration-200 hover:transform hover:scale-105 justify-start"
            >
              {{ pictureLoading ? 'Suppression...' : 'Supprimer la photo' }}
            </UButton>
            
            <input 
              ref="fileInput"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleFileUpload"
            >
          </div>

          <!-- Informations -->
          <div class="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
            <div class="flex items-start gap-3">
              <UIcon name="i-heroicons-information-circle" class="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p class="text-sm font-medium text-gray-900 dark:text-white mb-1">Informations importantes</p>
                <ul class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• Formats acceptés : JPG, PNG, GIF, WebP</li>
                  <li>• Taille maximale : 5MB</li>
                  <li>• Résolution recommandée : 400x400px minimum</li>
                </ul>
              </div>
            </div>
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
import { useEditionStore } from '~/stores/editions';
import type { HttpError, User } from '~/types';

// Protéger cette page avec le middleware d'authentification
definePageMeta({
  middleware: 'auth-protected'
});

const authStore = useAuthStore();
const editionStore = useEditionStore();
const toast = useToast();

const loading = ref(false);
const passwordLoading = ref(false);
const pictureLoading = ref(false);
const showPasswordModal = ref(false);
const showProfilePictureModal = ref(false);
const fileInput = ref<HTMLInputElement>();
const avatarKey = ref(Date.now()); // Pour forcer le rechargement de l'avatar

// Gestion du mode administrateur
const adminModeToggle = ref(authStore.isAdminModeActive);

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


// Détection des changements
const hasChanges = computed(() => {
  return state.email !== (authStore.user?.email || '') ||
         state.pseudo !== (authStore.user?.pseudo || '') ||
         state.nom !== (authStore.user?.nom || '') ||
         state.prenom !== (authStore.user?.prenom || '');
});

// Statistiques calculées
const myConventionsCount = computed(() => {
  return editionStore.editions.filter(
    edition => edition.creatorId === authStore.user?.id
  ).length;
});

const favoritesCount = computed(() => {
  return editionStore.editions.filter(
    edition => edition.favoritedBy.some(user => user.id === authStore.user?.id)
  ).length;
});

const totalFavoritesReceived = computed(() => {
  return editionStore.editions
    .filter(edition => edition.creatorId === authStore.user?.id)
    .reduce((total, edition) => total + edition.favoritedBy.length, 0);
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
    const updatedUser = await $fetch<User>('/api/profile/update', {
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
  } catch (error: unknown) {
    const httpError = error as HttpError;
    toast.add({ 
      title: 'Erreur', 
      description: httpError.data?.message || httpError.message || 'Impossible de sauvegarder le profil',
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
  } catch (error: unknown) {
    const httpError = error as HttpError;
    toast.add({ 
      title: 'Erreur', 
      description: httpError.data?.message || httpError.message || 'Impossible de changer le mot de passe',
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
    
    const response = await $fetch<{ user: User }>('/api/profile/upload-picture', {
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
  } catch (error: unknown) {
    const httpError = error as HttpError;
    toast.add({ 
      title: 'Erreur', 
      description: httpError.data?.message || httpError.message || 'Impossible de changer la photo',
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
    const response = await $fetch<{ user: User }>('/api/profile/delete-picture', {
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
  } catch (error: unknown) {
    const httpError = error as HttpError;
    toast.add({ 
      title: 'Erreur', 
      description: httpError.data?.message || httpError.message || 'Impossible de supprimer la photo',
      icon: 'i-heroicons-x-circle', 
      color: 'error' 
    });
  } finally {
    pictureLoading.value = false;
  }
};

// Fonction pour basculer le mode administrateur
const toggleAdminMode = (enabled: boolean) => {
  if (enabled) {
    authStore.enableAdminMode();
    toast.add({
      title: 'Mode administrateur activé',
      description: 'Vous avez maintenant accès à tous les privilèges d\'administrateur',
      icon: 'i-heroicons-shield-check',
      color: 'warning'
    });
  } else {
    authStore.disableAdminMode();
    toast.add({
      title: 'Mode administrateur désactivé',
      description: 'Vous utilisez maintenant l\'interface utilisateur normale',
      icon: 'i-heroicons-user',
      color: 'info'
    });
  }
};

onMounted(async () => {
  await editionStore.fetchEditions();
});
</script>