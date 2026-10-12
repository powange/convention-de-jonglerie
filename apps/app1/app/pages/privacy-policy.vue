<template>
  <div class="container mx-auto px-4 py-8 max-w-4xl">
    <h1 class="text-3xl font-bold mb-8">{{ t('privacy.title') }}</h1>

    <div class="prose prose-gray dark:prose-invert max-w-none space-y-6">
      <section>
        <h2 class="text-2xl font-semibold mb-4">
          {{ t('privacy.sections.data_controller.title') }}
        </h2>
        <p>{{ t('privacy.sections.data_controller.content') }}</p>
      </section>

      <section>
        <h2 class="text-2xl font-semibold mb-4">
          {{ t('privacy.sections.data_collected.title') }}
        </h2>
        <p>{{ t('privacy.sections.data_collected.intro') }}</p>
        <ul class="list-disc list-inside ml-4 space-y-1">
          <li>{{ t('privacy.sections.data_collected.items.identity') }}</li>
          <li>{{ t('privacy.sections.data_collected.items.contact') }}</li>
          <li>{{ t('privacy.sections.data_collected.items.preferences') }}</li>
        </ul>
      </section>

      <section>
        <h2 class="text-2xl font-semibold mb-4">{{ t('privacy.sections.purpose.title') }}</h2>
        <p>{{ t('privacy.sections.purpose.intro') }}</p>
        <ul class="list-disc list-inside ml-4 space-y-1">
          <li>{{ t('privacy.sections.purpose.items.account_management') }}</li>
          <li>{{ t('privacy.sections.purpose.items.service_provision') }}</li>
          <li>{{ t('privacy.sections.purpose.items.communication') }}</li>
          <li>{{ t('privacy.sections.purpose.items.improvement') }}</li>
        </ul>
      </section>

      <section>
        <h2 class="text-2xl font-semibold mb-4">{{ t('privacy.sections.legal_basis.title') }}</h2>
        <p>{{ t('privacy.sections.legal_basis.content') }}</p>
      </section>

      <section>
        <h2 class="text-2xl font-semibold mb-4">{{ t('privacy.sections.data_sharing.title') }}</h2>
        <p>{{ t('privacy.sections.data_sharing.content') }}</p>
      </section>

      <section>
        <h2 class="text-2xl font-semibold mb-4">
          {{ t('privacy.sections.data_retention.title') }}
        </h2>
        <p>{{ t('privacy.sections.data_retention.content') }}</p>
      </section>

      <section>
        <h2 class="text-2xl font-semibold mb-4">{{ t('privacy.sections.user_rights.title') }}</h2>
        <p>{{ t('privacy.sections.user_rights.intro') }}</p>
        <ul class="list-disc list-inside ml-4 space-y-1">
          <li>{{ t('privacy.sections.user_rights.items.access') }}</li>
          <li>{{ t('privacy.sections.user_rights.items.rectification') }}</li>
          <li>{{ t('privacy.sections.user_rights.items.erasure') }}</li>
          <li>{{ t('privacy.sections.user_rights.items.portability') }}</li>
          <li>{{ t('privacy.sections.user_rights.items.objection') }}</li>
        </ul>
      </section>

      <section>
        <h2 class="text-2xl font-semibold mb-4">{{ t('privacy.sections.cookies.title') }}</h2>
        <p>{{ t('privacy.sections.cookies.content') }}</p>
      </section>

      <section>
        <h2 class="text-2xl font-semibold mb-4">{{ t('privacy.sections.security.title') }}</h2>
        <p>{{ t('privacy.sections.security.content') }}</p>
      </section>

      <section>
        <h2 class="text-2xl font-semibold mb-4">{{ t('privacy.sections.updates.title') }}</h2>
        <p>{{ t('privacy.sections.updates.content') }}</p>
      </section>

      <section>
        <h2 class="text-2xl font-semibold mb-4">{{ t('privacy.sections.contact.title') }}</h2>
        <p>{{ t('privacy.sections.contact.content') }}</p>
        <p class="font-medium">
          {{ t('privacy.sections.contact.email_label') }}:
          <a :href="`mailto:${adresseDeContact}`" class="underline">{{ adresseDeContact }}</a>
        </p>
      </section>
    </div>

    <div class="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
      <p class="text-sm text-gray-600 dark:text-gray-400">
        {{ t('privacy.last_updated') }}: {{ t('privacy.update_date') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()

/*
 * L'ONGLET ET LA DESCRIPTION ÉTAIENT EN FRANÇAIS POUR LES TREIZE LANGUES — constat F4.
 *
 * Tout le corps de cette page passe par i18n ; son titre de page, non. Un lecteur anglophone
 * lisait donc « Politique de confidentialité » dans son onglet, et les moteurs indexaient la
 * description française quelle que soit la version servie.
 *
 * ⚠️ Et la chaîne était écrite TROIS FOIS : dans `definePageMeta.title`, dans sa `description`, et
 * dans `useHead`. Les deux premières ne servaient à rien — `useHead` les écrase — mais leur
 * présence faisait croire que corriger l'une suffisait.
 *
 * `useSeoMeta` remplace le tout : il pose le titre et la description, et refuse les clés inventées
 * que `useHead` accepterait en silence.
 */
useSeoMeta({
  title: () => t('privacy.title'),
  description: () => t('privacy.meta_description'),
  robots: 'index, follow',
})

/*
 * L'adresse du responsable du traitement, lue de la configuration et non du gabarit.
 *
 * Elle y était en dur, au milieu d'une ligne dont l'autre moitié passait déjà par i18n.
 */
const adresseDeContact = useRuntimeConfig().public.contactEmail
</script>
