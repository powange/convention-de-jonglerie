<template>
  <UDropdownMenu :items="languageItems">
    <UButton
      color="neutral"
      variant="ghost"
      :size="showLabel ? 'sm' : 'xs'"
      :class="showLabel ? '' : 'sm:size-sm!'"
      :title="$t('footer.language_selector')"
    >
      <UIcon v-if="currentLanguageFlag" :name="currentLanguageFlag" class="w-4 h-3" />
      <span v-if="showLabel" class="text-sm">{{ currentLanguageName }}</span>
    </UButton>

    <!-- Slots pour les drapeaux de chaque langue.
         Passer par UIcon plutôt que par la classe seule : la classe `i-flag:xx-4x3` ne produit
         rien tant qu'aucun UIcon n'a chargé cette icône dans la page. Seuls les drapeaux
         présents ailleurs — la locale courante, le pays d'une édition affichée — s'affichaient,
         les autres restaient vides. -->
    <template v-for="lang in locales" :key="lang.code" #[`lang-${lang.code}-leading`]>
      <UIcon :name="languageCodeToFlag(lang.code) ?? ''" class="w-4 h-3 shrink-0" />
    </template>
  </UDropdownMenu>
</template>

<script setup lang="ts">
import { languageCodeToFlag } from '~~/app/utils/locales'

withDefaults(defineProps<{ showLabel?: boolean }>(), { showLabel: false })

const { locale, locales } = useI18n()

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
  }))
})

/*
 * La séquence — vider le cache des domaines, recharger ceux de la route, puis changer la locale —
 * vit désormais dans `useChangementDeLangue`, parce qu'un second appelant la demande :
 * l'application de la langue du PROFIL à l'hydratation de la session. Recopiée, elle aurait
 * divergé au premier domaine ajouté, et la moitié d'un écran serait restée en clés brutes.
 */
const { changerDeLangue: changeLanguage } = useChangementDeLangue()
</script>
