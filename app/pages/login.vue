<template>
  <div class="flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- En-tête avec logo/icône -->
      <div class="text-center mb-8">
        <div class="mx-auto w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center mb-4 shadow-lg">
          <UIcon name="i-heroicons-key" class="text-white" size="32" />
        </div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Connexion</h1>
        <p class="text-gray-600 dark:text-gray-400">Accédez à votre compte</p>
      </div>

      <!-- Card principale -->
      <UCard class="shadow-xl border-0 backdrop-blur-sm bg-white/80 dark:bg-gray-800/80">
        <UForm :state="state" :schema="schema" class="space-y-6" @submit="handleLogin">
          <!-- Section Authentification -->
          <div class="space-y-4">
            <UFormField label="Email ou Pseudo" name="identifier">
              <UInput 
                v-model="state.identifier" 
                required 
                placeholder="votre.email@example.com ou votre pseudo"
                icon="i-heroicons-user"
              />
            </UFormField>
            
            <UFormField label="Mot de passe" name="password">
              <UInput 
                v-model="state.password" 
                type="password" 
                required 
                placeholder="Votre mot de passe"
                icon="i-heroicons-lock-closed"
              />
            </UFormField>
          </div>

          <!-- Options -->
          <div class="space-y-4">
            <UFormField name="rememberMe">
              <UCheckbox v-model="state.rememberMe" label="Se souvenir de moi" />
            </UFormField>
          </div>

          <!-- Bouton de connexion -->
          <UButton 
            type="submit" 
            :loading="loading" 
            size="lg"
            block
            class="mt-8"
            icon="i-heroicons-arrow-right-on-rectangle"
          >
            {{ loading ? 'Connexion en cours...' : 'Se connecter' }}
          </UButton>
        </UForm>

        <!-- Lien d'inscription -->
        <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p class="text-center text-sm text-gray-600 dark:text-gray-400">
            Pas encore de compte ? 
            <NuxtLink 
              to="/register" 
              class="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
            >
              S'inscrire
            </NuxtLink>
          </p>
        </div>
      </UCard>

      <!-- Footer -->
      <div class="mt-8 text-center">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          Problème de connexion ? Contactez le support.
        </p>
      </div>
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
  identifier: z.string().min(1, 'Email ou pseudo requis'),
  password: z.string().min(1, 'Mot de passe requis'),
  rememberMe: z.boolean().optional()
});

const state = reactive({
  identifier: '',
  password: '',
  rememberMe: false,
});
const loading = ref(false);

const handleLogin = async () => {
  loading.value = true;
  try {
    await authStore.login(state.identifier, state.password, state.rememberMe);
    toast.add({ title: 'Connexion réussie !', icon: 'i-heroicons-check-circle', color: 'success' });
    
    // Navigation intelligente : retourner à la page précédente ou à l'accueil
    const returnTo = useRoute().query.returnTo as string;
    router.push(returnTo || '/');
  } catch (e: unknown) {
    const error = e as HttpError;
    let errorMessage = 'Échec de la connexion';
    
    if (error.statusCode === 401 || error.status === 401) {
      errorMessage = 'Email/pseudo ou mot de passe incorrect';
    } else if (error.statusCode === 403 || error.status === 403) {
      // Email non vérifié
      if (error.data?.requiresEmailVerification && error.data?.email) {
        toast.add({ 
          title: 'Email non vérifié', 
          description: 'Vous devez vérifier votre email avant de vous connecter.',
          icon: 'i-heroicons-envelope-open', 
          color: 'warning' 
        });
        
        // Rediriger vers la page de vérification
        router.push(`/verify-email?email=${encodeURIComponent(error.data.email)}`);
        return;
      } else {
        errorMessage = error.statusMessage || 'Accès non autorisé';
      }
    } else if (error.message || error.data?.message) {
      errorMessage = error.message || error.data?.message || errorMessage;
    }
    
    toast.add({ title: errorMessage, icon: 'i-heroicons-x-circle', color: 'error' });
  } finally {
    loading.value = false;
  }
};
</script>
