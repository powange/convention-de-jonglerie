/**
 * Middleware global pour charger les traductions à la demande selon la route
 *
 * Ce middleware charge automatiquement les fichiers de traduction nécessaires
 * en fonction de la route visitée, permettant de réduire la taille du bundle initial.
 */

import { translationLoaders, getTranslationsToLoad } from '~/utils/translation-loaders'

export default defineNuxtRouteMiddleware(async (to) => {
  // Accéder à i18n via nuxtApp dans le contexte du middleware
  const nuxtApp = useNuxtApp()
  const i18n = nuxtApp.$i18n

  if (!i18n) {
    return
  }

  const locale = i18n.locale.value

  // Déterminer quels fichiers de traduction charger
  const translationsToLoad = getTranslationsToLoad(to.path)

  // Charger les traductions nécessaires
  if (translationsToLoad.length > 0) {
    try {
      // Éviter de charger plusieurs fois les mêmes traductions
      const loadedKey = `_loaded_${locale}`
      if (!(nuxtApp as any)[loadedKey]) {
        ;(nuxtApp as any)[loadedKey] = new Set()
      }

      for (const translationFile of translationsToLoad) {
        // Vérifier si déjà chargé
        if ((nuxtApp as any)[loadedKey].has(translationFile)) {
          continue
        }

        // Charger les traductions via le loader statique
        const loader = translationLoaders[translationFile]?.[locale]
        if (loader) {
          const messages = await loader().then((m) => m.default || m)

          // Fusionner avec les messages existants
          i18n.mergeLocaleMessage(locale, messages)

          // Marquer comme chargé
          ;(nuxtApp as any)[loadedKey].add(translationFile)
        }
      }
    } catch (error) {
      console.error(`Erreur lors du chargement des traductions pour ${to.path}:`, error)
    }
  }
})
