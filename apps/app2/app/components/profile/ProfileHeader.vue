<template>
  <div class="rounded-2xl bg-elevated p-6 sm:p-8">
    <USkeleton v-if="!profil" class="h-24 w-full" />
    <div v-else class="flex flex-row items-center gap-6">
      <!-- La photo déposée ici, ou reprise de Google / Facebook ; sinon les initiales. -->
      <div class="relative shrink-0">
        <UiUserAvatar :user="profil" :size="96" border class="shadow-lg" />
        <UTooltip text="Changer la photo de profil">
          <UButton
            aria-label="Changer la photo de profil"
            icon="i-heroicons-camera"
            size="sm"
            color="primary"
            class="absolute -right-1 -bottom-1 rounded-full shadow-lg"
            @click="ouvrir"
          />
        </UTooltip>
      </div>
      <div class="min-w-0 flex-1">
        <h1 class="mb-2 text-2xl font-bold sm:text-3xl">
          Bonjour {{ profil.prenom || profil.pseudo }} !
        </h1>
        <p class="flex items-center gap-2 text-sm text-muted">
          <UIcon name="i-heroicons-calendar-days" class="size-4" />
          Membre depuis {{ membreDepuis }}
        </p>
        <p class="mt-1 flex items-center gap-2 truncate text-sm text-muted">
          <UIcon name="i-heroicons-envelope" class="size-4" />
          {{ profil.email }}
        </p>
      </div>
    </div>

    <UModal
      v-model:open="fenetreOuverte"
      title="Photo de profil"
      description="Elle apparaît dans le menu, sur vos candidatures et aux organisateurs de vos événements."
      :dismissible="!modifiee"
    >
      <template #body>
        <div class="space-y-6">
          <div class="flex justify-center">
            <UiUserAvatar v-if="apercu" :user="apercu" :size="128" border class="shadow-xl" />
          </div>
          <UiImageUpload
            v-model="photo"
            :endpoint="{ type: 'profile', id: profil?.id }"
            :options="{
              validation: {
                maxSize: 5 * 1024 * 1024,
                allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
                allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
              },
              resetAfterUpload: false,
            }"
            alt="Photo de profil"
            placeholder="Choisissez une photo (JPEG, PNG ou WebP, 5 Mo au plus)"
            :allow-delete="!!profil?.profilePicture"
            @uploaded="(r: { imageUrl?: string }) => r.imageUrl && (photo = r.imageUrl)"
            @deleted="photo = ''"
          />
          <p v-if="repriseDuCompteLie" class="text-xs text-muted">
            Sans photo déposée ici, celle de votre compte Google ou Facebook est reprise à la
            prochaine connexion par ce compte.
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            label="Annuler"
            :disabled="loading"
            @click="fermer"
          />
          <UButton
            icon="i-heroicons-check"
            :label="photo ? 'Enregistrer la photo' : 'Retirer la photo'"
            :loading="loading"
            :disabled="!modifiee"
            @click="execute"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
/**
 * En-tête de l'espace « Mon profil », avec le changement de photo — même circuit qu'app1 : le
 * fichier est déposé dans un dossier temporaire (`UiImageUpload` → POST /api/files/profile), puis
 * rendu définitif à l'enregistrement (PUT /api/profile/update). Fermer sans enregistrer laisse le
 * dépôt à la tâche de nettoyage horaire.
 */
const { data: profil, refresh } = useProfil()

/** La photo choisie dans la fenêtre : URL temporaire d'un dépôt, valeur en base, ou '' (retrait). */
const photo = ref('')
const fenetreOuverte = ref(false)

const modifiee = computed(() => photo.value !== (profil.value?.profilePicture ?? ''))
const apercu = computed(() =>
  profil.value ? { ...profil.value, profilePicture: photo.value || null } : null
)
const repriseDuCompteLie = computed(
  () => !photo.value && !!(profil.value?.googleLinked || profil.value?.facebookLinked)
)

function ouvrir() {
  photo.value = profil.value?.profilePicture ?? ''
  fenetreOuverte.value = true
}
function fermer() {
  fenetreOuverte.value = false
}

// Le profil exige pseudo, prénom et nom : on renvoie ceux en place, seule la photo change.
const { execute, loading } = useApiAction('/api/profile/update', {
  method: 'PUT',
  body: () => ({
    pseudo: profil.value?.pseudo,
    prenom: profil.value?.prenom,
    nom: profil.value?.nom,
    profilePicture: photo.value || null,
  }),
  successMessage: { title: 'Photo de profil enregistrée' },
  errorMessages: { default: "La photo n'a pas pu être enregistrée, réessayez" },
  onSuccess: async () => {
    // `refresh` met à jour toutes les vues du profil, en-tête du site compris (même clé).
    await refresh()
    fenetreOuverte.value = false
  },
})

const membreDepuis = computed(() =>
  profil.value
    ? new Date(profil.value.createdAt).toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric',
      })
    : ''
)
</script>
