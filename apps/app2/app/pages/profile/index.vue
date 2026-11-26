<template>
  <div class="space-y-8">
    <ProfileHeader />

    <!-- Catégories (bénévole, artiste, organisateur) : un appel à spectacles exige « Artiste », et
         sa page renvoie ici pour l'activer. Même carte qu'app1 (layer d'auth). -->
    <ProfileUserCategoriesCard />

    <div v-if="profil" class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <UCard>
        <template #header>
          <div class="flex items-center gap-3">
            <UIcon name="i-heroicons-calendar-days" class="size-5 text-primary" />
            <h2 class="font-semibold">Mes événements</h2>
          </div>
        </template>
        <p class="text-3xl font-bold">{{ profil.eventsCount }}</p>
        <p class="text-sm text-muted">
          {{ profil.eventsCount > 1 ? 'événements créés' : 'événement créé' }}
        </p>
        <template #footer>
          <UButton
            to="/dashboard"
            variant="link"
            color="primary"
            trailing-icon="i-heroicons-arrow-right"
            label="Tableau de bord"
            class="px-0"
          />
        </template>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex items-center gap-3">
            <UIcon name="i-heroicons-credit-card" class="size-5 text-primary" />
            <h2 class="font-semibold">Mon abonnement</h2>
          </div>
        </template>
        <template v-if="abonnementActif">
          <UBadge color="success" variant="subtle" :label="libelleFormule" />
          <p class="mt-2 text-sm text-muted">Actif jusqu'au {{ dateFin }}</p>
        </template>
        <p v-else class="text-sm text-muted">Aucun abonnement actif.</p>
        <template #footer>
          <UButton
            to="/pricing"
            variant="link"
            color="primary"
            trailing-icon="i-heroicons-arrow-right"
            :label="abonnementActif ? 'Gérer mon abonnement' : 'Voir les offres'"
            class="px-0"
          />
        </template>
      </UCard>

      <UCard class="md:col-span-2">
        <template #header>
          <div class="flex items-center gap-3">
            <UIcon name="i-heroicons-link" class="size-5 text-primary" />
            <h2 class="font-semibold">Connexion à votre compte</h2>
          </div>
        </template>
        <div class="flex flex-wrap gap-2">
          <UBadge
            :color="profil.hasPassword ? 'success' : 'neutral'"
            variant="subtle"
            icon="i-heroicons-key"
            :label="profil.hasPassword ? 'Mot de passe défini' : 'Pas de mot de passe'"
          />
          <UBadge
            v-if="profil.googleLinked"
            color="success"
            variant="subtle"
            icon="i-simple-icons-google"
            label="Google lié"
          />
          <UBadge
            v-if="profil.facebookLinked"
            color="success"
            variant="subtle"
            icon="i-simple-icons-facebook"
            label="Facebook lié"
          />
        </div>
        <template #footer>
          <div class="flex flex-wrap gap-4">
            <UButton
              to="/profile/informations"
              variant="link"
              color="primary"
              icon="i-heroicons-user"
              label="Modifier mes informations"
              class="px-0"
            />
            <UButton
              to="/profile/securite"
              variant="link"
              color="primary"
              icon="i-heroicons-shield-check"
              label="Sécurité du compte"
              class="px-0"
            />
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'profile', middleware: 'auth' })
useSeoMeta({ title: 'Mon profil — Flowvent' })

const { data: profil } = await useProfil()

const abonnementActif = computed(
  () =>
    profil.value?.subscription?.status === 'active' &&
    new Date(profil.value.subscription.currentPeriodEnd) > new Date()
)
const libelleFormule = computed(() =>
  profil.value?.subscription?.plan === 'annual' ? 'Formule annuelle' : 'Formule mensuelle'
)
const dateFin = computed(() =>
  profil.value?.subscription
    ? new Date(profil.value.subscription.currentPeriodEnd).toLocaleDateString('fr-FR')
    : ''
)
</script>
