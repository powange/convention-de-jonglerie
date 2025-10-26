<template>
  <UCard v-if="artist">
    <div class="space-y-4">
      <!-- En-tête -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="flex items-center justify-center w-12 h-12 rounded-xl bg-yellow-100 dark:bg-yellow-900/30"
          >
            <UIcon name="i-heroicons-star" class="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ $t('edition.artists.my_artist_pass', 'Pass Artiste') }}
            </h2>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ $t('edition.artists.artist_access', 'Accès réservé aux artistes') }}
            </p>
          </div>
        </div>
      </div>

      <!-- Carte artiste -->
      <div
        class="p-4 rounded-xl bg-gradient-to-br from-yellow-50 to-yellow-100/50 dark:from-yellow-900/20 dark:to-yellow-800/10 border border-yellow-200 dark:border-yellow-800/30"
      >
        <div class="flex items-start justify-between gap-4">
          <!-- Informations de l'artiste -->
          <div class="flex-1 min-w-0 space-y-3">
            <div>
              <p class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ artist.firstName }} {{ artist.lastName }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-500">{{ artist.email }}</p>
            </div>

            <!-- Dates -->
            <div v-if="artist.arrivalDateTime || artist.departureDateTime" class="space-y-1">
              <div v-if="artist.arrivalDateTime" class="flex items-center gap-2 text-xs">
                <UIcon name="i-heroicons-arrow-down-tray" class="h-3 w-3 text-gray-500" />
                <span class="text-gray-600 dark:text-gray-400">
                  Arrivée : {{ artist.arrivalDateTime }}
                </span>
              </div>
              <div v-if="artist.departureDateTime" class="flex items-center gap-2 text-xs">
                <UIcon name="i-heroicons-arrow-up-tray" class="h-3 w-3 text-gray-500" />
                <span class="text-gray-600 dark:text-gray-400">
                  Départ : {{ artist.departureDateTime }}
                </span>
              </div>
            </div>

            <!-- Spectacles -->
            <div v-if="artist.shows && artist.shows.length > 0" class="space-y-1">
              <p class="text-xs font-medium text-gray-700 dark:text-gray-300">
                {{ $t('edition.shows.title') }} :
              </p>
              <div class="flex flex-wrap gap-1">
                <UBadge
                  v-for="show in artist.shows"
                  :key="show.id"
                  color="purple"
                  variant="subtle"
                  size="sm"
                >
                  {{ show.title }}
                </UBadge>
              </div>
            </div>

            <!-- Articles à récupérer -->
            <div
              v-if="artist.returnableItems && artist.returnableItems.length > 0"
              class="space-y-1"
            >
              <p class="text-xs font-medium text-gray-700 dark:text-gray-300">
                {{ $t('edition.shows.items_to_receive', 'Articles à récupérer') }} :
              </p>
              <div class="flex flex-wrap gap-1">
                <UBadge
                  v-for="item in artist.returnableItems"
                  :key="item.id"
                  color="blue"
                  variant="subtle"
                  size="sm"
                >
                  {{ item.name }}
                </UBadge>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex flex-col items-end gap-2">
            <!-- Bouton QR Code -->
            <UButton
              icon="i-heroicons-qr-code"
              color="primary"
              variant="soft"
              size="sm"
              @click="showQrCodeModal"
            >
              QR Code
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </UCard>

  <!-- Modal QR Code -->
  <UModal
    v-model:open="qrModalOpen"
    :title="$t('edition.artists.artist_qr_code', 'QR Code Artiste')"
  >
    <template #body>
      <div v-if="artist" class="space-y-4">
        <!-- Instructions -->
        <div
          class="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800"
        >
          <div class="flex items-start gap-3">
            <UIcon
              name="i-heroicons-information-circle"
              class="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5"
            />
            <div class="text-sm text-yellow-700 dark:text-yellow-300">
              <p class="font-medium mb-1">
                {{
                  $t('edition.artists.qr_code_instructions_title', 'Comment utiliser ce QR code')
                }}
              </p>
              <p>
                {{
                  $t(
                    'edition.artists.qr_code_instructions',
                    "Présentez ce QR code au contrôle d'accès pour valider votre entrée en tant qu'artiste."
                  )
                }}
              </p>
            </div>
          </div>
        </div>

        <!-- QR Code -->
        <div class="flex flex-col items-center justify-center p-6">
          <Qrcode :value="artist.qrCode" variant="default" />
          <p class="mt-3 text-xs text-gray-500 dark:text-gray-400 font-mono">
            {{ artist.qrCode }}
          </p>
        </div>

        <!-- Informations de l'artiste -->
        <div class="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            {{ $t('edition.artists.details', 'Détails') }}
          </h4>
          <div class="space-y-2 text-sm">
            <div class="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <UIcon name="i-heroicons-user" class="w-4 h-4" />
              <span>{{ artist.firstName }} {{ artist.lastName }}</span>
            </div>
            <div
              v-if="artist.shows && artist.shows.length > 0"
              class="flex items-start gap-2 text-gray-600 dark:text-gray-400"
            >
              <UIcon name="i-heroicons-sparkles" class="w-4 h-4 mt-0.5" />
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="(show, index) in artist.shows"
                  :key="show.id"
                  class="inline-flex items-center"
                >
                  {{ show.title }}<span v-if="index < artist.shows.length - 1">,&nbsp;</span>
                </span>
              </div>
            </div>
            <div
              v-if="artist.returnableItems && artist.returnableItems.length > 0"
              class="flex items-start gap-2 text-gray-600 dark:text-gray-400"
            >
              <UIcon name="i-heroicons-gift" class="w-4 h-4 mt-0.5" />
              <div>
                <p class="text-xs font-medium mb-1">
                  {{ $t('edition.shows.items_to_receive', 'Articles à récupérer') }}
                </p>
                <div class="flex flex-wrap gap-1">
                  <UBadge
                    v-for="item in artist.returnableItems"
                    :key="item.id"
                    color="blue"
                    variant="subtle"
                    size="sm"
                  >
                    {{ item.name }}
                  </UBadge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
interface ArtistShow {
  id: number
  title: string
  startDateTime: string
  location: string | null
}

interface ReturnableItem {
  id: number
  name: string
}

interface Artist {
  id: number
  firstName: string
  lastName: string
  email: string
  qrCode: string
  arrivalDateTime: string | null
  departureDateTime: string | null
  dietaryPreference: string
  allergies: string | null
  allergySeverity: string | null
  shows: ArtistShow[]
  returnableItems: ReturnableItem[]
}

const props = defineProps<{
  editionId: number
}>()

const artist = ref<Artist | null>(null)
const qrModalOpen = ref(false)

// Charger les informations de l'artiste
const loadArtistInfo = async () => {
  try {
    const response = await $fetch(`/api/editions/${props.editionId}/my-artist-info`)
    artist.value = response.artist
  } catch (error) {
    console.error("Erreur lors du chargement des informations de l'artiste:", error)
  }
}

const showQrCodeModal = () => {
  qrModalOpen.value = true
}

// Charger les informations au montage du composant
onMounted(() => {
  loadArtistInfo()
})
</script>
