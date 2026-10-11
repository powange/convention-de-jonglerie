<template>
  <div class="space-y-8">
    <UCard class="shadow-lg border-0">
      <template #header>
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center"
          >
            <UIcon name="i-heroicons-user" class="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
              {{ $t('profile.personal_info') }}
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ $t('profile.manage_profile_info') }}
            </p>
          </div>
        </div>
      </template>

      <!-- Le formulaire est pré-rempli depuis le store d'auth (client-only) →
           ClientOnly évite un mismatch d'hydratation sur les valeurs des champs. -->
      <ClientOnly>
        <UForm :state="state" :schema="schema" @submit="updateProfile">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <!-- Colonne 1 : Pseudo et email -->
            <div class="space-y-6">
              <UFormField
                :label="t('auth.username')"
                name="pseudo"
                :help="t('profile.username_help')"
              >
                <UInput
                  v-model="state.pseudo"
                  icon="i-heroicons-at-symbol"
                  required
                  :placeholder="t('profile.username_placeholder')"
                  size="lg"
                  class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]"
                />
              </UFormField>

              <UFormField :label="t('common.email')" name="email">
                <UInput
                  v-model="state.email"
                  type="email"
                  icon="i-heroicons-envelope"
                  required
                  placeholder="votre.email@example.com"
                  size="lg"
                  class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]"
                />
              </UFormField>

              <!--
                ⚠️ LE MOT DE PASSE N'EST DEMANDÉ QUE SI L'ADRESSE CHANGE — constat B2. Le réclamer
                pour enregistrer un prénom serait une friction que rien ne justifie ; le réclamer
                pour l'adresse, si : c'est elle qui permet de reprendre la main sur un compte, donc
                la cible d'une session volée.
              -->
              <UFormField
                v-if="adresseModifiee && compteAvecMotDePasse"
                :label="t('profile.current_password_for_email')"
                name="currentPassword"
                :description="t('profile.current_password_for_email_help')"
              >
                <UInput
                  v-model="state.currentPassword"
                  type="password"
                  icon="i-heroicons-lock-closed"
                  size="lg"
                  data-mot-de-passe-adresse
                />
              </UFormField>

              <!-- La demande en cours, et le code à saisir. -->
              <UAlert
                v-if="adresseEnAttente"
                data-adresse-en-attente
                color="warning"
                variant="soft"
                icon="i-heroicons-envelope-open"
                :title="t('profile.pending_email_title')"
                :description="t('profile.pending_email_description', { email: adresseEnAttente })"
              />
              <div v-if="adresseEnAttente" class="flex flex-col sm:flex-row gap-2">
                <UInput
                  v-model="codeDeConfirmation"
                  :placeholder="t('profile.pending_email_code_placeholder')"
                  size="lg"
                  class="flex-1"
                  data-code-adresse
                />
                <UButton
                  :loading="confirmationEnCours"
                  :disabled="!codeDeConfirmation.trim()"
                  icon="i-heroicons-check"
                  @click="confirmerLAdresse()"
                >
                  {{ t('profile.pending_email_confirm') }}
                </UButton>
                <UButton
                  variant="ghost"
                  color="neutral"
                  :loading="renvoiEnCours"
                  icon="i-heroicons-arrow-path"
                  @click="renvoyerLeCode()"
                >
                  {{ t('profile.pending_email_resend') }}
                </UButton>
              </div>
            </div>

            <!-- Colonne 2 : Informations facultatives -->
            <div
              class="border border-gray-100 dark:border-gray-700 rounded-xl p-5 space-y-6 bg-gray-50/50 dark:bg-gray-800/30"
            >
              <div class="flex items-center gap-2 mb-2">
                <UIcon name="i-heroicons-adjustments-horizontal" class="w-5 h-5 text-gray-500" />
                <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ t('profile.optional_section_title') }}
                </h3>
                <UBadge variant="soft" color="neutral" size="xs">{{ t('common.optional') }}</UBadge>
              </div>

              <UFormField
                :label="t('profile.pronouns')"
                name="pronouns"
                :help="t('profile.pronouns_help')"
              >
                <USelect
                  v-model="state.pronouns"
                  icon="i-heroicons-user"
                  :items="pronounsOptions"
                  size="lg"
                  :ui="{ content: 'min-w-(--reka-select-trigger-width) w-auto' }"
                />
              </UFormField>

              <UFormField :label="t('auth.first_name')" name="prenom">
                <UInput
                  v-model="state.prenom"
                  icon="i-heroicons-user"
                  :placeholder="t('profile.first_name_placeholder')"
                  size="lg"
                  class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]"
                />
              </UFormField>

              <UFormField :label="t('auth.last_name')" name="nom">
                <UInput
                  v-model="state.nom"
                  icon="i-heroicons-user"
                  :placeholder="t('profile.last_name_placeholder')"
                  size="lg"
                  class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]"
                />
              </UFormField>

              <UFormField :label="t('profile.phone')" name="telephone">
                <UiPhoneInput
                  v-model="state.telephone"
                  :placeholder="t('profile.phone_placeholder')"
                  size="lg"
                />
              </UFormField>

              <UFormField :label="t('profile.preferred_language')" name="preferredLanguage">
                <USelect
                  v-model="state.preferredLanguage"
                  icon="i-heroicons-language"
                  :items="languageOptions"
                  size="lg"
                  class="transition-all duration-200 focus-within:transform focus-within:scale-[1.02]"
                />
              </UFormField>
            </div>
          </div>

          <!-- Santé et contact d'urgence : facultatif, et proposé à tout le monde.
               Ces informations servent aux organisateurs qui préparent les repas ou doivent
               joindre quelqu'un en cas de pépin ; les renseigner ici évite de les ressaisir. -->
          <USeparator class="my-8" />

          <div class="space-y-6">
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t('profile.health.title') }}
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {{ t('profile.health.description') }}
              </p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div class="space-y-6">
                <UFormField :label="t('profile.health.diet')" name="dietaryPreference">
                  <USelect
                    v-model="state.dietaryPreference"
                    :items="dietOptions"
                    size="lg"
                    class="w-full"
                  />
                </UFormField>

                <UFormField
                  :label="t('profile.health.allergies')"
                  name="allergies"
                  :help="t('profile.health.allergies_help')"
                >
                  <UTextarea
                    v-model="state.allergies"
                    :rows="3"
                    :maxlength="1000"
                    :placeholder="t('profile.health.allergies_placeholder')"
                    class="w-full"
                  />
                </UFormField>

                <!-- Proposée seulement quand une allergie est décrite : sans allergie, une
                     gravité ne veut rien dire. Elle reste facultative — un profil se complète
                     à son rythme, il n'a pas à réclamer la suite dès le premier mot. -->
                <UFormField
                  v-if="state.allergies.trim()"
                  :label="t('profile.health.allergy_severity')"
                  name="allergySeverity"
                >
                  <USelect
                    v-model="state.allergySeverity"
                    :items="severityOptions"
                    size="lg"
                    class="w-full"
                  />
                </UFormField>
              </div>

              <div class="space-y-6">
                <UFormField
                  :label="t('profile.health.emergency_contact_name')"
                  name="emergencyContactName"
                  :help="t('profile.health.emergency_contact_help')"
                >
                  <UInput
                    v-model="state.emergencyContactName"
                    :placeholder="t('profile.health.emergency_contact_name_placeholder')"
                    size="lg"
                    class="w-full"
                  />
                </UFormField>

                <UFormField
                  :label="t('profile.health.emergency_contact_phone')"
                  name="emergencyContactPhone"
                >
                  <UiPhoneInput
                    v-model="state.emergencyContactPhone"
                    :placeholder="t('profile.health.emergency_contact_phone_placeholder')"
                    size="lg"
                  />
                </UFormField>
              </div>
            </div>
          </div>

          <!-- Actions avec indicateur de modifications -->
          <div class="mt-8">
            <div
              v-if="hasChanges"
              class="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg"
            >
              <div class="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4" />
                <span class="text-sm font-medium">{{ $t('profile.unsaved_changes') }}</span>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row gap-3 justify-between">
              <UButton
                type="submit"
                :loading="loading"
                :disabled="!hasChanges"
                icon="i-heroicons-check"
                color="primary"
                size="lg"
                class="transition-all duration-200 hover:transform hover:scale-105"
              >
                {{ loading ? t('profile.saving') : t('profile.save_changes') }}
              </UButton>

              <UButton
                v-if="hasChanges"
                type="button"
                variant="outline"
                color="neutral"
                size="lg"
                icon="i-heroicons-arrow-path"
                class="transition-all duration-200 hover:transform hover:scale-105"
                @click="resetForm"
              >
                {{ $t('common.cancel') }}
              </UButton>
            </div>
          </div>
        </UForm>
      </ClientOnly>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { z } from 'zod'

import { useAuthStore } from '~/stores/auth'
import type { User } from '~/types'
import { getAllergySeveritySelectOptions } from '~/utils/allergy-severity'
import { LOCALES_CONFIG } from '~/utils/locales'
import { USER_PRONOUNS, PRONOUN_NONE } from '~/utils/pronouns'

definePageMeta({
  layout: 'profile',
  middleware: 'auth-protected',
})

const authStore = useAuthStore()
const { t } = useI18n()

const languageOptions = LOCALES_CONFIG.map((locale) => ({
  value: locale.code,
  label: locale.name,
}))

const DIETS = ['NONE', 'VEGETARIAN', 'VEGAN'] as const

/**
 * Marque « gravité non précisée ».
 *
 * Volontairement pas la chaîne vide : Nuxt UI la réserve à « aucune sélection » et refuse tout
 * `SelectItem` qui la porte comme valeur. Une option visible et sélectionnable a besoin d'une
 * valeur à elle ; la conversion vers `null` se fait au moment de l'envoi.
 */
const SEVERITE_AUCUNE = 'UNSET'

const dietOptions = computed(() =>
  DIETS.map((value) => ({ value, label: t(`profile.health.diet_options.${value}`) }))
)

// « Non précisée » d'abord : la gravité reste facultative, et il faut pouvoir revenir en
// arrière après l'avoir renseignée une fois.
const severityOptions = computed(() => [
  { value: SEVERITE_AUCUNE, label: t('profile.health.severity_unset') },
  // Les libellés du helper sont des CLÉS de traduction, pas du texte : les passer tels quels
  // afficherait « edition.volunteers.allergy_severity_light_short » à l'écran.
  ...getAllergySeveritySelectOptions().map((o) => ({ value: o.value, label: t(o.label) })),
])

const pronounsOptions = computed(() => [
  { value: PRONOUN_NONE, label: t('profile.pronouns_none') },
  ...USER_PRONOUNS.map((p) => ({ value: p, label: t(`common.pronouns_options.${p}`) })),
])

const schema = z.object({
  email: z.string().email(t('errors.invalid_email')),
  pseudo: z.string().min(3, t('profile.username_min_3')),
  nom: z.string().optional(),
  prenom: z.string().optional(),
  telephone: z
    .string()
    .optional()
    .refine((val) => !val || /^\+?[0-9\s\-()]+$/.test(val), t('errors.invalid_phone_number')),
  pronouns: z.string().optional(),
  preferredLanguage: z.string().optional(),
  dietaryPreference: z.string().optional(),
  allergies: z.string().max(1000).optional(),
  allergySeverity: z.string().optional(),
  emergencyContactName: z.string().max(100).optional(),
  emergencyContactPhone: z
    .string()
    .optional()
    .refine((val) => !val || /^\+?[0-9\s\-()]+$/.test(val), t('errors.invalid_phone_number')),
})

const state = reactive({
  email: authStore.user?.email || '',
  pseudo: authStore.user?.pseudo || '',
  nom: (authStore.user as any)?.nom || '',
  prenom: (authStore.user as any)?.prenom || '',
  // Le formulaire envoie `telephone` (nom attendu par l'API), alimenté depuis `phone`,
  // seul champ que le serveur renvoie.
  telephone: authStore.user?.phone || '',
  pronouns: (authStore.user as any)?.pronouns || PRONOUN_NONE,
  preferredLanguage: (authStore.user as any)?.preferredLanguage || 'fr',
  dietaryPreference: (authStore.user as any)?.dietaryPreference || 'NONE',
  allergies: (authStore.user as any)?.allergies || '',
  allergySeverity: (authStore.user as any)?.allergySeverity || SEVERITE_AUCUNE,
  emergencyContactName: (authStore.user as any)?.emergencyContactName || '',
  emergencyContactPhone: (authStore.user as any)?.emergencyContactPhone || '',
  /*
   * Le mot de passe actuel, exigé par le serveur quand l'adresse change — constat B2. Il ne part
   * QUE dans ce cas, et il n'est jamais préchargé ni conservé après l'enregistrement.
   */
  currentPassword: '',
})

/**
 * Le changement d'adresse en deux temps — constat B2.
 *
 * L'adresse ne s'écrit plus à l'enregistrement : le serveur envoie un code à la NOUVELLE adresse et
 * un avis à l'ANCIENNE, puis attend le code. Sans ces quelques lignes, l'écran annoncerait
 * « profil enregistré » et l'ancienne adresse reviendrait dans le champ au rechargement, sans un
 * mot d'explication — la personne croirait son changement refusé en silence.
 */
const adresseEnAttente = ref<string | null>((authStore.user as any)?.pendingEmail ?? null)
const codeDeConfirmation = ref('')
const confirmationEnCours = ref(false)
const renvoiEnCours = ref(false)
/*
 * Un compte OAuth n'a pas de mot de passe : le lui réclamer rendrait le changement d'adresse
 * impossible. Le serveur porte déjà cette nuance ; l'écran ne fait que s'y accorder, et il part de
 * l'hypothèse PRUDENTE (il en a un) le temps de la réponse — un champ qui apparaît est moins
 * déroutant qu'un champ qui disparaît sous les doigts.
 */
const compteAvecMotDePasse = ref(true)
const adresseModifiee = computed(() => state.email.trim() !== (authStore.user?.email || ''))

onMounted(async () => {
  try {
    const reponse = await $fetch<{ data: { hasPassword: boolean } }>('/api/profile/has-password')
    compteAvecMotDePasse.value = reponse.data.hasPassword
  } catch {
    // On garde l'hypothèse prudente : le serveur refusera de toute façon sans mot de passe.
    compteAvecMotDePasse.value = true
  }
})

const notificateur = useNotificateur()

async function confirmerLAdresse() {
  confirmationEnCours.value = true
  try {
    const reponse = await $fetch<{ data: { email: string; emailHash: string } }>(
      '/api/profile/confirm-email',
      { method: 'POST', body: { code: codeDeConfirmation.value.trim() } }
    )
    authStore.updateUser({ ...authStore.user!, ...reponse.data, pendingEmail: null } as any)
    state.email = reponse.data.email
    adresseEnAttente.value = null
    codeDeConfirmation.value = ''
    notificateur.succes(t('profile.pending_email_confirmed'))
  } catch (erreur) {
    notificateur.erreur(
      t('profile.pending_email_confirm_failed'),
      notificateur.messageDErreurServeur(erreur)
    )
  } finally {
    confirmationEnCours.value = false
  }
}

async function renvoyerLeCode() {
  renvoiEnCours.value = true
  try {
    await $fetch('/api/profile/resend-email-change', { method: 'POST' })
    notificateur.succes(t('profile.pending_email_resent'))
  } catch (erreur) {
    notificateur.erreur(
      t('profile.pending_email_resend_failed'),
      notificateur.messageDErreurServeur(erreur)
    )
  } finally {
    renvoiEnCours.value = false
  }
}

const hasChanges = computed(() => {
  return (
    state.email !== (authStore.user?.email || '') ||
    state.pseudo !== (authStore.user?.pseudo || '') ||
    state.nom !== ((authStore.user as any)?.nom || '') ||
    state.prenom !== ((authStore.user as any)?.prenom || '') ||
    state.telephone !== (authStore.user?.phone || '') ||
    (state.pronouns === PRONOUN_NONE ? '' : state.pronouns) !==
      ((authStore.user as any)?.pronouns || '') ||
    state.preferredLanguage !== ((authStore.user as any)?.preferredLanguage || 'fr') ||
    state.dietaryPreference !== ((authStore.user as any)?.dietaryPreference || 'NONE') ||
    state.allergies !== ((authStore.user as any)?.allergies || '') ||
    state.allergySeverity !== ((authStore.user as any)?.allergySeverity || SEVERITE_AUCUNE) ||
    state.emergencyContactName !== ((authStore.user as any)?.emergencyContactName || '') ||
    state.emergencyContactPhone !== ((authStore.user as any)?.emergencyContactPhone || '')
  )
})

const resetForm = () => {
  state.email = authStore.user?.email || ''
  state.pseudo = authStore.user?.pseudo || ''
  state.nom = (authStore.user as any)?.nom || ''
  state.prenom = (authStore.user as any)?.prenom || ''
  state.telephone = (authStore.user as any)?.telephone || (authStore.user as any)?.phone || ''
  state.pronouns = (authStore.user as any)?.pronouns || PRONOUN_NONE
  state.preferredLanguage = (authStore.user as any)?.preferredLanguage || 'fr'
  state.dietaryPreference = (authStore.user as any)?.dietaryPreference || 'NONE'
  state.allergies = (authStore.user as any)?.allergies || ''
  state.allergySeverity = (authStore.user as any)?.allergySeverity || SEVERITE_AUCUNE
  state.emergencyContactName = (authStore.user as any)?.emergencyContactName || ''
  state.emergencyContactPhone = (authStore.user as any)?.emergencyContactPhone || ''
}

const { execute: executeUpdateProfile, loading } = useApiAction<unknown, User>(
  '/api/profile/update',
  {
    method: 'PUT',
    body: () => ({
      email: state.email,
      // Le serveur ne l'exige que si l'adresse change ; on ne l'envoie donc que là.
      ...(adresseModifiee.value && state.currentPassword
        ? { currentPassword: state.currentPassword }
        : {}),
      pseudo: state.pseudo,
      nom: state.nom || '',
      prenom: state.prenom || '',
      telephone: state.telephone || '',
      pronouns: state.pronouns === PRONOUN_NONE ? '' : state.pronouns,
      preferredLanguage: state.preferredLanguage || 'fr',
      dietaryPreference: state.dietaryPreference || 'NONE',
      allergies: state.allergies.trim() || null,
      // Une gravité sans allergie décrite n'a pas de sens : on la remet à néant plutôt que de
      // laisser traîner une valeur orpheline si la description est effacée.
      allergySeverity:
        state.allergies.trim() && state.allergySeverity !== SEVERITE_AUCUNE
          ? state.allergySeverity
          : null,
      emergencyContactName: state.emergencyContactName.trim() || null,
      emergencyContactPhone: state.emergencyContactPhone.trim() || null,
    }),
    successMessage: {
      title: t('profile.profile_updated'),
      description: t('profile.info_saved'),
    },
    errorMessages: { default: t('profile.cannot_save_profile') },
    onSuccess: (updatedUser) => {
      authStore.updateUser({ ...authStore.user!, ...updatedUser })
      /*
       * ⚠️ L'ADRESSE DU CHAMP EST REMISE À CELLE DU COMPTE quand un changement part en attente :
       * elle n'est PAS encore la sienne, et la laisser afficher la nouvelle ferait croire que
       * c'est fait. L'encart, lui, dit ce qui est en cours.
       */
      const enAttente = (updatedUser as { pendingEmail?: string | null })?.pendingEmail ?? null
      adresseEnAttente.value = enAttente
      if (enAttente) state.email = authStore.user?.email || state.email
      // Le mot de passe ne reste pas dans la page après usage.
      state.currentPassword = ''
    },
  }
)

const updateProfile = () => {
  if (!hasChanges.value) return
  executeUpdateProfile()
}
</script>
