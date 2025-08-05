<template>
  <div class="flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- En-tête avec logo/icône -->
      <div class="text-center mb-8">
        <div class="mx-auto w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center mb-4 shadow-lg">
          <UIcon name="i-heroicons-lock-closed" class="text-white" size="32" />
        </div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">{{ $t('auth.reset_password_title') }}</h1>
        <p class="text-gray-600 dark:text-gray-400">{{ $t('auth.reset_password_subtitle') }}</p>
      </div>

      <!-- Card principale -->
      <UCard class="shadow-xl border-0 backdrop-blur-sm bg-white/80 dark:bg-gray-800/80">
        <!-- Formulaire de réinitialisation -->
        <UForm v-if="!invalidToken && !passwordReset" :state="state" :schema="schema" class="space-y-6" @submit="handleSubmit">
          <!-- Section Mots de passe -->
          <div class="space-y-4">
            <UFormField :label="t('auth.new_password')" name="newPassword" :help="t('auth.min_characters')">
              <UInput 
                v-model="state.newPassword" 
                :type="showNewPassword ? 'text' : 'password'"
                required 
                placeholder="••••••••"
                icon="i-heroicons-lock-closed"
                class="w-full"
                :disabled="loading"
                :ui="{ trailing: 'pe-1' }"
              >
                <template #trailing>
                  <UButton
                    color="neutral"
                    variant="link"
                    size="sm"
                    :icon="showNewPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                    :aria-label="showNewPassword ? t('auth.hide_password') : t('auth.show_password')"
                    :aria-pressed="showNewPassword"
                    :disabled="loading"
                    @click="showNewPassword = !showNewPassword"
                  />
                </template>
              </UInput>
            </UFormField>
            
            <UFormField :label="t('auth.confirm_new_password')" name="confirmPassword">
              <UInput 
                v-model="state.confirmPassword" 
                :type="showConfirmPassword ? 'text' : 'password'"
                required 
                placeholder="••••••••"
                icon="i-heroicons-lock-closed"
                class="w-full"
                :disabled="loading"
                :ui="{ trailing: 'pe-1' }"
              >
                <template #trailing>
                  <UButton
                    color="neutral"
                    variant="link"
                    size="sm"
                    :icon="showConfirmPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                    :aria-label="showConfirmPassword ? t('auth.hide_password') : t('auth.show_password')"
                    :aria-pressed="showConfirmPassword"
                    :disabled="loading"
                    @click="showConfirmPassword = !showConfirmPassword"
                  />
                </template>
              </UInput>
            </UFormField>
          </div>

          <!-- Indicateur de force du mot de passe -->
          <div v-if="state.newPassword" class="space-y-2">
            <div class="text-sm text-gray-600 dark:text-gray-400">{{ $t('auth.password_strength') }}</div>
            <div class="flex space-x-1">
              <div 
                v-for="i in 4" 
                :key="i"
                class="h-2 flex-1 rounded-full"
                :class="getPasswordStrengthColor(i, passwordStrength)"
              ></div>
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
              {{ getPasswordStrengthText(passwordStrength) }}
            </div>
          </div>

          <!-- Bouton de réinitialisation -->
          <UButton 
            type="submit" 
            :loading="loading" 
            size="lg"
            block
            class="mt-8"
            icon="i-heroicons-check"
          >
            {{ loading ? t('auth.resetting') : t('auth.confirm_new_password') }}
          </UButton>
        </UForm>

        <!-- Message de succès -->
        <div v-if="passwordReset" class="text-center space-y-6">
          <div class="mx-auto w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4">
            <UIcon name="i-heroicons-check" class="text-white" size="32" />
          </div>
          
          <UAlert 
            icon="i-heroicons-check-circle"
            color="success"
            :title="t('auth.password_reset_success')"
            :description="t('auth.password_reset_description')"
          />

          <UButton 
            to="/login"
            size="lg"
            block
            icon="i-heroicons-arrow-right-on-rectangle"
          >
            {{ $t('navigation.login') }}
          </UButton>
        </div>

        <!-- Message d'erreur pour token invalide -->
        <div v-if="invalidToken" class="text-center space-y-6">
          <div class="mx-auto w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mb-4">
            <UIcon name="i-heroicons-exclamation-triangle" class="text-white" size="32" />
          </div>
          
          <UAlert 
            icon="i-heroicons-exclamation-triangle"
            color="error"
            :title="t('auth.invalid_link')"
            :description="t('auth.invalid_link_description')"
          />

          <div class="space-y-3">
            <UButton 
              to="/auth/forgot-password"
              size="lg"
              block
              icon="i-heroicons-envelope"
            >
              {{ $t('auth.request_new_link') }}
            </UButton>
            
            <UButton 
              to="/login"
              variant="soft"
              size="lg"
              block
              icon="i-heroicons-arrow-left"
            >
              {{ $t('auth.back_to_login') }}
            </UButton>
          </div>
        </div>
      </UCard>

      <!-- Footer -->
      <div class="mt-8 text-center">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{ $t('auth.password_security_tip') }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue';
import { z } from 'zod';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { t } = useI18n();

const schema = z.object({
  newPassword: z.string()
    .min(8, t('errors.password_too_short'))
    .regex(/(?=.*[A-Z])/, 'Le mot de passe doit contenir au moins une majuscule')
    .regex(/(?=.*\d)/, 'Le mot de passe doit contenir au moins un chiffre'),
  confirmPassword: z.string().min(1, t('errors.required_field')),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

const state = reactive({
  newPassword: '',
  confirmPassword: '',
});

const loading = ref(false);
const invalidToken = ref(false);
const passwordReset = ref(false);

// États pour l'affichage des mots de passe
const showNewPassword = ref(false);
const showConfirmPassword = ref(false);

const token = computed(() => route.query.token as string);

// Calcul de la force du mot de passe
const passwordStrength = computed(() => {
  const password = state.newPassword;
  if (!password) return 0;
  
  let strength = 0;
  if (password.length >= 8) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;
  
  return strength;
});

const getPasswordStrengthColor = (index: number, strength: number) => {
  if (index <= strength) {
    switch (strength) {
      case 1: return 'bg-red-500';
      case 2: return 'bg-yellow-500';
      case 3: return 'bg-blue-500';
      case 4: return 'bg-green-500';
      default: return 'bg-gray-200 dark:bg-gray-700';
    }
  }
  return 'bg-gray-200 dark:bg-gray-700';
};

const getPasswordStrengthText = (strength: number) => {
  switch (strength) {
    case 0: return t('auth.strength_very_weak');
    case 1: return t('auth.strength_weak');
    case 2: return t('auth.strength_medium');
    case 3: return t('auth.strength_good');
    case 4: return t('auth.strength_excellent');
    default: return '';
  }
};

// Vérifier la présence et la validité du token
onMounted(async () => {
  if (!token.value) {
    invalidToken.value = true;
    return;
  }

  try {
    const response = await $fetch('/api/auth/verify-reset-token', {
      params: { token: token.value }
    });

    if (!response.valid) {
      invalidToken.value = true;
      
      // Message spécifique selon la raison
      let message = t('auth.invalid_link');
      if (response.reason === 'expired') {
        message = 'Ce lien de réinitialisation a expiré';
      } else if (response.reason === 'used') {
        message = 'Ce lien a déjà été utilisé pour réinitialiser le mot de passe';
      }
      
      toast.add({
        title: t('auth.invalid_link'),
        description: message,
        icon: 'i-heroicons-exclamation-triangle',
        color: 'error'
      });
    }
  } catch (error) {
    console.error('Erreur lors de la vérification du token:', error);
    invalidToken.value = true;
  }
});

const handleSubmit = async () => {
  loading.value = true;
  
  try {
    await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: {
        token: token.value,
        newPassword: state.newPassword
      }
    });

    passwordReset.value = true;
    
    toast.add({ 
      title: t('common.success'), 
      description: t('auth.password_reset_description'),
      icon: 'i-heroicons-check-circle', 
      color: 'success' 
    });
    
  } catch (error: any) {
    if (error.data?.statusMessage?.includes('invalide') || 
        error.data?.statusMessage?.includes('expiré')) {
      invalidToken.value = true;
    } else {
      toast.add({ 
        title: t('common.error'), 
        description: error.data?.statusMessage || t('errors.server_error'),
        icon: 'i-heroicons-x-circle', 
        color: 'error' 
      });
    }
  } finally {
    loading.value = false;
  }
};
</script>