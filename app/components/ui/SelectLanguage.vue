<template>
  <UDropdownMenu :items="languageItems">
    <UButton
      color="neutral"
      variant="ghost"
      :size="showLabel ? 'sm' : 'xs'"
      :class="showLabel ? '' : 'sm:size-sm!'"
      :title="$t('footer.language_selector')"
    >
      <span v-if="currentLanguageFlag" :class="currentLanguageFlag" class="w-4 h-3" />
      <span v-if="showLabel" class="text-sm">{{ currentLanguageName }}</span>
    </UButton>

    <!-- Slots pour les drapeaux de chaque langue -->
    <template v-for="lang in locales" :key="lang.code" #[`lang-${lang.code}-leading`]>
      <span :class="languageCodeToFlag(lang.code)" class="w-4 h-3 shrink-0" />
    </template>
  </UDropdownMenu>
</template>

<script setup lang="ts">
import { translationLoaders, getTranslationsToLoad } from '~/utils/translation-loaders'

import { languageCodeToFlag } from '~~/app/utils/locales'

withDefaults(defineProps<{ showLabel?: boolean }>(), { showLabel: false })

const { locale, locales, setLocale } = useI18n()

// Langue courante avec son drapeau
const currentLanguageFlag = computed(() => {
  return languageCodeToFlag(locale.value)
})

// Nom de la langue courante
const currentLanguageName = computed(() => {
  const lang = locales.value.find((l) => l.code === locale.value)
  return lang?.name || locale.value
})

// Configuration des items du dropdown de langues
const languageItems = computed(() => {
  return locales.value.map((lang) => ({
    label: lang.name,
    onSelect: () => changeLanguage(lang.code),
    class: locale.value === lang.code ? 'bg-gray-100 dark:bg-gray-700' : '',
    slot: `lang-${lang.code}`,
    flagClass: languageCodeToFlag(lang.code),
  }))
})

// Fonction pour changer de langue
const changeLanguage = async (newLocale: string) => {
  const nuxtApp = useNuxtApp()
  const i18n = nuxtApp.$i18n

  // Réinitialiser le cache des traductions pour la nouvelle locale
  // pour forcer le rechargement des fichiers de traduction lazy-loaded
  ;(nuxtApp as any)[`_loaded_${newLocale}`] = new Set()

  // Recharger manuellement les traductions pour la route actuelle
  const route = useRoute()
  const path = route.path

  // Déterminer quelles traductions charger selon la route
  const translationsToLoad = getTranslationsToLoad(path)

  // Charger les traductions manuellement
  for (const translationFile of translationsToLoad) {
    const loader = translationLoaders[translationFile]?.[newLocale]
    if (loader) {
      try {
        const messages = await loader().then((m) => m.default || m)
        i18n.mergeLocaleMessage(newLocale, messages)
      } catch (error) {
        console.error(`Erreur lors du chargement de ${translationFile} pour ${newLocale}:`, error)
      }
    }
  }

  // Changer la locale
  await setLocale(newLocale as any)
}
</script>
