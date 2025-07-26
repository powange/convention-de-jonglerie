<template>
  <UCard>
    <template #header>
      <h1 class="text-2xl font-bold">Ajouter une nouvelle convention</h1>
    </template>
    <ConventionForm @submit="handleAddConvention" submit-button-text="Ajouter la convention" :loading="conventionStore.loading" />
  </UCard>
</template>

<script setup lang="ts">
import { useConventionStore } from '~/stores/conventions';
import { useRouter } from 'vue-router';
import ConventionForm from '~/components/ConventionForm.vue';
import type { Convention } from '~/types';

// Protéger cette page avec le middleware d'authentification
definePageMeta({
  middleware: 'auth-client'
});

const conventionStore = useConventionStore();
const toast = useToast();
const router = useRouter();

const handleAddConvention = async (formData: Convention) => {
  try {
    await conventionStore.addConvention(formData);
    toast.add({ title: 'Convention ajoutée avec succès !', icon: 'i-heroicons-check-circle', color: 'success' });
    router.push('/');
  } catch (e: unknown) {
    toast.add({ title: e.statusMessage || "Échec de l'ajout de la convention", icon: 'i-heroicons-x-circle', color: 'error' });
  }
};
</script>