<template>
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
            <li><code>edition.startDate</code> - Date de début (YYYY-MM-DD ou format ISO UTC)</li>
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
            <li><code>edition.jugglingEdgeUrl</code> - URL JugglingEdge</li>
            <li>
              <code>edition.status</code> - Statut de l'édition (PLANNED | PUBLISHED | OFFLINE |
              CANCELLED)
            </li>
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
</template>

<script setup lang="ts">
defineProps<{
  /** JSON d'exemple à afficher */
  exampleJson: string
}>()
</script>
