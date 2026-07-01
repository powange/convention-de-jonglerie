<template>
  <UContainer class="max-w-2xl py-10">
    <UButton
      to="/dashboard"
      variant="link"
      color="neutral"
      icon="i-heroicons-arrow-left"
      label="Retour"
      class="-ml-2 mb-4"
    />
    <h1 class="mb-6 text-2xl font-bold">Créer un événement</h1>

    <UCard>
      <UForm :state="state" :schema="schema" class="space-y-5" @submit="onSubmit">
        <UFormField label="Nom de l'événement" name="name" required>
          <UInput v-model="state.name" placeholder="Festival de jonglerie 2026" class="w-full" />
        </UFormField>

        <UFormField label="Description" name="description">
          <UTextarea
            v-model="state.description"
            :rows="4"
            placeholder="Décrivez votre événement…"
            class="w-full"
          />
        </UFormField>

        <div class="grid gap-5 sm:grid-cols-2">
          <UFormField label="Lieu" name="location">
            <UInput
              v-model="state.location"
              placeholder="Ville, salle…"
              icon="i-heroicons-map-pin"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Date de début" name="startDate">
            <UInput v-model="state.startDate" type="date" class="w-full" />
          </UFormField>
        </div>

        <div class="flex justify-end gap-2">
          <UButton to="/dashboard" color="neutral" variant="ghost" label="Annuler" />
          <UButton
            type="submit"
            :loading="loading"
            label="Créer l'événement"
            icon="i-heroicons-check"
          />
        </div>
      </UForm>
    </UCard>
  </UContainer>
</template>

<script setup lang="ts">
import { z } from 'zod'

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Nouvel événement — EventOrga' })

const toast = useToast()

const schema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(200),
  description: z.string().max(2000).optional(),
  location: z.string().max(200).optional(),
  startDate: z.string().optional(),
})

const state = reactive({ name: '', description: '', location: '', startDate: '' })
const loading = ref(false)

async function onSubmit() {
  loading.value = true
  try {
    const res = await $fetch('/api/events', {
      method: 'POST',
      body: {
        name: state.name,
        description: state.description || undefined,
        location: state.location || undefined,
        startDate: state.startDate || undefined,
      },
    })
    toast.add({ title: 'Événement créé', icon: 'i-heroicons-check-circle', color: 'success' })
    await navigateTo(`/events/${res.event.id}`)
  } catch (err: any) {
    toast.add({
      title: err?.data?.statusMessage || "Impossible de créer l'événement",
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}
</script>
