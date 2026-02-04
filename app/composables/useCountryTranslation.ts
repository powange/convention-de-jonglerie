import { translateCountry } from '~/utils/countries'

/**
 * Composable pour traduire les noms de pays selon la locale courante
 *
 * @example
 * const { translateCountryName } = useCountryTranslation()
 * const displayName = translateCountryName('Switzerland') // → "Suisse" en fr, "Switzerland" en en
 */
export function useCountryTranslation() {
  const { locale } = useI18n()

  /**
   * Traduit un nom de pays selon la locale courante
   */
  const translateCountryName = (countryName: string): string => {
    return translateCountry(countryName, locale.value)
  }

  return {
    translateCountryName,
  }
}
