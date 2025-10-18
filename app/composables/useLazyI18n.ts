/**
 * Composable pour charger dynamiquement des fichiers de traduction i18n
 * au niveau d'un composant spécifique
 */

/**
 * Charge un fichier de traduction i18n de manière lazy pour la locale courante
 * et le fusionne avec les traductions existantes
 *
 * IMPORTANT: Ce composable doit être utilisé avec `await` dans un `<script setup>`
 * pour charger les traductions AVANT le rendu du composant.
 *
 * @param namespace - Le nom du fichier de traduction (ex: 'permissions', 'feedback')
 * @returns Une promesse qui se résout en un objet avec isLoaded (ref indiquant si le fichier est chargé)
 *
 * @example
 * ```vue
 * <script setup>
 * // Charge permissions.json AVANT le rendu du composant
 * await useLazyI18n('permissions')
 * </script>
 * ```
 */
export async function useLazyI18n(namespace: string) {
  const i18n = useI18n()
  const { locale } = i18n
  const isLoaded = ref(false)

  /**
   * Charge le fichier de traduction pour une locale donnée
   */
  const loadMessages = async (targetLocale: string) => {
    try {
      const messages = await import(`~~/i18n/locales/${targetLocale}/${namespace}.json`)
      i18n.mergeLocaleMessage(targetLocale, messages.default || messages)
      isLoaded.value = true
    } catch (error) {
      console.error(
        `[useLazyI18n] Erreur lors du chargement de ${namespace}.json pour la locale ${targetLocale}:`,
        error
      )
    }
  }

  // Charger immédiatement les messages pour la locale courante (avant le rendu)
  await loadMessages(locale.value)

  // Recharger les messages si la locale change
  watch(locale, async (newLocale) => {
    await loadMessages(newLocale)
  })

  return {
    isLoaded,
  }
}
