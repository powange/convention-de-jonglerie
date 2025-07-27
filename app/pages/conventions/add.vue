<template>
  <div class="max-w-6xl mx-auto">
    <UCard>
      <template #header>
        <h1 class="text-2xl font-bold">Ajouter une nouvelle convention</h1>
      </template>
      <ConventionForm submit-button-text="Ajouter la convention" :loading="conventionStore.loading" @submit="handleAddConvention" />
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { useConventionStore } from '~/stores/conventions';
import { useRouter } from 'vue-router';
import ConventionForm from '~/components/convention/ConventionForm.vue';
import type { Edition } from '~/types';

// Protéger cette page avec le middleware d'authentification
definePageMeta({
  middleware: 'auth-client'
});

const conventionStore = useConventionStore();
const toast = useToast();
const router = useRouter();

const handleAddConvention = async (formData: Edition) => {
  try {
    await conventionStore.addConvention(formData);
    toast.add({ title: 'Convention ajoutée avec succès !', icon: 'i-heroicons-check-circle', color: 'success' });
    router.push('/');
  } catch (e: unknown) {
    toast.add({ title: e.statusMessage || "Échec de l'ajout de la convention", icon: 'i-heroicons-x-circle', color: 'error' });
  }
};
</script>