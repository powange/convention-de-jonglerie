<template>
  <div class="space-y-8">
    <ProfileHeader />

    <UCard>
      <template #header>
        <div class="flex items-center gap-3">
          <UIcon name="i-heroicons-user" class="size-5 text-primary" />
          <div>
            <h2 class="font-semibold">Informations personnelles</h2>
            <p class="text-sm text-muted">Votre identité sur Flowvent.</p>
          </div>
        </div>
      </template>

      <USkeleton v-if="!profil" class="h-48 w-full" />
      <UForm v-else :schema="schema" :state="etat" class="space-y-4" @submit="enregistrer()">
        <UFormField label="Pseudo" name="pseudo" required>
          <UInput v-model="etat.pseudo" icon="i-heroicons-at-symbol" class="w-full" />
        </UFormField>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Prénom" name="prenom" required>
            <UInput v-model="etat.prenom" class="w-full" />
          </UFormField>
          <UFormField label="Nom" name="nom" required>
            <UInput v-model="etat.nom" class="w-full" />
          </UFormField>
        </div>
        <UFormField
          label="Adresse e-mail"
          name="email"
          help="L'adresse ne se modifie pas encore depuis Flowvent : écrivez-nous si vous devez la changer."
        >
          <UInput :model-value="profil.email" disabled icon="i-heroicons-envelope" class="w-full" />
        </UFormField>

        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            label="Annuler"
            :disabled="!modifie || loading"
            @click="reinitialiser()"
          />
          <UButton
            type="submit"
            label="Enregistrer"
            icon="i-heroicons-check"
            :loading="loading"
            :disabled="!modifie"
          />
        </div>
      </UForm>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { z } from 'zod'

definePageMeta({ layout: 'profile', middleware: 'auth' })
useSeoMeta({ title: 'Informations personnelles — Flowvent' })

const { data: profil, refresh } = await useProfil()
const { fetch: rafraichirSession } = useUserSession()

// Mêmes règles que le serveur (server/api/profile/update.put.ts).
const schema = z.object({
  pseudo: z.string().trim().min(3, 'Au moins 3 caractères').max(50, '50 caractères au plus'),
  prenom: z.string().trim().min(1, 'Le prénom est requis').max(100),
  nom: z.string().trim().min(1, 'Le nom est requis').max(100),
})

const etat = reactive({ pseudo: '', prenom: '', nom: '' })

function reinitialiser() {
  etat.pseudo = profil.value?.pseudo ?? ''
  etat.prenom = profil.value?.prenom ?? ''
  etat.nom = profil.value?.nom ?? ''
}
watch(profil, reinitialiser, { immediate: true })

const modifie = computed(
  () =>
    !!profil.value &&
    (etat.pseudo !== profil.value.pseudo ||
      etat.prenom !== (profil.value.prenom ?? '') ||
      etat.nom !== (profil.value.nom ?? ''))
)

const { execute: enregistrer, loading } = useApiAction('/api/profile/update', {
  method: 'PUT',
  body: () => ({ ...etat }),
  successMessage: { title: 'Profil mis à jour' },
  // Le pseudo apparaît dans le menu, qui lit la session : la recharger après l'écriture.
  onSuccess: async () => {
    await Promise.all([refresh(), rafraichirSession()])
  },
})
</script>
