<template>
  <footer class="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 mt-auto">
    <div class="max-w-7xl mx-auto px-4 py-6">
      <div class="flex flex-col sm:flex-row justify-between items-center gap-4">
        <!-- Copyright -->
        <div class="text-sm text-gray-600 dark:text-gray-400">
          {{ $t('footer.copyright', { year: new Date().getFullYear() }) }}
        </div>
        
        <!-- Sélecteur de langue -->
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600 dark:text-gray-400">{{ $t('footer.language_selector') }}:</span>
          <UDropdownMenu 
            :items="languageItems"
          >
            <UButton
              :label="currentLanguage?.name"
              :icon="currentLanguage?.flag"
              variant="ghost"
              color="gray"
              size="sm"
              trailing-icon="i-heroicons-chevron-down-20-solid"
            />
          </UDropdownMenu>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
const { locale, locales, setLocale } = useI18n()

// Mapping des langues avec leurs drapeaux
const languageConfig = {
  fr: { name: 'Français', flag: 'fi fi-fr' },
  en: { name: 'English', flag: 'fi fi-gb' }
}

// Langue courante avec son drapeau
const currentLanguage = computed(() => {
  return languageConfig[locale.value as keyof typeof languageConfig]
})

// Items pour le dropdown menu
const languageItems = computed(() => 
  locales.value.map(lang => ({
    label: languageConfig[lang.code as keyof typeof languageConfig]?.name || lang.name,
    icon: languageConfig[lang.code as keyof typeof languageConfig]?.flag,
    onSelect: () => changeLanguage(lang.code)
  }))
)

// Fonction pour changer de langue
const changeLanguage = (newLocale: string) => {
  setLocale(newLocale)
}
</script>

<style scoped>
/* Import des drapeaux si pas déjà fait */
@import 'flag-icons/css/flag-icons.min.css';
</style>