<template>
  <UAlert
    icon="i-heroicons-exclamation-triangle"
    color="warning"
    variant="subtle"
    :title="t('errors.chunk_load_failed_title')"
    :description="t('errors.chunk_load_failed_description')"
  >
    <template #actions>
      <UButton
        color="warning"
        variant="solid"
        size="sm"
        icon="i-heroicons-arrow-path"
        :label="t('common.retry')"
        @click="emit('reessayer')"
      />
    </template>
  </UAlert>
</template>

<script setup lang="ts">
/**
 * « Ce bloc n'a pas pu être chargé » — à la place d'une page d'erreur complète.
 *
 * ⚠️ POURQUOI CE COMPOSANT EXISTE. Un composant chargé à la demande dont la bribe n'arrive pas
 * faisait disparaître toute la page : sur l'accueil, la carte manquante emportait la liste des
 * conventions, sous un « 500 Internal Server Error » qui ne venait d'aucun serveur. Il s'emploie
 * dans le slot `#error` d'un `<NuxtErrorBoundary>`, autour d'un composant construit avec
 * `composantDiffere()` — voir `app/utils/composant-differe.ts` pour le détail du défaut.
 *
 * 📍 L'ÉVÉNEMENT PLUTÔT QU'UN RECHARGEMENT. `reessayer` est émis, et l'appelant y branche le
 * `clear` de la frontière : Vue remonte alors le composant et REJOUE l'`import()` — la demande
 * échouée n'est pas mise en cache. Un `window.location.reload()` aurait aussi marché, en faisant
 * repayer au visiteur le chargement de toute la page, et en perdant ses filtres en cours.
 */
const { t } = useI18n()

const emit = defineEmits<{ reessayer: [] }>()
</script>
