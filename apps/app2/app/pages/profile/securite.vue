<template>
  <div class="space-y-8">
    <ProfileHeader />

    <UCard>
      <template #header>
        <div class="flex items-center gap-3">
          <UIcon name="i-heroicons-key" class="size-5 text-primary" />
          <div>
            <h2 class="font-semibold">
              {{ profil?.hasPassword ? 'Changer mon mot de passe' : 'Définir un mot de passe' }}
            </h2>
            <p class="text-sm text-muted">
              {{
                profil?.hasPassword
                  ? 'Saisissez votre mot de passe actuel, puis le nouveau.'
                  : 'Votre compte a été créé avec Google ou Facebook. Un mot de passe vous permettra aussi de vous connecter avec votre adresse e-mail.'
              }}
            </p>
          </div>
        </div>
      </template>

      <USkeleton v-if="!profil" class="h-48 w-full" />
      <UForm v-else :schema="schema" :state="etat" class="space-y-4" @submit="changer()">
        <UFormField
          v-if="profil.hasPassword"
          label="Mot de passe actuel"
          name="currentPassword"
          required
        >
          <UInput
            v-model="etat.currentPassword"
            type="password"
            autocomplete="current-password"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Nouveau mot de passe" name="newPassword" required>
          <UInput
            v-model="etat.newPassword"
            type="password"
            autocomplete="new-password"
            class="w-full"
          />
        </UFormField>
        <ul v-if="etat.newPassword" class="space-y-1 text-sm">
          <li
            v-for="regle in regles"
            :key="regle.cle"
            class="flex items-center gap-2"
            :class="regle.satisfaite ? 'text-success' : 'text-muted'"
          >
            <UIcon
              :name="regle.satisfaite ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'"
              class="size-4"
            />
            {{ $t(regle.cleLibelle) }}
          </li>
        </ul>
        <UFormField label="Confirmer le nouveau mot de passe" name="confirmation" required>
          <UInput
            v-model="etat.confirmation"
            type="password"
            autocomplete="new-password"
            class="w-full"
          />
        </UFormField>
        <div class="flex justify-end">
          <UButton
            type="submit"
            :label="profil.hasPassword ? 'Changer le mot de passe' : 'Définir le mot de passe'"
            icon="i-heroicons-check"
            :loading="loading"
          />
        </div>
      </UForm>
    </UCard>

    <UCard v-if="profil">
      <template #header>
        <div class="flex items-center gap-3">
          <UIcon name="i-heroicons-link" class="size-5 text-primary" />
          <h2 class="font-semibold">Comptes liés</h2>
        </div>
      </template>
      <ul class="space-y-3">
        <li class="flex items-center justify-between gap-4">
          <span class="flex items-center gap-2"
            ><UIcon name="i-simple-icons-google" class="size-5" /> Google</span
          >
          <UBadge
            :color="profil.googleLinked ? 'success' : 'neutral'"
            variant="subtle"
            :label="profil.googleLinked ? 'Lié' : 'Non lié'"
          />
        </li>
        <li class="flex items-center justify-between gap-4">
          <span class="flex items-center gap-2"
            ><UIcon name="i-simple-icons-facebook" class="size-5" /> Facebook</span
          >
          <UBadge
            :color="profil.facebookLinked ? 'success' : 'neutral'"
            variant="subtle"
            :label="profil.facebookLinked ? 'Lié' : 'Non lié'"
          />
        </li>
      </ul>
      <p class="mt-4 text-sm text-muted">
        Un compte se lie en vous connectant une fois avec ce service, s'il utilise la même adresse
        e-mail.
      </p>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { z } from 'zod'

import { evaluerReglesMotDePasse, schemaMotDePasse } from '#auth/shared/utils/regles-mot-de-passe'

definePageMeta({ layout: 'profile', middleware: 'auth' })
useSeoMeta({ title: 'Sécurité — Flowvent' })

const { data: profil, refresh } = await useProfil()

const etat = reactive({ currentPassword: '', newPassword: '', confirmation: '' })

// Mêmes règles que le serveur et que l'inscription : le module partagé du layer d'auth.
const schema = computed(() =>
  z
    .object({
      currentPassword: profil.value?.hasPassword
        ? z.string().min(1, 'Mot de passe actuel requis')
        : z.string().optional(),
      newPassword: schemaMotDePasse(),
      confirmation: z.string(),
    })
    .refine((v) => v.newPassword === v.confirmation, {
      message: 'Les deux mots de passe ne correspondent pas',
      path: ['confirmation'],
    })
)

const regles = computed(() => evaluerReglesMotDePasse(etat.newPassword))

const { execute: changer, loading } = useApiAction('/api/profile/change-password', {
  method: 'POST',
  body: () => ({ currentPassword: etat.currentPassword, newPassword: etat.newPassword }),
  successMessage: { title: 'Mot de passe enregistré' },
  onSuccess: async () => {
    etat.currentPassword = ''
    etat.newPassword = ''
    etat.confirmation = ''
    await refresh()
  },
})
</script>
