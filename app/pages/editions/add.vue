<template>
  <div class="max-w-6xl mx-auto">
    <UCard>
      <template #header>
        <h1 class="text-2xl font-bold">Ajouter une nouvelle édition</h1>
      </template>
      <EditionForm 
        submit-button-text="Ajouter l'édition" 
        :loading="editionStore.loading" 
        :initial-data="initialData"
        @submit="handleAddEdition" 
      />
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { useEditionStore } from '~/stores/editions';
import { useRouter, useRoute } from 'vue-router';
import EditionForm from '~/components/edition/EditionForm.vue';
import type { Edition } from '~/types';
import { computed } from 'vue';

// Protéger cette page avec le middleware d'authentification
definePageMeta({
  middleware: 'auth-protected'
});

const editionStore = useEditionStore();
const toast = useToast();
const router = useRouter();
const route = useRoute();

// Pré-remplir avec la convention si passée en paramètre
const initialData = computed(() => {
  const conventionId = route.query.conventionId;
  if (conventionId) {
    return {
      conventionId: parseInt(conventionId as string)
    };
  }
  return undefined;
});

const handleAddEdition = async (formData: Edition) => {
  try {
    await editionStore.addEdition(formData);
    toast.add({ title: 'Édition ajoutée avec succès !', icon: 'i-heroicons-check-circle', color: 'success' });
    router.push('/');
  } catch (e: unknown) {
    toast.add({ title: e.statusMessage || "Échec de l'ajout de l'édition", icon: 'i-heroicons-x-circle', color: 'error' });
  }
};
</script>