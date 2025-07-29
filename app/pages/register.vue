<template>
  <div class="flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- En-tête avec logo/icône -->
      <div class="text-center mb-8">
        <div class="mx-auto w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center mb-4 shadow-lg">
          <UIcon name="i-heroicons-user-plus" class="text-white" size="32" />
        </div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Créer un compte</h1>
        <p class="text-gray-600 dark:text-gray-400">Rejoignez la communauté des jongleurs</p>
        
        <!-- Message important pour l'accès email -->
        <div class="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div class="flex items-start gap-3">
            <UIcon name="i-heroicons-envelope" class="text-blue-600 dark:text-blue-400 mt-0.5" size="20" />
            <div>
              <p class="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                Accès à votre boîte email requis
              </p>
              <p class="text-xs text-blue-700 dark:text-blue-300">
                Vous recevrez un code de vérification par email pour finaliser votre inscription.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Card principale -->
      <UCard class="shadow-xl border-0 backdrop-blur-sm bg-white/80 dark:bg-gray-800/80">
        <UForm :state="state" :schema="schema" class="space-y-6" @submit="handleRegister">
          <!-- Section Informations personnelles -->
          <div class="space-y-4">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700 pb-2">
              Informations personnelles
            </h3>
            
            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Prénom" name="prenom">
                <UInput 
                  v-model="state.prenom" 
                  required 
                  placeholder="Votre prénom"
                  icon="i-heroicons-user"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Nom" name="nom">
                <UInput 
                  v-model="state.nom" 
                  required 
                  placeholder="Votre nom"
                  icon="i-heroicons-user"
                  class="w-full"
                />
              </UFormField>
            </div>
          </div>

          <!-- Section Compte -->
          <div class="space-y-4">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700 pb-2">
              Informations de compte
            </h3>
            
            <UFormField label="Adresse e-mail" name="email">
              <UInput 
                v-model="state.email" 
                type="email" 
                required 
                placeholder="votre.email@example.com"
                icon="i-heroicons-envelope"
                class="w-full"
              />
            </UFormField>
            
            <UFormField label="Pseudo" name="pseudo">
              <UInput 
                v-model="state.pseudo" 
                required 
                placeholder="Votre pseudo unique"
                icon="i-heroicons-at-symbol"
                class="w-full"
              />
            </UFormField>
          </div>

          <!-- Section Sécurité -->
          <div class="space-y-4">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700 pb-2">
              Mot de passe
            </h3>
            
            <UFormField label="Mot de passe" name="password">
              <UInput 
                v-model="state.password" 
                type="password" 
                required 
                placeholder="Choisissez un mot de passe sécurisé"
                icon="i-heroicons-lock-closed"
                class="w-full"
              />
              <!-- Indicateur de force du mot de passe -->
              <div v-if="state.password" class="mt-2">
                <div class="flex gap-1 mb-1">
                  <div 
                    v-for="i in 4" 
                    :key="i"
                    class="h-1 flex-1 rounded"
                    :class="getPasswordStrengthBarColor(i)"
                  ></div>
                </div>
                <p class="text-xs" :class="getPasswordStrengthTextColor()">
                  {{ getPasswordStrengthText() }}
                </p>
              </div>
            </UFormField>
            
            <UFormField label="Confirmer le mot de passe" name="confirmPassword">
              <UInput 
                v-model="state.confirmPassword" 
                type="password" 
                required 
                placeholder="Confirmez votre mot de passe"
                icon="i-heroicons-shield-check"
                class="w-full"
              />
            </UFormField>
          </div>

          <!-- Bouton d'inscription -->
          <UButton 
            type="submit" 
            :loading="loading" 
            size="lg"
            block
            class="mt-8"
            icon="i-heroicons-user-plus"
          >
            {{ loading ? 'Création en cours...' : 'Créer mon compte' }}
          </UButton>
        </UForm>

        <!-- Lien de connexion -->
        <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p class="text-center text-sm text-gray-600 dark:text-gray-400">
            Déjà un compte ? 
            <NuxtLink 
              to="/login" 
              class="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
            >
              Se connecter
            </NuxtLink>
          </p>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { z } from 'zod';
import { useAuthStore } from '../stores/auth';
import type { HttpError } from '~/types';

const authStore = useAuthStore();
const toast = useToast();
const router = useRouter();

const schema = z.object({
  email: z.string().email('Email invalide'),
  pseudo: z.string().min(3, 'Le pseudo doit contenir au moins 3 caractères'),
  nom: z.string().min(1, 'Le nom est requis'),
  prenom: z.string().min(1, 'Le prénom est requis'),
  password: z.string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .regex(/(?=.*[A-Z])/, 'Le mot de passe doit contenir au moins une majuscule')
    .regex(/(?=.*\d)/, 'Le mot de passe doit contenir au moins un chiffre'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

const state = reactive({
  email: '',
  pseudo: '',
  nom: '',
  prenom: '',
  password: '',
  confirmPassword: '',
});
const loading = ref(false);

// Fonctions pour l'indicateur de force du mot de passe
const getPasswordStrength = () => {
  const password = state.password;
  if (!password) return 0;
  
  let strength = 0;
  
  // Longueur
  if (password.length >= 8) strength++;
  
  // Majuscule
  if (/[A-Z]/.test(password)) strength++;
  
  // Chiffre
  if (/\d/.test(password)) strength++;
  
  // Caractère spécial ou longueur > 12
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password) || password.length > 12) strength++;
  
  return strength;
};

const getPasswordStrengthText = () => {
  const strength = getPasswordStrength();
  switch (strength) {
    case 0:
    case 1:
      return 'Mot de passe faible';
    case 2:
      return 'Mot de passe moyen';
    case 3:
      return 'Mot de passe fort';
    case 4:
      return 'Mot de passe très fort';
    default:
      return '';
  }
};

const getPasswordStrengthTextColor = () => {
  const strength = getPasswordStrength();
  switch (strength) {
    case 0:
    case 1:
      return 'text-red-500';
    case 2:
      return 'text-orange-500';
    case 3:
      return 'text-green-500';
    case 4:
      return 'text-emerald-500';
    default:
      return 'text-gray-500';
  }
};

const getPasswordStrengthBarColor = (barIndex: number) => {
  const strength = getPasswordStrength();
  if (barIndex <= strength) {
    switch (strength) {
      case 1:
        return 'bg-red-500';
      case 2:
        return 'bg-orange-500';
      case 3:
        return 'bg-green-500';
      case 4:
        return 'bg-emerald-500';
      default:
        return 'bg-gray-200 dark:bg-gray-700';
    }
  }
  return 'bg-gray-200 dark:bg-gray-700';
};

const handleRegister = async () => {
  loading.value = true;
  try {
    const response = await $fetch('/api/auth/register', {
      method: 'POST',
      body: {
        email: state.email,
        password: state.password,
        pseudo: state.pseudo,
        nom: state.nom,
        prenom: state.prenom
      }
    });
    
    if (response.requiresVerification) {
      // Rediriger vers la page de vérification avec l'email
      router.push(`/verify-email?email=${encodeURIComponent(response.email)}`);
      toast.add({ 
        title: 'Compte créé ! Vérifiez votre email.', 
        description: 'Un code de vérification vous a été envoyé.',
        icon: 'i-heroicons-envelope', 
        color: 'success' 
      });
    }
  } catch (e: unknown) {
    const error = e as HttpError;
    let errorMessage = "Échec de l'inscription";
    if (error.statusCode === 409 || error.status === 409) {
      errorMessage = 'Cet email ou pseudo est déjà utilisé';
    } else if (error.message || error.data?.message) {
      errorMessage = error.message || error.data?.message || errorMessage;
    }
    toast.add({ title: errorMessage, icon: 'i-heroicons-x-circle', color: 'error' });
  } finally {
    loading.value = false;
  }
};
</script>
