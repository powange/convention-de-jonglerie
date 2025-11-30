<template>
  <div>
    <!-- Breadcrumb -->
    <nav class="flex mb-4" :aria-label="$t('navigation.breadcrumb')">
      <ol class="inline-flex items-center space-x-1 md:space-x-3">
        <li class="inline-flex items-center">
          <NuxtLink
            to="/admin"
            class="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white"
          >
            <UIcon name="i-heroicons-squares-2x2" class="w-4 h-4 mr-2" />
            {{ $t('admin.dashboard') }}
          </NuxtLink>
        </li>
        <li>
          <div class="flex items-center">
            <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-400" />
            <span class="ml-1 text-sm font-medium text-gray-500 md:ml-2 dark:text-gray-400">
              {{ $t('admin.import.title') }}
            </span>
          </div>
        </li>
      </ol>
    </nav>

    <!-- Génération depuis URLs -->
    <UCard class="mb-6">
      <template #header>
        <div class="flex items-center gap-3">
          <UIcon name="i-heroicons-sparkles" class="text-yellow-500" size="24" />
          <h2 class="text-xl font-bold">{{ $t('admin.import.generate_from_urls') }}</h2>
        </div>
      </template>

      <div class="space-y-4">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ $t('admin.import.generate_description') }}
        </p>

        <UFormField :label="$t('admin.import.urls_input')" :hint="$t('admin.import.urls_hint')">
          <UTextarea
            v-model="urlsInput"
            :rows="4"
            :placeholder="$t('admin.import.urls_placeholder')"
            class="font-mono w-full"
          />
        </UFormField>

        <!-- Choix de la méthode de génération -->
        <UFormField :label="$t('admin.import.generation_method')">
          <URadioGroup v-model="generationMethod" :items="generationMethodItems" variant="card" />
        </UFormField>

        <div class="flex gap-3">
          <UButton
            color="warning"
            :loading="generating"
            :disabled="!urlsInput.trim() || testingUrls"
            icon="i-heroicons-sparkles"
            @click="generateFromUrls"
          >
            {{ $t('admin.import.generate_json') }}
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            :loading="testingUrls"
            :disabled="!urlsInput.trim() || generating"
            icon="i-heroicons-magnifying-glass"
            @click="testUrls"
          >
            {{ $t('admin.import.test_urls') }}
          </UButton>
        </div>

        <!-- Progression de la méthode simple -->
        <div v-if="generating && generationMethod === 'simple'" class="space-y-2">
          <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <UIcon name="i-heroicons-cog-6-tooth" class="animate-spin" />
            <span>{{ simpleStatus }}</span>
          </div>
          <!-- Indicateur d'étapes -->
          <div class="flex items-center gap-1">
            <div
              v-for="(step, index) in [
                'scraping_facebook',
                'fetching_urls',
                'generating_json',
                'extracting_features',
              ]"
              :key="step"
              class="flex items-center"
            >
              <div
                class="w-2 h-2 rounded-full transition-colors"
                :class="{
                  'bg-warning-500': simpleStep === step,
                  'bg-success-500':
                    [
                      'scraping_facebook',
                      'fetching_urls',
                      'generating_json',
                      'extracting_features',
                    ].indexOf(simpleStep) > index,
                  'bg-gray-300 dark:bg-gray-600':
                    [
                      'scraping_facebook',
                      'fetching_urls',
                      'generating_json',
                      'extracting_features',
                    ].indexOf(simpleStep) < index || !simpleStep,
                }"
              />
              <div v-if="index < 3" class="w-4 h-0.5 bg-gray-300 dark:bg-gray-600" />
            </div>
          </div>
        </div>

        <!-- Progression de l'agent -->
        <div v-if="generating && generationMethod === 'agent'" class="space-y-2">
          <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <UIcon name="i-heroicons-globe-alt" class="animate-pulse" />
            <span>{{ agentStatus }}</span>
          </div>
          <UProgress :value="agentProgress" size="sm" color="warning" />
          <p class="text-xs text-gray-500">
            {{ $t('admin.import.agent_exploring', { count: agentPagesVisited }) }}
          </p>
        </div>

        <!-- Erreur de génération -->
        <UAlert
          v-if="generateError"
          icon="i-heroicons-exclamation-triangle"
          color="error"
          variant="soft"
          :title="$t('admin.import.generate_error')"
        >
          <template #description>{{ generateError }}</template>
        </UAlert>

        <!-- Résultat de l'agent -->
        <UAlert
          v-if="agentResult && !generating"
          icon="i-heroicons-check-circle"
          color="success"
          variant="soft"
          :title="$t('admin.import.agent_success')"
        >
          <template #description>
            <p>
              {{
                $t('admin.import.agent_result', {
                  pages: agentResult.urlsProcessed?.length || 0,
                  iterations: agentResult.iterations || 0,
                })
              }}
            </p>
            <ul v-if="agentResult.urlsProcessed?.length" class="mt-2 text-xs space-y-1">
              <li v-for="url in agentResult.urlsProcessed" :key="url" class="truncate">
                • {{ url }}
              </li>
            </ul>
          </template>
        </UAlert>
      </div>
    </UCard>

    <!-- Résultats du test des URLs -->
    <UCard v-if="testResults.length > 0" class="mb-6">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <UIcon name="i-heroicons-document-magnifying-glass" class="text-info-500" size="24" />
            <h2 class="text-xl font-bold">{{ $t('admin.import.test_results_title') }}</h2>
          </div>
          <UButton
            icon="i-heroicons-x-mark"
            variant="ghost"
            color="neutral"
            size="sm"
            @click="testResults = []"
          />
        </div>
      </template>

      <div class="space-y-4">
        <!-- Sélecteur d'URL -->
        <UFormField :label="$t('admin.import.select_url')">
          <USelect v-model="selectedTestUrl" :items="testResultItems" class="w-full" />
        </UFormField>

        <!-- Résultat de l'URL sélectionnée -->
        <div v-if="selectedTestResult" class="space-y-4">
          <!-- Statut -->
          <UAlert
            v-if="!selectedTestResult.success"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="$t('admin.import.test_url_error')"
          >
            <template #description>{{ selectedTestResult.error }}</template>
          </UAlert>

          <!-- Données Facebook -->
          <div
            v-if="selectedTestResult.type === 'facebook' && selectedTestResult.facebookData"
            class="space-y-4"
          >
            <UAlert
              icon="i-mdi-facebook"
              color="info"
              variant="soft"
              :title="$t('admin.import.facebook_event_data')"
            />

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Informations principales -->
              <div class="space-y-2">
                <h4 class="font-semibold text-sm text-gray-700 dark:text-gray-300">
                  {{ $t('admin.import.main_info') }}
                </h4>
                <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm space-y-1">
                  <p>
                    <strong>{{ $t('common.name') }}:</strong>
                    {{ selectedTestResult.facebookData.name || '-' }}
                  </p>
                  <p v-if="selectedTestResult.facebookData.startTimestamp">
                    <strong>{{ $t('admin.import.start_date') }}:</strong>
                    {{ formatTimestamp(selectedTestResult.facebookData.startTimestamp) }}
                  </p>
                  <p v-if="selectedTestResult.facebookData.endTimestamp">
                    <strong>{{ $t('admin.import.end_date') }}:</strong>
                    {{ formatTimestamp(selectedTestResult.facebookData.endTimestamp) }}
                  </p>
                  <p v-if="selectedTestResult.facebookData.timezone">
                    <strong>{{ $t('admin.import.timezone') }}:</strong>
                    {{ selectedTestResult.facebookData.timezone }}
                  </p>
                </div>
              </div>

              <!-- Lieu -->
              <div v-if="selectedTestResult.facebookData.location" class="space-y-2">
                <h4 class="font-semibold text-sm text-gray-700 dark:text-gray-300">
                  {{ $t('admin.import.location') }}
                </h4>
                <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm space-y-1">
                  <p v-if="selectedTestResult.facebookData.location.name">
                    <strong>{{ $t('common.name') }}:</strong>
                    {{ selectedTestResult.facebookData.location.name }}
                  </p>
                  <p v-if="selectedTestResult.facebookData.location.address">
                    <strong>{{ $t('admin.import.address') }}:</strong>
                    {{ selectedTestResult.facebookData.location.address }}
                  </p>
                  <p v-if="selectedTestResult.facebookData.location.countryCode">
                    <strong>{{ $t('admin.import.country_code') }}:</strong>
                    {{ selectedTestResult.facebookData.location.countryCode }}
                  </p>
                  <p v-if="selectedTestResult.facebookData.location.coordinates">
                    <strong>{{ $t('admin.import.coordinates') }}:</strong>
                    {{ selectedTestResult.facebookData.location.coordinates.latitude }},
                    {{ selectedTestResult.facebookData.location.coordinates.longitude }}
                  </p>
                </div>
              </div>

              <!-- URLs -->
              <div class="space-y-2">
                <h4 class="font-semibold text-sm text-gray-700 dark:text-gray-300">
                  {{ $t('admin.import.urls') }}
                </h4>
                <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm space-y-1">
                  <p v-if="selectedTestResult.facebookData.ticketUrl">
                    <strong>{{ $t('admin.import.ticketing') }}:</strong>
                    <a
                      :href="selectedTestResult.facebookData.ticketUrl"
                      target="_blank"
                      class="text-primary-500 hover:underline break-all"
                    >
                      {{ selectedTestResult.facebookData.ticketUrl }}
                    </a>
                  </p>
                  <p
                    v-if="
                      selectedTestResult.facebookData.photo?.imageUri ||
                      selectedTestResult.facebookData.photo?.url
                    "
                  >
                    <strong>{{ $t('admin.import.image') }}:</strong>
                    <a
                      :href="
                        selectedTestResult.facebookData.photo.imageUri ||
                        selectedTestResult.facebookData.photo.url
                      "
                      target="_blank"
                      class="text-primary-500 hover:underline break-all"
                    >
                      {{ $t('admin.import.view_image') }}
                    </a>
                  </p>
                </div>
              </div>

              <!-- Image preview -->
              <div
                v-if="
                  selectedTestResult.facebookData.photo?.imageUri ||
                  selectedTestResult.facebookData.photo?.url
                "
                class="space-y-2"
              >
                <h4 class="font-semibold text-sm text-gray-700 dark:text-gray-300">
                  {{ $t('admin.import.image_preview') }}
                </h4>
                <img
                  :src="
                    selectedTestResult.facebookData.photo.imageUri ||
                    selectedTestResult.facebookData.photo.url
                  "
                  :alt="selectedTestResult.facebookData.name"
                  class="max-h-48 rounded-lg object-cover"
                />
              </div>
            </div>

            <!-- Description -->
            <div v-if="selectedTestResult.facebookData.description" class="space-y-2">
              <h4 class="font-semibold text-sm text-gray-700 dark:text-gray-300">
                {{ $t('common.description') }}
              </h4>
              <div
                class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm max-h-48 overflow-y-auto whitespace-pre-wrap"
              >
                {{ selectedTestResult.facebookData.description }}
              </div>
            </div>
          </div>

          <!-- Données Web -->
          <div
            v-else-if="selectedTestResult.type === 'website' && selectedTestResult.webContent"
            class="space-y-4"
          >
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
                    {{ selectedTestResult.webContent.title || '-' }}
                  </p>
                  <p v-if="selectedTestResult.webContent.metaDescription">
                    <strong>{{ $t('admin.import.meta_description') }}:</strong>
                    {{ selectedTestResult.webContent.metaDescription }}
                  </p>
                </div>
              </div>

              <!-- Open Graph -->
              <div
                v-if="Object.keys(selectedTestResult.webContent.openGraph).length > 0"
                class="space-y-2"
              >
                <h4 class="font-semibold text-sm text-gray-700 dark:text-gray-300">
                  {{ $t('admin.import.open_graph') }}
                </h4>
                <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm space-y-1">
                  <p v-for="(value, key) in selectedTestResult.webContent.openGraph" :key="key">
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
                  <p v-if="selectedTestResult.webContent.contactInfo.emails.length">
                    <strong>{{ $t('admin.import.emails_found') }}:</strong>
                    {{ selectedTestResult.webContent.contactInfo.emails.join(', ') }}
                  </p>
                  <p v-if="selectedTestResult.webContent.contactInfo.phones.length">
                    <strong>{{ $t('admin.import.phones_found') }}:</strong>
                    {{ selectedTestResult.webContent.contactInfo.phones.join(', ') }}
                  </p>
                  <p v-if="selectedTestResult.webContent.contactInfo.instagramUrls.length">
                    <strong>Instagram:</strong>
                    <a
                      v-for="(url, idx) in selectedTestResult.webContent.contactInfo.instagramUrls"
                      :key="idx"
                      :href="url"
                      target="_blank"
                      class="text-primary-500 hover:underline mr-2"
                    >
                      {{ url }}
                    </a>
                  </p>
                  <p v-if="selectedTestResult.webContent.contactInfo.facebookUrls.length">
                    <strong>Facebook:</strong>
                    <a
                      v-for="(url, idx) in selectedTestResult.webContent.contactInfo.facebookUrls"
                      :key="idx"
                      :href="url"
                      target="_blank"
                      class="text-primary-500 hover:underline mr-2"
                    >
                      {{ url }}
                    </a>
                  </p>
                  <p v-if="selectedTestResult.webContent.contactInfo.ticketingUrls.length">
                    <strong>{{ $t('admin.import.ticketing') }}:</strong>
                    <a
                      v-for="(url, idx) in selectedTestResult.webContent.contactInfo.ticketingUrls"
                      :key="idx"
                      :href="url"
                      target="_blank"
                      class="text-primary-500 hover:underline mr-2"
                    >
                      {{ url }}
                    </a>
                  </p>
                  <p
                    v-if="
                      !selectedTestResult.webContent.contactInfo.emails.length &&
                      !selectedTestResult.webContent.contactInfo.phones.length &&
                      !selectedTestResult.webContent.contactInfo.instagramUrls.length &&
                      !selectedTestResult.webContent.contactInfo.facebookUrls.length &&
                      !selectedTestResult.webContent.contactInfo.ticketingUrls.length
                    "
                    class="text-gray-500 italic"
                  >
                    {{ $t('admin.import.no_contact_info') }}
                  </p>
                </div>
              </div>

              <!-- Image OG -->
              <div v-if="selectedTestResult.webContent.openGraph.image" class="space-y-2">
                <h4 class="font-semibold text-sm text-gray-700 dark:text-gray-300">
                  {{ $t('admin.import.image_preview') }}
                </h4>
                <img
                  :src="selectedTestResult.webContent.openGraph.image"
                  :alt="selectedTestResult.webContent.title"
                  class="max-h-48 rounded-lg object-cover"
                />
              </div>
            </div>

            <!-- JSON-LD Events -->
            <div v-if="selectedTestResult.webContent.jsonLdEvents.length > 0" class="space-y-2">
              <h4 class="font-semibold text-sm text-gray-700 dark:text-gray-300">
                {{ $t('admin.import.json_ld_events') }}
              </h4>
              <div
                v-for="(event, idx) in selectedTestResult.webContent.jsonLdEvents"
                :key="idx"
                class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm"
              >
                <pre class="overflow-x-auto whitespace-pre-wrap">{{
                  JSON.stringify(event, null, 2)
                }}</pre>
              </div>
            </div>

            <!-- Navigation du site -->
            <div v-if="selectedTestResult.webContent.navigation?.length > 0" class="space-y-2">
              <h4 class="font-semibold text-sm text-gray-700 dark:text-gray-300">
                {{ $t('admin.import.site_navigation') }}
              </h4>
              <div
                class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm max-h-64 overflow-y-auto"
              >
                <pre class="whitespace-pre-wrap">{{
                  JSON.stringify(selectedTestResult.webContent.navigation, null, 2)
                }}</pre>
              </div>
            </div>

            <!-- Liens utiles -->
            <div v-if="selectedTestResult.webContent.links.length > 0" class="space-y-2">
              <h4 class="font-semibold text-sm text-gray-700 dark:text-gray-300">
                {{ $t('admin.import.useful_links') }}
              </h4>
              <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm space-y-1">
                <p v-for="(link, idx) in selectedTestResult.webContent.links" :key="idx">
                  <a
                    :href="link"
                    target="_blank"
                    class="text-primary-500 hover:underline break-all"
                  >
                    {{ link }}
                  </a>
                </p>
              </div>
            </div>

            <!-- Contenu textuel -->
            <div v-if="selectedTestResult.webContent.textContent" class="space-y-2">
              <h4 class="font-semibold text-sm text-gray-700 dark:text-gray-300">
                {{ $t('admin.import.text_content') }}
              </h4>
              <div
                class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm max-h-96 overflow-y-auto whitespace-pre-wrap"
              >
                {{ selectedTestResult.webContent.textContent }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <UIcon name="i-heroicons-arrow-down-tray" class="text-primary-500" size="24" />
            <h1 class="text-2xl font-bold">{{ $t('admin.import.title') }}</h1>
          </div>
          <UButton
            icon="i-heroicons-question-mark-circle"
            variant="ghost"
            color="neutral"
            @click="showDocumentation = !showDocumentation"
          >
            {{ $t('admin.import.show_documentation') }}
          </UButton>
        </div>
      </template>

      <!-- Documentation -->
      <div v-if="showDocumentation" class="mb-6">
        <UAlert
          icon="i-heroicons-information-circle"
          color="info"
          variant="soft"
          :title="$t('admin.import.documentation_title')"
        >
          <template #description>
            <div class="mt-2 space-y-4">
              <p>{{ $t('admin.import.documentation_intro') }}</p>

              <div>
                <h4 class="font-semibold mb-2">{{ $t('admin.import.required_fields') }}</h4>
                <ul class="list-disc list-inside space-y-1 text-sm">
                  <li><code>convention.name</code> - Nom de la convention</li>
                  <li><code>convention.email</code> - Email de contact (pour revendication)</li>
                  <li>
                    <code>edition.startDate</code> - Date de début (YYYY-MM-DD ou format ISO UTC)
                  </li>
                  <li><code>edition.endDate</code> - Date de fin (YYYY-MM-DD ou format ISO UTC)</li>
                  <li><code>edition.addressLine1</code> - Adresse</li>
                  <li><code>edition.city</code> - Ville</li>
                  <li><code>edition.country</code> - Pays</li>
                  <li><code>edition.postalCode</code> - Code postal</li>
                </ul>
              </div>

              <div>
                <h4 class="font-semibold mb-2">{{ $t('admin.import.optional_fields') }}</h4>
                <ul class="list-disc list-inside space-y-1 text-sm">
                  <li><code>convention.description</code> - Description de la convention</li>
                  <li><code>convention.logo</code> - URL du logo</li>
                  <li>
                    <code>edition.name</code> - Nom de l'édition (si omis, utilise le nom de la
                    convention)
                  </li>
                  <li><code>edition.description</code> - Description de l'édition</li>
                  <li><code>edition.addressLine2</code> - Complément d'adresse</li>
                  <li><code>edition.region</code> - Région</li>
                  <li>
                    <code>edition.timezone</code> - Fuseau horaire IANA (ex: "Europe/Paris",
                    "America/New_York")
                  </li>
                  <li><code>edition.latitude/longitude</code> - Coordonnées GPS</li>
                  <li><code>edition.imageUrl</code> - URL de l'image de l'édition</li>
                  <li><code>edition.ticketingUrl</code> - URL de billetterie</li>
                  <li><code>edition.facebookUrl</code> - Page Facebook</li>
                  <li><code>edition.instagramUrl</code> - Page Instagram</li>
                  <li><code>edition.officialWebsiteUrl</code> - Site officiel</li>
                  <li><code>edition.isOnline</code> - Événement en ligne (boolean)</li>
                  <li><code>edition.volunteersOpen</code> - Inscriptions bénévoles ouvertes</li>
                  <li><code>edition.volunteersDescription</code> - Description pour bénévoles</li>
                  <li><code>edition.volunteersExternalUrl</code> - URL externe bénévoles</li>
                </ul>
              </div>

              <div>
                <h4 class="font-semibold mb-2">Formats de dates acceptés</h4>
                <p class="text-sm mb-2">Les dates peuvent être au format :</p>
                <ul class="list-disc list-inside space-y-1 text-sm">
                  <li><code>"2025-10-24"</code> - Date simple (recommandé)</li>
                  <li><code>"2025-10-24T14:30:00"</code> - Date avec heure</li>
                  <li><code>"2025-10-24T14:30:00Z"</code> - Date avec heure UTC</li>
                  <li><code>"2025-10-24T14:30:00.000Z"</code> - Date complète ISO UTC</li>
                </ul>
                <p class="text-xs text-gray-600 mt-2">
                  💡 Pour les événements multi-jours, le format date simple est recommandé.
                </p>
              </div>

              <div>
                <h4 class="font-semibold mb-2">Fuseau horaire (timezone)</h4>
                <p class="text-sm mb-2">
                  Le fuseau horaire doit être au format IANA. Exemples courants :
                </p>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-1 text-sm">
                  <span><code>Europe/Paris</code> - France</span>
                  <span><code>Europe/Berlin</code> - Allemagne</span>
                  <span><code>Europe/London</code> - UK</span>
                  <span><code>Europe/Brussels</code> - Belgique</span>
                  <span><code>Europe/Zurich</code> - Suisse</span>
                  <span><code>Europe/Rome</code> - Italie</span>
                  <span><code>America/New_York</code> - USA Est</span>
                  <span><code>America/Los_Angeles</code> - USA Ouest</span>
                  <span><code>America/Toronto</code> - Canada</span>
                </div>
                <p class="text-xs text-gray-600 mt-2">
                  💡 L'IA déduit automatiquement le fuseau horaire à partir du pays/ville.
                </p>
              </div>

              <div>
                <h4 class="font-semibold mb-2">{{ $t('admin.import.features_fields') }}</h4>
                <p class="text-sm mb-2">{{ $t('admin.import.features_description') }}</p>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-1 text-sm">
                  <span title="Food trucks"><code>hasFoodTrucks</code></span>
                  <span title="Espace enfants"><code>hasKidsZone</code></span>
                  <span title="Animaux acceptés"><code>acceptsPets</code></span>
                  <span title="Camping tente"><code>hasTentCamping</code></span>
                  <span title="Camping véhicule"><code>hasTruckCamping</code></span>
                  <span title="Camping famille"><code>hasFamilyCamping</code></span>
                  <span title="Gymnase"><code>hasGym</code></span>
                  <span title="Cantine"><code>hasCantine</code></span>
                  <span title="Douches"><code>hasShowers</code></span>
                  <span title="Toilettes"><code>hasToilets</code></span>
                  <span title="Dortoir"><code>hasSleepingRoom</code></span>
                  <span title="Ateliers"><code>hasWorkshops</code></span>
                  <span title="Scène ouverte"><code>hasOpenStage</code></span>
                  <span title="Concert"><code>hasConcert</code></span>
                  <span title="Gala"><code>hasGala</code></span>
                  <span title="Spectacle long"><code>hasLongShow</code></span>
                  <span title="Espace aérien"><code>hasAerialSpace</code></span>
                  <span title="Espace feu"><code>hasFireSpace</code></span>
                  <span title="Espace slackline"><code>hasSlacklineSpace</code></span>
                  <span title="Accessibilité PMR"><code>hasAccessibility</code></span>
                  <span title="Paiement espèces"><code>hasCashPayment</code></span>
                  <span title="Paiement CB"><code>hasCreditCardPayment</code></span>
                  <span title="Jetons AFJ"><code>hasAfjTokenPayment</code></span>
                  <span title="Distributeur"><code>hasATM</code></span>
                </div>
              </div>

              <div>
                <h4 class="font-semibold mb-2">{{ $t('admin.import.example_json') }}</h4>
                <pre class="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg overflow-x-auto text-xs">{{
                  exampleJson
                }}</pre>
              </div>
            </div>
          </template>
        </UAlert>
      </div>

      <!-- Import Form -->
      <div class="space-y-4">
        <UFormField :label="$t('admin.import.json_input')" required>
          <UTextarea
            v-model="jsonInput"
            :rows="15"
            :placeholder="$t('admin.import.json_placeholder')"
            class="font-mono w-full"
          />
        </UFormField>

        <div class="flex gap-3">
          <UButton
            color="primary"
            size="lg"
            :loading="importing"
            :disabled="!jsonInput.trim()"
            @click="validateAndImport"
          >
            {{ $t('admin.import.validate_and_import') }}
          </UButton>

          <UButton variant="soft" color="neutral" size="lg" @click="loadExample">
            {{ $t('admin.import.load_example') }}
          </UButton>

          <UButton variant="ghost" color="neutral" size="lg" @click="clearForm">
            {{ $t('common.clear') }}
          </UButton>
        </div>

        <!-- Validation Results -->
        <div v-if="validationResult" class="mt-4">
          <UAlert
            v-if="validationResult.success"
            icon="i-heroicons-check-circle"
            color="success"
            variant="soft"
          >
            <template #title>{{ $t('admin.import.validation_success') }}</template>
            <template #description>
              <div class="mt-2">
                <p>{{ $t('admin.import.ready_to_import') }}</p>
                <ul class="mt-2 space-y-1">
                  <li><strong>Convention:</strong> {{ validationResult.data.convention.name }}</li>
                  <li><strong>Édition:</strong> {{ validationResult.data.edition.name }}</li>
                  <li>
                    <strong>Dates:</strong>
                    {{
                      formatDateRange(
                        validationResult.data.edition.startDate,
                        validationResult.data.edition.endDate
                      )
                    }}
                  </li>
                  <li>
                    <strong>Lieu:</strong> {{ validationResult.data.edition.city }},
                    {{ validationResult.data.edition.country }}
                  </li>
                </ul>
              </div>
            </template>
          </UAlert>

          <UAlert v-else icon="i-heroicons-x-circle" color="error" variant="soft">
            <template #title>{{ $t('admin.import.validation_error') }}</template>
            <template #description>
              <ul class="mt-2 space-y-1">
                <li v-for="error in validationResult.errors" :key="error">
                  {{ error }}
                </li>
              </ul>
            </template>
          </UAlert>
        </div>

        <!-- Import Results -->
        <div v-if="importResult" class="mt-4">
          <UAlert
            v-if="importResult.success"
            icon="i-heroicons-check-circle"
            color="success"
            variant="solid"
          >
            <template #title>{{ $t('admin.import.import_success') }}</template>
            <template #description>
              <div class="mt-2">
                <p>{{ $t('admin.import.import_success_message') }}</p>
                <div class="mt-3 flex gap-2">
                  <UButton
                    color="neutral"
                    variant="solid"
                    size="sm"
                    :to="`/editions/${importResult.editionId}`"
                  >
                    {{ $t('admin.import.view_edition') }}
                  </UButton>
                  <UButton color="neutral" variant="ghost" size="sm" @click="clearForm">
                    {{ $t('admin.import.import_another') }}
                  </UButton>
                </div>
              </div>
            </template>
          </UAlert>

          <UAlert v-else icon="i-heroicons-x-circle" color="error" variant="solid">
            <template #title>{{ $t('admin.import.import_error') }}</template>
            <template #description>
              {{ importResult.error }}
            </template>
          </UAlert>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

// Middleware de protection pour super admin
definePageMeta({
  middleware: ['auth-protected', 'super-admin'],
})

const { t } = useI18n()
const { $fetch } = useNuxtApp()

const showDocumentation = ref(false)
const jsonInput = ref('')
const importing = ref(false)
const validationResult = ref<any>(null)
const importResult = ref<any>(null)

// Génération depuis URLs
const urlsInput = ref('')
const generating = ref(false)
const generateError = ref('')
const generationMethod = ref<'simple' | 'agent'>('simple')

// État spécifique à la méthode simple
const simpleStatus = ref('')
const simpleStep = ref('')

// État spécifique à l'agent
const agentStatus = ref('')
const agentProgress = ref(0)
const agentPagesVisited = ref(0)
const agentResult = ref<any>(null)

// État pour le test des URLs
const testingUrls = ref(false)
const testResults = ref<any[]>([])
const selectedTestUrl = ref<string>('')

// Items pour le choix de la méthode de génération
const generationMethodItems = computed(() => [
  {
    label: t('admin.import.method_simple'),
    description: t('admin.import.method_simple_description'),
    value: 'simple',
  },
  {
    label: t('admin.import.method_agent'),
    description: t('admin.import.method_agent_description'),
    value: 'agent',
  },
])

// Items pour le select des résultats de test
const testResultItems = computed(() =>
  testResults.value.map((result) => {
    const hostname = new URL(result.url).hostname
    const status = result.success ? '✅' : '❌'
    const type = result.type === 'facebook' ? '📘' : '🌐'
    return {
      label: `${status} ${type} ${hostname}`,
      value: result.url,
    }
  })
)

// Résultat de test sélectionné
const selectedTestResult = computed(() =>
  testResults.value.find((r) => r.url === selectedTestUrl.value)
)

const exampleJson = `{
  "convention": {
    "name": "Convention Internationale de Jonglerie",
    "email": "contact@convention-jonglerie.org",
    "description": "La plus grande convention de jonglerie d'Europe"
  },
  "edition": {
    "name": "CIJ 2025 - Paris",
    "description": "45ème édition de la Convention Internationale de Jonglerie",
    "startDate": "2025-07-15",
    "endDate": "2025-07-20",
    "addressLine1": "Parc des Expositions",
    "addressLine2": "Hall 5",
    "city": "Paris",
    "region": "Île-de-France",
    "timezone": "Europe/Paris",
    "country": "France",
    "postalCode": "75015",
    "latitude": 48.8566,
    "longitude": 2.3522,
    "ticketingUrl": "https://tickets.cij2025.fr",
    "facebookUrl": "https://facebook.com/cij2025",
    "instagramUrl": "https://instagram.com/cij2025",
    "officialWebsiteUrl": "https://www.cij2025.fr",
    "hasFoodTrucks": true,
    "hasKidsZone": true,
    "acceptsPets": false,
    "hasTentCamping": true,
    "hasTruckCamping": true,
    "hasGym": true,
    "hasCantine": true,
    "hasShowers": true,
    "hasToilets": true,
    "hasWorkshops": true,
    "hasOpenStage": true,
    "hasConcert": true,
    "hasGala": true,
    "hasAccessibility": true,
    "hasAerialSpace": true,
    "hasFamilyCamping": true,
    "hasSleepingRoom": false,
    "hasFireSpace": true,
    "hasSlacklineSpace": true,
    "hasCashPayment": true,
    "hasCreditCardPayment": true,
    "hasAfjTokenPayment": false,
    "hasATM": true,
    "hasLongShow": true
  }
}`

const formatDateRange = (startDate: string, endDate: string) => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }

  if (start.toDateString() === end.toDateString()) {
    return start.toLocaleDateString('fr-FR', options)
  }

  return `${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} - ${end.toLocaleDateString('fr-FR', options)}`
}

const loadExample = () => {
  jsonInput.value = exampleJson
  validationResult.value = null
  importResult.value = null
}

const clearForm = () => {
  jsonInput.value = ''
  validationResult.value = null
  importResult.value = null
}

const validateJson = (input: string): any => {
  const errors = []
  let data = null

  try {
    data = JSON.parse(input)
  } catch {
    return {
      success: false,
      errors: [t('admin.import.invalid_json')],
    }
  }

  // Vérifier la structure
  if (!data.convention) {
    errors.push(t('admin.import.missing_convention'))
  } else {
    // Vérifier les champs requis de la convention
    if (!data.convention.name) {
      errors.push(t('admin.import.missing_convention_name'))
    }
    if (!data.convention.email) {
      errors.push(t('admin.import.missing_convention_email'))
    }
  }

  if (!data.edition) {
    errors.push(t('admin.import.missing_edition'))
  } else {
    // Vérifier les champs requis de l'édition
    const requiredFields = ['startDate', 'endDate', 'addressLine1', 'city', 'country', 'postalCode']
    for (const field of requiredFields) {
      if (!data.edition[field]) {
        errors.push(t('admin.import.missing_field', { field: `edition.${field}` }))
      }
    }

    // Vérifier le format des dates
    if (data.edition.startDate && !isValidDate(data.edition.startDate)) {
      errors.push(t('admin.import.invalid_date', { field: 'startDate' }))
    }
    if (data.edition.endDate && !isValidDate(data.edition.endDate)) {
      errors.push(t('admin.import.invalid_date', { field: 'endDate' }))
    }

    // Vérifier que la date de fin est après la date de début
    if (data.edition.startDate && data.edition.endDate) {
      const start = new Date(data.edition.startDate)
      const end = new Date(data.edition.endDate)
      if (end < start) {
        errors.push(t('admin.import.end_before_start'))
      }
    }
  }

  return {
    success: errors.length === 0,
    errors,
    data,
  }
}

const isValidDate = (dateString: string): boolean => {
  const date = new Date(dateString)
  return date instanceof Date && !isNaN(date.getTime())
}

const validateAndImport = async () => {
  validationResult.value = validateJson(jsonInput.value)

  if (!validationResult.value.success) {
    return
  }

  // Si la validation est réussie, procéder à l'import
  try {
    importing.value = true
    importResult.value = null

    const response = await $fetch('/api/admin/import-edition', {
      method: 'POST',
      body: validationResult.value.data,
    })

    importResult.value = {
      success: true,
      editionId: response.editionId,
      conventionId: response.conventionId,
    }

    useToast().add({
      title: t('admin.import.import_success'),
      description: t('admin.import.import_success_toast'),
      color: 'success',
    })
  } catch (error: any) {
    importResult.value = {
      success: false,
      error: error?.data?.message || t('admin.import.import_failed'),
    }

    useToast().add({
      title: t('common.error'),
      description: importResult.value.error,
      color: 'error',
    })
  } finally {
    importing.value = false
  }
}

/**
 * Labels des étapes pour l'affichage
 */
const stepLabels: Record<string, string> = {
  starting: 'Démarrage...',
  scraping_facebook: 'Récupération des données Facebook...',
  fetching_urls: 'Récupération du contenu des URLs...',
  generating_json: 'Génération du JSON via IA...',
  exploring_page: 'Exploration des pages...',
  extracting_features: 'Détection des services...',
  completed: 'Terminé',
}

/**
 * Génère le JSON via SSE (Server-Sent Events)
 * Remplace l'ancien système de polling
 */
const generateWithSSE = (urls: string[], method: 'direct' | 'agent'): Promise<any> => {
  return new Promise((resolve, reject) => {
    const encodedUrls = urls.map((url) => encodeURIComponent(url)).join(',')
    const sseUrl = `/api/admin/generate-import-json-stream?method=${method}&urls=${encodedUrls}`

    // withCredentials: true pour envoyer les cookies de session
    const eventSource = new EventSource(sseUrl, { withCredentials: true })
    let result: any = null

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log('[SSE] Event received:', data.type)

        switch (data.type) {
          case 'connected':
            console.log(`[SSE] Connecté: method=${data.method}, urls=${data.urlCount}`)
            break

          case 'ping':
            // Ping pour maintenir la connexion ouverte - ignorer silencieusement
            break

          case 'step':
            // Mettre à jour l'étape en cours
            if (method === 'direct') {
              simpleStep.value = data.step
              simpleStatus.value = data.label || stepLabels[data.step] || ''
            } else {
              agentStatus.value = data.label || stepLabels[data.step] || ''
            }
            break

          case 'progress':
            // Mettre à jour la progression (spécifique à l'agent)
            if (method === 'agent') {
              agentPagesVisited.value = data.urlsVisited || 0
              agentProgress.value = Math.round((data.urlsVisited / data.maxUrls) * 100)
            }
            break

          case 'url_fetched':
            console.log(`[SSE] URL récupérée: ${data.currentUrl}`)
            break

          case 'result':
            result = {
              success: data.success,
              json: data.json,
              provider: data.provider,
              urlsProcessed: data.urlsProcessed,
            }
            if (method === 'agent') {
              agentPagesVisited.value = data.urlsProcessed || 0
            }
            // Ne pas fermer ici, attendre que le serveur ferme
            break

          case 'error':
            eventSource.close()
            reject(new Error(data.message || 'Erreur inconnue'))
            break
        }
      } catch (err) {
        console.error('[SSE] Erreur parsing:', err)
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
      // Si on a un résultat, c'est que la connexion s'est fermée normalement après le résultat
      if (result) {
        resolve(result)
      } else {
        reject(new Error('Connexion SSE perdue'))
      }
    }

    // Timeout de sécurité (5 minutes)
    setTimeout(
      () => {
        if (eventSource.readyState !== EventSource.CLOSED) {
          eventSource.close()
          if (result) {
            resolve(result)
          } else {
            reject(new Error('Timeout: la génération a pris trop de temps'))
          }
        }
      },
      5 * 60 * 1000
    )
  })
}

/**
 * Formate un timestamp Unix en date lisible
 */
const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp * 1000)
  return date.toLocaleString('fr-FR', {
    dateStyle: 'full',
    timeStyle: 'short',
  })
}

/**
 * Teste les URLs fournies sans passer par l'IA
 */
const testUrls = async () => {
  generateError.value = ''
  testResults.value = []
  selectedTestUrl.value = ''

  // Parser les URLs (une par ligne)
  const urls = urlsInput.value
    .split('\n')
    .map((url) => url.trim())
    .filter((url) => url.length > 0)

  if (urls.length === 0) {
    generateError.value = t('admin.import.no_urls')
    return
  }

  // Valider les URLs
  const invalidUrls = urls.filter((url) => {
    try {
      new URL(url)
      return false
    } catch {
      return true
    }
  })

  if (invalidUrls.length > 0) {
    generateError.value = t('admin.import.invalid_urls', { urls: invalidUrls.join(', ') })
    return
  }

  if (urls.length > 5) {
    generateError.value = t('admin.import.too_many_urls')
    return
  }

  try {
    testingUrls.value = true

    const response = await $fetch('/api/admin/test-urls', {
      method: 'POST',
      body: { urls },
    })

    testResults.value = response.results
    // Sélectionner automatiquement la première URL
    if (response.results.length > 0) {
      selectedTestUrl.value = response.results[0].url
    }

    useToast().add({
      title: t('admin.import.test_success'),
      description: t('admin.import.test_success_description', { count: response.results.length }),
      color: 'success',
    })
  } catch (error: any) {
    generateError.value = error?.data?.message || error?.message || t('admin.import.test_failed')
  } finally {
    testingUrls.value = false
  }
}

const generateFromUrls = async () => {
  generateError.value = ''
  // Réinitialiser l'état de la méthode simple
  simpleStatus.value = t('admin.import.simple_starting')
  simpleStep.value = ''
  // Réinitialiser l'état de l'agent
  agentResult.value = null
  agentProgress.value = 0
  agentPagesVisited.value = 0
  agentStatus.value = t('admin.import.agent_starting')

  // Parser les URLs (une par ligne)
  const urls = urlsInput.value
    .split('\n')
    .map((url) => url.trim())
    .filter((url) => url.length > 0)

  if (urls.length === 0) {
    generateError.value = t('admin.import.no_urls')
    return
  }

  // Valider les URLs
  const invalidUrls = urls.filter((url) => {
    try {
      new URL(url)
      return false
    } catch {
      return true
    }
  })

  if (invalidUrls.length > 0) {
    generateError.value = t('admin.import.invalid_urls', { urls: invalidUrls.join(', ') })
    return
  }

  if (urls.length > 5) {
    generateError.value = t('admin.import.too_many_urls')
    return
  }

  try {
    generating.value = true

    // Utiliser SSE au lieu du polling
    const method = generationMethod.value === 'agent' ? 'agent' : 'direct'
    const result = await generateWithSSE(urls, method)

    if (generationMethod.value === 'agent') {
      agentResult.value = result
    }

    // Mettre le JSON généré dans le champ d'input et le formater
    try {
      const parsed = JSON.parse(result.json)
      jsonInput.value = JSON.stringify(parsed, null, 2)
    } catch {
      jsonInput.value = result.json
    }

    // Réinitialiser les résultats de validation
    validationResult.value = null
    importResult.value = null

    useToast().add({
      title: t('admin.import.generate_success'),
      description: t('admin.import.generate_success_description', { provider: result.provider }),
      color: 'success',
    })
  } catch (error: any) {
    generateError.value =
      error?.data?.message || error?.message || t('admin.import.generate_failed')
  } finally {
    generating.value = false
  }
}
</script>
