<template>
  <div class="flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- En-tête avec logo/icône -->
      <div class="text-center mb-8">
        <div class="mx-auto w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center mb-4 shadow-lg">
          <UIcon name="i-heroicons-lock-closed" class="text-white" size="32" />
        </div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Nouveau mot de passe</h1>
        <p class="text-gray-600 dark:text-gray-400">Définissez votre nouveau mot de passe</p>
      </div>

      <!-- Card principale -->
      <UCard class="shadow-xl border-0 backdrop-blur-sm bg-white/80 dark:bg-gray-800/80">
        <!-- Formulaire de réinitialisation -->
        <UForm v-if="!invalidToken && !passwordReset" :state="state" :schema="schema" class="space-y-6" @submit="handleSubmit">
          <!-- Section Mots de passe -->
          <div class="space-y-4">
            <UFormField label="Nouveau mot de passe" name="newPassword" help="Minimum 8 caractères">
              <UInput 
                v-model="state.newPassword" 
                type="password"
                required 
                placeholder="••••••••"
                icon="i-heroicons-lock-closed"
                class="w-full"
                :disabled="loading"
              />
            </UFormField>
            
            <UFormField label="Confirmer le mot de passe" name="confirmPassword">
              <UInput 
                v-model="state.confirmPassword" 
                type="password"
                required 
                placeholder="••••••••"
                icon="i-heroicons-lock-closed"
                class="w-full"
                :disabled="loading"
              />
            </UFormField>
          </div>

          <!-- Indicateur de force du mot de passe -->
          <div v-if="state.newPassword" class="space-y-2">
            <div class="text-sm text-gray-600 dark:text-gray-400">Force du mot de passe :</div>
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
            {{ loading ? 'Réinitialisation...' : 'Confirmer le nouveau mot de passe' }}
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
            title="Mot de passe réinitialisé"
            description="Votre mot de passe a été modifié avec succès. Vous pouvez maintenant vous connecter."
          />

          <UButton 
            to="/login"
            size="lg"
            block
            icon="i-heroicons-arrow-right-on-rectangle"
          >
            Se connecter
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
            title="Lien invalide ou expiré"
            description="Ce lien de réinitialisation n'est plus valide. Veuillez en demander un nouveau."
          />

          <div class="space-y-3">
            <UButton 
              to="/auth/forgot-password"
              size="lg"
              block
              icon="i-heroicons-envelope"
            >
              Demander un nouveau lien
            </UButton>
            
            <UButton 
              to="/login"
              variant="soft"
              size="lg"
              block
              icon="i-heroicons-arrow-left"
            >
              Retour à la connexion
            </UButton>
          </div>
        </div>
      </UCard>

      <!-- Footer -->
      <div class="mt-8 text-center">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          Votre mot de passe doit être sécurisé et unique.
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

const schema = z.object({
  newPassword: z.string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .regex(/(?=.*[A-Z])/, 'Le mot de passe doit contenir au moins une majuscule')
    .regex(/(?=.*\d)/, 'Le mot de passe doit contenir au moins un chiffre'),
  confirmPassword: z.string().min(1, 'Confirmation requise'),
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
    case 0: return 'Très faible';
    case 1: return 'Faible';
    case 2: return 'Moyen';
    case 3: return 'Bon';
    case 4: return 'Excellent';
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
      let message = 'Lien de réinitialisation invalide';
      if (response.reason === 'expired') {
        message = 'Ce lien de réinitialisation a expiré';
      } else if (response.reason === 'used') {
        message = 'Ce lien a déjà été utilisé pour réinitialiser le mot de passe';
      }
      
      toast.add({
        title: 'Lien invalide',
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
      title: 'Succès', 
      description: 'Votre mot de passe a été réinitialisé avec succès',
      icon: 'i-heroicons-check-circle', 
      color: 'success' 
    });
    
  } catch (error: any) {
    if (error.data?.statusMessage?.includes('invalide') || 
        error.data?.statusMessage?.includes('expiré')) {
      invalidToken.value = true;
    } else {
      toast.add({ 
        title: 'Erreur', 
        description: error.data?.statusMessage || 'Une erreur est survenue',
        icon: 'i-heroicons-x-circle', 
        color: 'error' 
      });
    }
  } finally {
    loading.value = false;
  }
};
</script>