/**
 * Composable pour gérer la liste des pays avec cache client
 */
export const useCountries = () => {
  const countries = useState<string[]>('countries', () => [])
  const loading = useState('countries-loading', () => false)
  const error = useState<Error | null>('countries-error', () => null)

  /**
   * Récupère la liste des pays depuis l'API
   * Cache automatiquement côté client pour éviter les requêtes multiples
   */
  const fetchCountries = async () => {
    // Éviter les requêtes multiples
    if (countries.value.length > 0 || loading.value) {
      return countries.value
    }

    loading.value = true
    error.value = null

    try {
      countries.value = await $fetch<string[]>('/api/countries')
    } catch (e) {
      error.value = e as Error
      console.error('Erreur lors de la récupération des pays:', e)
    } finally {
      loading.value = false
    }

    return countries.value
  }

  /**
   * Rafraîchit la liste des pays (force la requête API)
   */
  const refreshCountries = async () => {
    countries.value = []
    return fetchCountries()
  }

  return {
    countries: readonly(countries),
    loading: readonly(loading),
    error: readonly(error),
    fetchCountries,
    refreshCountries,
  }
}
