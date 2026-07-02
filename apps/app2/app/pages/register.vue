<template>
  <UContainer class="flex justify-center py-16">
    <div class="w-full max-w-md">
      <div class="mb-8 text-center">
        <h1 class="text-2xl font-bold">Créer un compte</h1>
        <p class="mt-1 text-sm text-muted">Quelques secondes suffisent pour démarrer.</p>
      </div>

      <UCard>
        <UForm :state="state" :schema="schema" class="space-y-5" @submit="onSubmit">
          <UFormField label="Nom (optionnel)" name="name">
            <UInput
              v-model="state.name"
              placeholder="Votre nom"
              icon="i-heroicons-user"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Email" name="email">
            <UInput
              v-model="state.email"
              type="email"
              autocomplete="email"
              placeholder="vous@exemple.com"
              icon="i-heroicons-envelope"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Mot de passe" name="password" hint="8 caractères minimum">
            <UInput
              v-model="state.password"
              type="password"
              autocomplete="new-password"
              placeholder="••••••••"
              icon="i-heroicons-lock-closed"
              class="w-full"
            />
          </UFormField>

          <UButton
            type="submit"
            block
            size="lg"
            :loading="loading"
            label="Créer mon compte"
            icon="i-heroicons-user-plus"
          />
        </UForm>
      </UCard>

      <p class="mt-6 text-center text-sm text-muted">
        Déjà un compte ?
        <ULink to="/login" class="text-primary font-medium">Se connecter</ULink>
      </p>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
import { z } from 'zod'

definePageMeta({ middleware: 'guest-only' })
useSeoMeta({ title: 'Créer un compte — Flowvent' })

const toast = useToast()
const { fetch: refreshSession } = useUserSession()

const schema = z.object({
  name: z.string().trim().max(120).optional(),
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
})

const state = reactive({ name: '', email: '', password: '' })
const loading = ref(false)

async function onSubmit() {
  loading.value = true
  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: {
        email: state.email,
        password: state.password,
        name: state.name || undefined,
      },
    })
    await refreshSession()
    toast.add({ title: 'Compte créé', icon: 'i-heroicons-check-circle', color: 'success' })
    await navigateTo('/dashboard')
  } catch (err: any) {
    toast.add({
      title: err?.data?.statusMessage || 'Impossible de créer le compte',
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}
</script>
