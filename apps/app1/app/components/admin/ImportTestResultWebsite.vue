<template>
  <div class="space-y-4">
    <UAlert
      icon="i-heroicons-globe-alt"
      color="success"
      variant="soft"
      :title="$t('admin.import.website_data')"
    />

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Informations principales -->
      <div class="space-y-2">
        <h4 class="font-semibold text-sm text-gray-700 dark:text-gray-300">
          {{ $t('admin.import.main_info') }}
        </h4>
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm space-y-1">
          <p>
            <strong>{{ $t('admin.import.page_title') }}:</strong>
            {{ webContent.title || '-' }}
          </p>
          <p v-if="webContent.metaDescription">
            <strong>{{ $t('admin.import.meta_description') }}:</strong>
            {{ webContent.metaDescription }}
          </p>
        </div>
      </div>

      <!-- Open Graph -->
      <div v-if="hasOpenGraph" class="space-y-2">
        <h4 class="font-semibold text-sm text-gray-700 dark:text-gray-300">
          {{ $t('admin.import.open_graph') }}
        </h4>
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm space-y-1">
          <p v-for="(value, key) in webContent.openGraph" :key="key">
            <strong>og:{{ key }}:</strong> {{ value }}
          </p>
        </div>
      </div>

      <!-- Contact Info -->
      <div class="space-y-2">
        <h4 class="font-semibold text-sm text-gray-700 dark:text-gray-300">
          {{ $t('admin.import.contact_info') }}
        </h4>
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm space-y-1">
          <p v-if="webContent.contactInfo.emails.length">
            <strong>{{ $t('admin.import.emails_found') }}:</strong>
            {{ webContent.contactInfo.emails.join(', ') }}
          </p>
          <p v-if="webContent.contactInfo.phones.length">
            <strong>{{ $t('admin.import.phones_found') }}:</strong>
            {{ webContent.contactInfo.phones.join(', ') }}
          </p>
          <p v-if="webContent.contactInfo.instagramUrls.length">
            <strong>Instagram:</strong>
            <a
              v-for="(url, idx) in webContent.contactInfo.instagramUrls"
              :key="idx"
              :href="url"
              target="_blank"
              class="text-primary-500 hover:underline mr-2"
            >
              {{ url }}
            </a>
          </p>
          <p v-if="webContent.contactInfo.facebookUrls.length">
            <strong>Facebook:</strong>
            <a
              v-for="(url, idx) in webContent.contactInfo.facebookUrls"
              :key="idx"
              :href="url"
              target="_blank"
              class="text-primary-500 hover:underline mr-2"
            >
              {{ url }}
            </a>
          </p>
          <p v-if="webContent.contactInfo.ticketingUrls.length">
            <strong>{{ $t('admin.import.ticketing') }}:</strong>
            <a
              v-for="(url, idx) in webContent.contactInfo.ticketingUrls"
              :key="idx"
              :href="url"
              target="_blank"
              class="text-primary-500 hover:underline mr-2"
            >
              {{ url }}
            </a>
          </p>
          <p v-if="hasNoContactInfo" class="text-gray-500 italic">
            {{ $t('admin.import.no_contact_info') }}
          </p>
        </div>
      </div>

      <!-- Image OG -->
      <div v-if="webContent.openGraph.image" class="space-y-2">
        <h4 class="font-semibold text-sm text-gray-700 dark:text-gray-300">
          {{ $t('admin.import.image_preview') }}
        </h4>
        <img
          :src="webContent.openGraph.image"
          :alt="webContent.title"
          class="max-h-48 rounded-lg object-cover"
        />
      </div>
    </div>

    <!-- JSON-LD Events -->
    <div v-if="webContent.jsonLdEvents.length > 0" class="space-y-2">
      <h4 class="font-semibold text-sm text-gray-700 dark:text-gray-300">
        {{ $t('admin.import.json_ld_events') }}
      </h4>
      <div
        v-for="(event, idx) in webContent.jsonLdEvents"
        :key="idx"
        class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm"
      >
        <pre class="overflow-x-auto whitespace-pre-wrap">{{ JSON.stringify(event, null, 2) }}</pre>
      </div>
    </div>

    <!-- Navigation du site -->
    <div v-if="webContent.navigation?.length > 0" class="space-y-2">
      <h4 class="font-semibold text-sm text-gray-700 dark:text-gray-300">
        {{ $t('admin.import.site_navigation') }}
      </h4>
      <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm max-h-64 overflow-y-auto">
        <pre class="whitespace-pre-wrap">{{ JSON.stringify(webContent.navigation, null, 2) }}</pre>
      </div>
    </div>

    <!-- Liens utiles -->
    <div v-if="webContent.links.length > 0" class="space-y-2">
      <h4 class="font-semibold text-sm text-gray-700 dark:text-gray-300">
        {{ $t('admin.import.useful_links') }}
      </h4>
      <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm space-y-1">
        <p v-for="(link, idx) in webContent.links" :key="idx">
          <a :href="link" target="_blank" class="text-primary-500 hover:underline break-all">
            {{ link }}
          </a>
        </p>
      </div>
    </div>

    <!-- Contenu textuel -->
    <div v-if="webContent.textContent" class="space-y-2">
      <h4 class="font-semibold text-sm text-gray-700 dark:text-gray-300">
        {{ $t('admin.import.text_content') }}
      </h4>
      <div
        class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm max-h-96 overflow-y-auto whitespace-pre-wrap"
      >
        {{ webContent.textContent }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface WebContent {
  title?: string
  metaDescription?: string
  openGraph: Record<string, string>
  contactInfo: {
    emails: string[]
    phones: string[]
    instagramUrls: string[]
    facebookUrls: string[]
    ticketingUrls: string[]
  }
  jsonLdEvents: any[]
  navigation?: any[]
  links: string[]
  textContent?: string
}

const props = defineProps<{
  webContent: WebContent
}>()

const hasOpenGraph = computed(() => Object.keys(props.webContent.openGraph).length > 0)

const hasNoContactInfo = computed(
  () =>
    !props.webContent.contactInfo.emails.length &&
    !props.webContent.contactInfo.phones.length &&
    !props.webContent.contactInfo.instagramUrls.length &&
    !props.webContent.contactInfo.facebookUrls.length &&
    !props.webContent.contactInfo.ticketingUrls.length
)
</script>
