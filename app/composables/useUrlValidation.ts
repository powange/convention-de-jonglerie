/**
 * Composable pour la validation et le parsing d'URLs
 */

export interface UrlValidationResult {
  success: boolean
  urls?: string[]
  error?: string
}

export const useUrlValidation = () => {
  const { t } = useI18n()

  /**
   * Parse et valide une liste d'URLs (une par ligne)
   * @param input - Texte contenant les URLs (une par ligne)
   * @param maxUrls - Nombre maximum d'URLs autorisées (défaut: 5)
   * @returns Résultat de la validation
   */
  const parseAndValidateUrls = (input: string, maxUrls: number = 5): UrlValidationResult => {
    // Parser les URLs (une par ligne)
    const urls = input
      .split('\n')
      .map((url) => url.trim())
      .filter((url) => url.length > 0)

    if (urls.length === 0) {
      return { success: false, error: t('admin.import.no_urls') }
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
      return {
        success: false,
        error: t('admin.import.invalid_urls', { urls: invalidUrls.join(', ') }),
      }
    }

    if (urls.length > maxUrls) {
      return { success: false, error: t('admin.import.too_many_urls') }
    }

    return { success: true, urls }
  }

  /**
   * Extrait le hostname d'une URL
   * @param url - URL à parser
   * @returns Hostname sans "www."
   */
  const getHostname = (url: string): string => {
    try {
      return new URL(url).hostname.replace('www.', '')
    } catch {
      return url
    }
  }

  /**
   * Vérifie si une URL est valide
   * @param url - URL à vérifier
   * @returns true si l'URL est valide
   */
  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  return {
    parseAndValidateUrls,
    getHostname,
    isValidUrl,
  }
}
