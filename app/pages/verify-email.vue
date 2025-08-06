<template>
  <div class="flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- En-tête avec logo/icône -->
      <div class="text-center mb-8">
        <div class="mx-auto w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center mb-4 shadow-lg">
          <UIcon name="i-heroicons-envelope-open" class="text-white" size="32" />
        </div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">{{ $t('auth.verify_email_title') }}</h1>
        <p class="text-gray-600 dark:text-gray-400">
          {{ $t('auth.verification_sent_to') }} <br>
          <span class="font-medium text-gray-800 dark:text-gray-200">{{ email }}</span>
        </p>
      </div>

      <!-- Card principale -->
      <UCard class="shadow-xl border-0 backdrop-blur-sm bg-white/80 dark:bg-gray-800/80">
        <div class="space-y-6">
          <!-- Instructions -->
          <div class="text-center">
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {{ $t('auth.enter_6_digit_code') }}
            </p>
          </div>

          <!-- Saisie du code -->
          <div class="space-y-4">
            <div class="flex justify-center">
              <div class="flex gap-2">
                <UInput
                  v-for="(digit, index) in codeDigits"
                  :key="index"
                  v-model="codeDigits[index]"
                  type="text"
                  maxlength="1"
                  class="w-12 h-12 text-center text-xl font-bold"
                  :class="{ 'border-red-500': hasError && !isValidCode }"
                  @input="handleDigitInput(index, $event)"
                  @keydown="handleKeyDown(index, $event)"
                  @paste="handlePaste"
                  :ref="(el) => setDigitRef(index, el)"
                />
              </div>
            </div>
            
            <!-- Message d'erreur -->
            <div v-if="hasError" class="text-center">
              <p class="text-sm text-red-500">{{ errorMessage }}</p>
            </div>
            
            <!-- Expiration timer -->
            <div v-if="timeRemaining > 0" class="text-center">
              <p class="text-xs text-gray-500">
                {{ $t('auth.code_valid_for') }} {{ Math.floor(timeRemaining / 60) }}:{{ String(timeRemaining % 60).padStart(2, '0') }}
              </p>
            </div>
          </div>

          <!-- Bouton de vérification -->
          <UButton 
            :loading="loading" 
            :disabled="!isValidCode"
            size="lg"
            block
            class="mt-6"
            icon="i-heroicons-check-circle"
            @click="handleVerification"
          >
            {{ loading ? t('auth.verifying') : t('auth.verify_code') }}
          </UButton>

          <!-- Actions supplémentaires -->
          <div class="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <!-- Renvoyer le code -->
            <div class="text-center">
              <UButton 
                variant="ghost" 
                size="sm"
                :disabled="resendCooldown > 0"
                @click="handleResendCode"
              >
                <template v-if="resendCooldown > 0">
                  {{ $t('auth.resend_in') }} {{ resendCooldown }}s
                </template>
                <template v-else>
                  <UIcon name="i-heroicons-arrow-path" class="mr-1" />
                  {{ $t('auth.resend_code') }}
                </template>
              </UButton>
            </div>
            
            <!-- Retour -->
            <div class="text-center">
              <NuxtLink 
                to="/register" 
                class="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                {{ $t('auth.back_to_register') }}
              </NuxtLink>
            </div>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { HttpError } from '~/types';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { t } = useI18n();

// Email depuis la query string
const email = computed(() => route.query.email as string || '');

// État du code
const codeDigits = ref(['', '', '', '', '', '']);
const digitRefs = ref<(HTMLInputElement | null)[]>([]);
const loading = ref(false);
const hasError = ref(false);
const errorMessage = ref('');

// Timer et cooldown
const timeRemaining = ref(15 * 60); // 15 minutes en secondes
const resendCooldown = ref(0);
let timerInterval: NodeJS.Timeout | null = null;
let resendInterval: NodeJS.Timeout | null = null;

// Code valide ?
const isValidCode = computed(() => {
  return codeDigits.value.every(digit => digit.length === 1 && /^\d$/.test(digit));
});

const fullCode = computed(() => codeDigits.value.join(''));

// Gestion des refs pour les inputs
const setDigitRef = (index: number, el: any) => {
  if (el && el.$el) {
    digitRefs.value[index] = el.$el.querySelector('input');
  } else {
    digitRefs.value[index] = el;
  }
};

// Gestion de la saisie des chiffres
const handleDigitInput = (index: number, event: any) => {
  const value = event.target.value;
  
  // Ne garder que le dernier chiffre saisi
  if (value.length > 1) {
    codeDigits.value[index] = value.slice(-1);
  } else {
    codeDigits.value[index] = value;
  }
  
  // Passer au champ suivant si un chiffre a été saisi
  if (value && index < 5) {
    focusDigit(index + 1);
  }
  
  // Réinitialiser l'erreur
  hasError.value = false;
};

// Gestion des touches spéciales
const handleKeyDown = (index: number, event: KeyboardEvent) => {
  if (event.key === 'Backspace' && !codeDigits.value[index] && index > 0) {
    // Si backspace sur un champ vide, aller au précédent
    focusDigit(index - 1);
  } else if (event.key === 'ArrowLeft' && index > 0) {
    focusDigit(index - 1);
  } else if (event.key === 'ArrowRight' && index < 5) {
    focusDigit(index + 1);
  }
};

// Gestion du collage
const handlePaste = (event: ClipboardEvent) => {
  event.preventDefault();
  const pastedData = event.clipboardData?.getData('text') || '';
  const digits = pastedData.replace(/\D/g, '').split('').slice(0, 6);
  
  digits.forEach((digit, index) => {
    if (index < 6) {
      codeDigits.value[index] = digit;
    }
  });
  
  // Focus sur le prochain champ vide ou le dernier
  const nextEmptyIndex = codeDigits.value.findIndex(digit => !digit);
  focusDigit(nextEmptyIndex !== -1 ? nextEmptyIndex : 5);
};

// Focus sur un chiffre spécifique
const focusDigit = (index: number) => {
  nextTick(() => {
    digitRefs.value[index]?.focus();
  });
};

// Vérification du code
const handleVerification = async () => {
  if (!isValidCode.value) return;
  
  loading.value = true;
  hasError.value = false;
  
  try {
    const response = await $fetch('/api/auth/verify-email', {
      method: 'POST',
      body: {
        email: email.value,
        code: fullCode.value
      }
    });
    
    toast.add({
      title: t('auth.email_verified_success'),
      description: t('auth.account_now_active'),
      icon: 'i-heroicons-check-circle',
      color: 'success'
    });
    
    router.push('/login');
  } catch (e: unknown) {
    const error = e as HttpError;
    hasError.value = true;
    
    if (error.statusCode === 400) {
      if (error.statusMessage?.includes('expired') || error.statusMessage?.includes('expiré')) {
        errorMessage.value = t('auth.code_expired');
      } else if (error.statusMessage?.includes('incorrect')) {
        errorMessage.value = t('auth.code_incorrect');
      } else {
        errorMessage.value = error.statusMessage || t('auth.invalid_code');
      }
    } else {
      errorMessage.value = t('errors.server_error');
    }
  } finally {
    loading.value = false;
  }
};

// Renvoyer le code
const handleResendCode = async () => {
  if (resendCooldown.value > 0) return;
  
  try {
    await $fetch('/api/auth/resend-verification', {
      method: 'POST',
      body: { email: email.value }
    });
    
    toast.add({
      title: t('auth.code_resent'),
      description: t('auth.new_code_sent'),
      icon: 'i-heroicons-envelope',
      color: 'success'
    });
    
    // Réinitialiser le timer et démarrer le cooldown
    timeRemaining.value = 15 * 60;
    resendCooldown.value = 60;
    startResendCooldown();
  } catch (e: unknown) {
    toast.add({
      title: t('common.error'),
      description: t('errors.server_error'),
      icon: 'i-heroicons-x-circle',
      color: 'error'
    });
  }
};

// Démarrer le timer
const startTimer = () => {
  if (timerInterval) clearInterval(timerInterval);
  
  timerInterval = setInterval(() => {
    timeRemaining.value--;
    if (timeRemaining.value <= 0) {
      clearInterval(timerInterval!);
    }
  }, 1000);
};

// Démarrer le cooldown de renvoi
const startResendCooldown = () => {
  if (resendInterval) clearInterval(resendInterval);
  
  resendInterval = setInterval(() => {
    resendCooldown.value--;
    if (resendCooldown.value <= 0) {
      clearInterval(resendInterval!);
    }
  }, 1000);
};

// Lifecycle
onMounted(() => {
  // Vérifier que l'email est présent
  if (!email.value) {
    router.push('/register');
    return;
  }
  
  // Focus sur le premier champ
  nextTick(() => {
    focusDigit(0);
  });
  
  // Démarrer le timer
  startTimer();
});

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
  if (resendInterval) clearInterval(resendInterval);
});
</script>