<template>
  <UDropdownMenu :items="languageItems">
    <UButton
      color="neutral"
      variant="ghost"
      size="xs"
      class="sm:!size-sm"
      :title="$t('footer.language_selector')"
    >
      <span v-if="currentLanguage?.flag" :class="currentLanguage.flag" class="w-4 h-3" />
    </UButton>

    <!-- Slots pour les drapeaux de chaque langue -->
    <template v-for="lang in locales" :key="lang.code" #[`lang-${lang.code}-leading`]>
      <span
        :class="languageConfig[lang.code as keyof typeof languageConfig]?.flag"
        class="w-4 h-3 shrink-0"
      />
    </template>
  </UDropdownMenu>
</template>

<script setup lang="ts">
const { locale, locales, setLocale } = useI18n()

// Configuration des langues avec leurs drapeaux
const languageConfig = {
  en: { name: 'English', flag: 'fi fi-gb' },
  da: { name: 'Dansk', flag: 'fi fi-dk' },
  de: { name: 'Deutsch', flag: 'fi fi-de' },
  es: { name: 'Español', flag: 'fi fi-es' },
  fr: { name: 'Français', flag: 'fi fi-fr' },
  it: { name: 'Italiano', flag: 'fi fi-it' },
  nl: { name: 'Nederlands', flag: 'fi fi-nl' },
  pl: { name: 'Polski', flag: 'fi fi-pl' },
  pt: { name: 'Português', flag: 'fi fi-pt' },
  ru: { name: 'Русский', flag: 'fi fi-ru' },
  uk: { name: 'Українська', flag: 'fi fi-ua' },
  cs: { name: 'Čeština', flag: 'fi fi-cz' },
  sv: { name: 'Svenska', flag: 'fi fi-se' },
}

// Langue courante avec son drapeau
const currentLanguage = computed(() => {
  return languageConfig[locale.value as keyof typeof languageConfig]
})

// Configuration des items du dropdown de langues
const languageItems = computed(() => {
  return locales.value.map((lang) => ({
    label: languageConfig[lang.code as keyof typeof languageConfig]?.name,
    onSelect: () => changeLanguage(lang.code),
    class: locale.value === lang.code ? 'bg-gray-100 dark:bg-gray-700' : '',
    slot: `lang-${lang.code}`,
    flagClass: languageConfig[lang.code as keyof typeof languageConfig]?.flag,
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
  let translationsToLoad: string[] = []
  if (path.startsWith('/editions')) {
    translationsToLoad = ['edition']
  } else if (path.startsWith('/admin')) {
    translationsToLoad = ['admin', 'auth']
  } else if (
    path.startsWith('/auth') ||
    path.startsWith('/login') ||
    path.startsWith('/register') ||
    path.startsWith('/profile')
  ) {
    translationsToLoad = ['auth']
  }

  // Map des loaders (copié depuis le middleware)
  const translationLoaders: Record<string, Record<string, () => Promise<any>>> = {
    edition: {
      en: () => import('~~/i18n/locales/en/edition.json'),
      da: () => import('~~/i18n/locales/da/edition.json'),
      de: () => import('~~/i18n/locales/de/edition.json'),
      es: () => import('~~/i18n/locales/es/edition.json'),
      fr: () => import('~~/i18n/locales/fr/edition.json'),
      it: () => import('~~/i18n/locales/it/edition.json'),
      nl: () => import('~~/i18n/locales/nl/edition.json'),
      pl: () => import('~~/i18n/locales/pl/edition.json'),
      pt: () => import('~~/i18n/locales/pt/edition.json'),
      ru: () => import('~~/i18n/locales/ru/edition.json'),
      uk: () => import('~~/i18n/locales/uk/edition.json'),
      cs: () => import('~~/i18n/locales/cs/edition.json'),
      sv: () => import('~~/i18n/locales/sv/edition.json'),
    },
    admin: {
      en: () => import('~~/i18n/locales/en/admin.json'),
      da: () => import('~~/i18n/locales/da/admin.json'),
      de: () => import('~~/i18n/locales/de/admin.json'),
      es: () => import('~~/i18n/locales/es/admin.json'),
      fr: () => import('~~/i18n/locales/fr/admin.json'),
      it: () => import('~~/i18n/locales/it/admin.json'),
      nl: () => import('~~/i18n/locales/nl/admin.json'),
      pl: () => import('~~/i18n/locales/pl/admin.json'),
      pt: () => import('~~/i18n/locales/pt/admin.json'),
      ru: () => import('~~/i18n/locales/ru/admin.json'),
      uk: () => import('~~/i18n/locales/uk/admin.json'),
      cs: () => import('~~/i18n/locales/cs/admin.json'),
      sv: () => import('~~/i18n/locales/sv/admin.json'),
    },
    auth: {
      en: () => import('~~/i18n/locales/en/auth.json'),
      da: () => import('~~/i18n/locales/da/auth.json'),
      de: () => import('~~/i18n/locales/de/auth.json'),
      es: () => import('~~/i18n/locales/es/auth.json'),
      fr: () => import('~~/i18n/locales/fr/auth.json'),
      it: () => import('~~/i18n/locales/it/auth.json'),
      nl: () => import('~~/i18n/locales/nl/auth.json'),
      pl: () => import('~~/i18n/locales/pl/auth.json'),
      pt: () => import('~~/i18n/locales/pt/auth.json'),
      ru: () => import('~~/i18n/locales/ru/auth.json'),
      uk: () => import('~~/i18n/locales/uk/auth.json'),
      cs: () => import('~~/i18n/locales/cs/auth.json'),
      sv: () => import('~~/i18n/locales/sv/auth.json'),
    },
  }

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
