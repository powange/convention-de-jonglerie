<template>
  <UContainer class="flex justify-center py-16">
    <div class="w-full max-w-md">
      <div class="mb-8 text-center">
        <h1 class="text-2xl font-bold">Connexion</h1>
        <p class="mt-1 text-sm text-muted">Accédez à votre espace d'organisation.</p>
      </div>

      <UCard>
        <UForm :state="state" :schema="schema" class="space-y-5" @submit="onSubmit">
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

          <UFormField label="Mot de passe" name="password">
            <UInput
              v-model="state.password"
              type="password"
              autocomplete="current-password"
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
            label="Se connecter"
            icon="i-heroicons-arrow-right-on-rectangle"
          />
        </UForm>
      </UCard>

      <p class="mt-6 text-center text-sm text-muted">
        Pas encore de compte ?
        <ULink to="/register" class="text-primary font-medium">Créer un compte</ULink>
      </p>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
import { z } from 'zod'

definePageMeta({ middleware: 'guest-only' })
useSeoMeta({ title: 'Connexion — EventOrga' })

const toast = useToast()
const { fetch: refreshSession } = useUserSession()

const schema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})

const state = reactive({ email: '', password: '' })
const loading = ref(false)

async function onSubmit() {
  loading.value = true
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: { ...state } })
    await refreshSession()
    toast.add({ title: 'Connexion réussie', icon: 'i-heroicons-check-circle', color: 'success' })
    await navigateTo('/dashboard')
  } catch (err: any) {
    toast.add({
      title: err?.data?.statusMessage || 'Identifiants invalides',
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}
</script>
