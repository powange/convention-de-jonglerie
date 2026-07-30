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
          {{ t('privacy.sections.contact.email_label') }}: powange@gmail.com
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

// Métadonnées de la page
definePageMeta({
  title: 'Politique de confidentialité',
  description: 'Politique de confidentialité et protection des données personnelles',
})

// SEO
useHead({
  title: 'Politique de confidentialité',
  meta: [
    {
      name: 'description',
      content:
        'Politique de confidentialité et protection des données personnelles sur Convention de Jonglerie',
    },
    { name: 'robots', content: 'index, follow' },
  ],
})
</script>
