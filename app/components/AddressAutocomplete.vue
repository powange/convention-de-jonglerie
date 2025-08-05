<template>
  <UFormField :label="$t('forms.labels.full_address')" name="fullAddress">
    <UInput
      v-model="searchQuery"
      icon="i-lucide-search"
      :placeholder="$t('forms.placeholders.start_typing_address')"
      size="lg"
      class="w-full"
      @input="_handleInput"
    />
    <div v-if="suggestions.length > 0" class="mt-2 border rounded-md">
      <UButton
        v-for="suggestion in suggestions"
        :key="suggestion.place_id"
        variant="ghost"
        class="w-full text-left px-3 py-2"
        @click="selectAddress(suggestion)"
      >
        {{ suggestion.display_name }}
      </UButton>
    </div>
  </UFormField>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const { $t } = useI18n();

interface NominatimAddress {
  house_number?: string;
  road?: string;
  suburb?: string;
  neighbourhood?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  county?: string;
  country?: string;
  country_code?: string;
}

interface NominatimSuggestion {
  place_id: number;
  display_name: string;
  address: NominatimAddress;
}

const emit = defineEmits(['address-selected']);

const searchQuery = ref('');
const suggestions = ref<NominatimSuggestion[]>([]);

let debounceTimer: NodeJS.Timeout | null = null;

const _handleInput = (_e: Event) => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    if (searchQuery.value.length < 3) {
      suggestions.value = [];
      return;
    }
    fetchSuggestions();
  }, 300); // Debounce for 300ms
};

const fetchSuggestions = async () => {
  try {
    const response = await $fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.value)}&addressdetails=1&limit=5&countrycodes=fr,de,es,gb,it`, {
      headers: {
        'User-Agent': 'ConventionJonglerieApp/1.0 (contact@yourdomain.com)',
      },
    });
    suggestions.value = response as NominatimSuggestion[];
  } catch (error) {
    console.error('Error fetching address suggestions:', error);
    suggestions.value = [];
  }
};

const selectAddress = (suggestion: NominatimSuggestion) => {
  const address = suggestion.address;
  const parsedAddress = {
    addressLine1: `${address.house_number || ''} ${address.road || ''}`.trim() || suggestion.display_name.split(',')[0].trim(),
    addressLine2: address.suburb || address.neighbourhood || '',
    postalCode: address.postcode || '',
    city: address.city || address.town || address.village || '',
    region: address.state || address.county || '',
    country: address.country || '',
  };

  emit('address-selected', parsedAddress);
  searchQuery.value = suggestion.display_name;
  suggestions.value = [];
};
</script>
