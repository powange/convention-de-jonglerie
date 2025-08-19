<template>
  <div class="flex items-center justify-center p-4">
    <div class="w-full max-w-lg">
      <!-- En-tête avec logo/icône -->
      <div class="text-center mb-8">
        <div class="mx-auto w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center mb-4 shadow-lg">
          <UIcon name="i-heroicons-user-plus" class="text-white" size="32" />
        </div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">{{ $t('auth.register_title') }}</h1>
        <p class="text-gray-600 dark:text-gray-400">{{ $t('auth.register_subtitle') }}</p>
        
        <!-- Messages importants -->
        <div class="mt-4 space-y-3">
          <!-- Message pour l'accès email -->
          <div class="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div class="flex items-start gap-3">
              <UIcon name="i-heroicons-envelope" class="text-blue-600 dark:text-blue-400 mt-0.5" size="20" />
              <div>
                <p class="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                  {{ $t('auth.email_access_required') }}
                </p>
                <p class="text-xs text-blue-700 dark:text-blue-300">
                  {{ $t('auth.verification_email_notice') }}
                </p>
              </div>
            </div>
          </div>
          
          <!-- Message pour compte personnel -->
          <div class="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div class="flex items-start gap-3">
              <UIcon name="i-heroicons-user-circle" class="text-amber-600 dark:text-amber-400 mt-0.5" size="20" />
              <div>
                <p class="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                  {{ $t('auth.personal_account_only') }}
                </p>
                <p class="text-xs text-amber-700 dark:text-amber-300">
                  {{ $t('auth.personal_account_description') }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Card principale -->
      <UCard class="shadow-xl border-0 backdrop-blur-sm bg-white/80 dark:bg-gray-800/80">
        <UForm :state="state" :schema="schema" class="space-y-6" @submit="handleRegister">
          <!-- Section Informations personnelles -->
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                {{ $t('auth.personal_information') }}
              </h3>
              <div class="flex items-center gap-1">
                <UIcon name="i-heroicons-eye-slash" class="w-3 h-3 text-gray-400" />
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ $t('common.private') }}</span>
              </div>
            </div>
            <div class="border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ $t('auth.private_info_notice') }}
              </p>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <UFormField :label="$t('auth.first_name')" name="prenom">
                <UInput 
                  v-model="state.prenom" 
                  required 
                  :placeholder="$t('auth.first_name_placeholder')"
                  icon="i-heroicons-user"
                  class="w-full"
                />
              </UFormField>
              <UFormField :label="$t('auth.last_name')" name="nom">
                <UInput 
                  v-model="state.nom" 
                  required 
                  :placeholder="$t('auth.last_name_placeholder')"
                  icon="i-heroicons-user"
                  class="w-full"
                />
              </UFormField>
            </div>
          </div>

          <!-- Section Compte -->
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                {{ $t('auth.account_information') }}
              </h3>
            </div>
            <div class="border-b border-gray-200 dark:border-gray-700 pb-2 mb-4" />
            
            <UFormField :label="$t('common.email')" name="email" :hint="$t('auth.email_private_hint')">
              <UInput 
                v-model="state.email" 
                type="email" 
                required 
                :placeholder="$t('auth.email_placeholder')"
                icon="i-heroicons-envelope"
                class="w-full"
              />
            </UFormField>
            
            <UFormField :label="$t('auth.username')" name="pseudo" :hint="$t('auth.username_public_hint')">
              <UInput 
                v-model="state.pseudo" 
                required 
                :placeholder="$t('auth.username_placeholder')"
                icon="i-heroicons-at-symbol"
                class="w-full"
              />
            </UFormField>
          </div>

          <!-- Section Sécurité -->
          <div class="space-y-4">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700 pb-2">
              {{ $t('common.password') }}
            </h3>
            
            <UFormField :label="$t('common.password')" name="password">
              <UInput 
                v-model="state.password" 
                :type="showPassword ? 'text' : 'password'" 
                required 
                :placeholder="$t('auth.password_placeholder_secure')"
                icon="i-heroicons-lock-closed"
                class="w-full"
                :ui="{ trailing: 'pe-1' }"
              >
                <template #trailing>
                  <UButton
                    color="neutral"
                    variant="link"
                    size="sm"
                    :icon="showPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                    :aria-label="showPassword ? $t('auth.hide_password') : $t('auth.show_password')"
                    :aria-pressed="showPassword"
                    @click="showPassword = !showPassword"
                  />
                </template>
              </UInput>
              <!-- Indicateur de force du mot de passe -->
              <div v-if="state.password" class="mt-2">
                <div class="flex gap-1 mb-1">
                  <div 
                    v-for="i in 4" 
                    :key="i"
                    class="h-1 flex-1 rounded"
                    :class="getPasswordStrengthBarColor(i)"
                  />
                </div>
                <p class="text-xs" :class="getPasswordStrengthTextColor()">
                  {{ getPasswordStrengthText() }}
                </p>
              </div>
            </UFormField>
            
            <UFormField :label="$t('auth.confirm_password')" name="confirmPassword">
              <UInput 
                v-model="state.confirmPassword" 
                :type="showConfirmPassword ? 'text' : 'password'" 
                required 
                :placeholder="$t('auth.confirm_password_placeholder')"
                icon="i-heroicons-shield-check"
                class="w-full"
                :ui="{ trailing: 'pe-1' }"
              >
                <template #trailing>
                  <UButton
                    color="neutral"
                    variant="link"
                    size="sm"
                    :icon="showConfirmPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                    :aria-label="showConfirmPassword ? $t('auth.hide_password') : $t('auth.show_password')"
                    :aria-pressed="showConfirmPassword"
                    @click="showConfirmPassword = !showConfirmPassword"
                  />
                </template>
              </UInput>
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
            {{ loading ? $t('auth.creating_account') : $t('auth.create_account') }}
          </UButton>
        </UForm>

        <!-- Séparateur OU -->
        <div class="my-6">
          <div class="flex items-center">
            <div class="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
            <span class="mx-3 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ $t('common.or') }}</span>
            <div class="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
          </div>
        </div>

        <!-- Inscription via Google -->
        <div>
          <UButton
            block
            color="neutral"
            variant="soft"
            icon="i-simple-icons-google"
            @click="onGoogleRegister"
          >
            {{ $t('auth.continue_with_google') }}
          </UButton>
        </div>

        <!-- Lien de connexion -->
        <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p class="text-center text-sm text-gray-600 dark:text-gray-400">
            {{ $t('auth.already_account') }} 
            <NuxtLink 
              to="/login" 
              class="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
            >
              {{ $t('navigation.login') }}
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
import type { HttpError } from '~/types';

const toast = useToast();
const { t } = useI18n();

const schema = z.object({
  email: z.string().email(t('errors.invalid_email')),
  pseudo: z.string().min(3, t('errors.username_min_3_chars')),
  nom: z.string().min(1, t('errors.last_name_required')),
  prenom: z.string().min(1, t('errors.first_name_required')),
  password: z.string()
    .min(8, t('errors.password_too_short'))
    .regex(/(?=.*[A-Z])/, t('errors.password_uppercase_required'))
    .regex(/(?=.*\d)/, t('errors.password_digit_required')),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: t('errors.passwords_dont_match'),
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

// États pour l'affichage des mots de passe
const showPassword = ref(false);
const showConfirmPassword = ref(false);

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
      return t('auth.password_weak');
    case 2:
      return t('auth.password_medium');
    case 3:
      return t('auth.password_strong');
    case 4:
      return t('auth.password_very_strong');
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

const onGoogleRegister = async () => {
  // Navigation externe pour forcer l'appel de la route serveur (/auth/google)
  await navigateTo('/auth/google', { external: true })
}

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
      await navigateTo(`/verify-email?email=${encodeURIComponent(response.email)}`);
      toast.add({ 
        title: t('messages.account_created'), 
        description: t('messages.verification_code_sent'),
        icon: 'i-heroicons-envelope', 
        color: 'success' 
      });
    }
  } catch (e: unknown) {
    const error = e as HttpError;
    let errorMessage = t('errors.registration_failed');
    if (error.statusCode === 409 || error.status === 409) {
      errorMessage = t('errors.email_or_username_taken');
    } else if (error.message || error.data?.message) {
      errorMessage = error.message || error.data?.message || errorMessage;
    }
  toast.add({ title: errorMessage, icon: 'i-heroicons-x-circle', color: 'error' });
  } finally {
    loading.value = false;
  }
};
</script>
