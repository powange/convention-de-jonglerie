<template>
  <UCard>
    <template #header>
      <h1 class="text-2xl font-bold">Connexion</h1>
    </template>
    <UForm :state="state" :schema="schema" class="space-y-4" @submit="handleLogin">
      <UFormField label="Email ou Pseudo" name="identifier">
        <UInput v-model="state.identifier" required placeholder="votre.email@example.com ou votre pseudo" />
      </UFormField>
      <UFormField label="Mot de passe" name="password">
        <UInput v-model="state.password" type="password" required placeholder="Votre mot de passe" />
      </UFormField>
      <UFormField name="rememberMe">
        <UCheckbox v-model="state.rememberMe" label="Se souvenir de moi" />
      </UFormField>
      <UButton type="submit" :loading="loading">Se connecter</UButton>
    </UForm>
    <p class="mt-4 text-center">
      Pas encore de compte ? <NuxtLink to="/register" class="text-primary-500 hover:underline">S'inscrire</NuxtLink>
    </p>
  </UCard>
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
    } else if (error.message || error.data?.message) {
      errorMessage = error.message || error.data?.message || errorMessage;
    }
    toast.add({ title: errorMessage, icon: 'i-heroicons-x-circle', color: 'error' });
  } finally {
    loading.value = false;
  }
};
</script>
