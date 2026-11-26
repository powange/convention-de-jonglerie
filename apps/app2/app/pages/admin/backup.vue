<template>
  <UContainer class="py-10">
    <AdminNav />
    <div class="mb-6">
      <h2 class="flex items-center gap-2 text-xl font-semibold">
        <UIcon name="i-heroicons-circle-stack" class="text-primary" />
        {{ $t('admin.backup_management') }}
      </h2>
      <p class="mt-1 text-sm text-muted">{{ $t('admin.backup_management_description') }}</p>
    </div>
    <!-- Le corps vient du layer backup, partagé avec app1. -->
    <AdminGestionDesSauvegardes />
  </UContainer>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['admin'] })
useSeoMeta({ title: 'Base de données — Administration Flowvent' })
</script>
