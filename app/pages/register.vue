<template>
  <UCard>
    <template #header>
      <h1 class="text-2xl font-bold">Inscription</h1>
    </template>
    <UForm :state="state" :schema="schema" class="space-y-4" @submit="handleRegister">
      <UFormField label="Adresse e-mail" name="email">
        <UInput v-model="state.email" type="email" required placeholder="votre.email@example.com" />
      </UFormField>
      <UFormField label="Pseudo" name="pseudo">
        <UInput v-model="state.pseudo" required placeholder="Votre pseudo unique (min. 3 caractères)" />
      </UFormField>
      <UFormField label="Nom" name="nom">
        <UInput v-model="state.nom" required placeholder="Votre nom de famille" />
      </UFormField>
      <UFormField label="Prénom" name="prenom">
        <UInput v-model="state.prenom" required placeholder="Votre prénom" />
      </UFormField>
      <UFormField label="Mot de passe" name="password">
        <UInput v-model="state.password" type="password" required placeholder="Min. 8 caractères, 1 majuscule, 1 chiffre" />
      </UFormField>
      <UFormField label="Confirmer le mot de passe" name="confirmPassword">
        <UInput v-model="state.confirmPassword" type="password" required placeholder="Retapez votre mot de passe" />
      </UFormField>
      <UButton type="submit" :loading="loading">S'inscrire</UButton>
    </UForm>
    <p class="mt-4 text-center">
      Déjà un compte ? <NuxtLink to="/login" class="text-primary-500 hover:underline">Se connecter</NuxtLink>
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

const handleRegister = async () => {
  loading.value = true;
  try {
    await authStore.register(state.email, state.password, state.pseudo, state.nom, state.prenom);
    toast.add({ title: 'Inscription réussie ! Veuillez vous connecter.', icon: 'i-heroicons-check-circle', color: 'success' });
    router.push('/login');
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
