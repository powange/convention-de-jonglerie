<template>
  <div class="flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- En-tête avec logo/icône -->
      <div class="text-center mb-8">
        <div class="mx-auto w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center mb-4 shadow-lg">
          <UIcon name="i-heroicons-envelope" class="text-white" size="32" />
        </div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">{{ $t('auth.forgot_password_title') }}</h1>
        <p class="text-gray-600 dark:text-gray-400">{{ $t('auth.forgot_password_subtitle') }}</p>
      </div>

      <!-- Card principale -->
      <UCard class="shadow-xl border-0 backdrop-blur-sm bg-white/80 dark:bg-gray-800/80">
        <UForm :state="state" :schema="schema" class="space-y-6" @submit="handleSubmit">
          <!-- Section Email -->
          <div class="space-y-4">
            <UFormField :label="t('common.email')" name="email">
              <UInput 
                v-model="state.email" 
                type="email"
                required 
                :placeholder="t('auth.email_or_username_placeholder')"
                icon="i-heroicons-envelope"
                class="w-full"
                :disabled="loading || emailSent"
              />
            </UFormField>
          </div>

          <!-- Message de succès -->
          <UAlert 
            v-if="emailSent" 
            icon="i-heroicons-check-circle"
            color="success"
            :title="t('auth.email_sent_success')"
            :description="t('auth.email_sent_description')"
          />

          <!-- Bouton d'envoi -->
          <UButton 
            v-if="!emailSent"
            type="submit" 
            :loading="loading" 
            size="lg"
            block
            class="mt-8"
            icon="i-heroicons-paper-airplane"
          >
            {{ loading ? t('auth.sending') : t('auth.send_link') }}
          </UButton>

          <!-- Bouton de retour après succès -->
          <UButton 
            v-if="emailSent"
            to="/login"
            variant="soft"
            size="lg"
            block
            class="mt-8"
            icon="i-heroicons-arrow-left"
          >
            {{ $t('auth.back_to_login') }}
          </UButton>
        </UForm>

        <!-- Lien de retour -->
        <div v-if="!emailSent" class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p class="text-center text-sm text-gray-600 dark:text-gray-400">
            {{ $t('auth.remember_password') }} 
            <NuxtLink 
              to="/login" 
              class="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
            >
              {{ $t('navigation.login') }}
            </NuxtLink>
          </p>
        </div>
      </UCard>

      <!-- Footer -->
      <div class="mt-8 text-center">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{ $t('auth.check_spam') }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { z } from 'zod';

const toast = useToast();
const { t } = useI18n();

const schema = z.object({
  email: z.string().email(t('errors.invalid_email')).min(1, t('errors.required_field')),
});

const state = reactive({
  email: '',
});

const loading = ref(false);
const emailSent = ref(false);

const handleSubmit = async () => {
  loading.value = true;
  
  try {
    const response = await $fetch('/api/auth/request-password-reset', {
      method: 'POST',
      body: {
        email: state.email
      }
    });

    emailSent.value = true;
    
    toast.add({ 
      title: t('auth.email_sent_success'), 
      description: response.message,
      icon: 'i-heroicons-check-circle', 
      color: 'success' 
    });
    
  } catch (error: any) {
    toast.add({ 
      title: t('common.error'), 
      description: error.data?.statusMessage || t('errors.server_error'),
      icon: 'i-heroicons-x-circle', 
      color: 'error' 
    });
  } finally {
    loading.value = false;
  }
};
</script>