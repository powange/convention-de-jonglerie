import { ref, watch, type Ref } from 'vue'

/**
 * Composable pour debouncer une valeur réactive
 * @param value - La valeur réactive à debouncer
 * @param delay - Le délai en millisecondes (défaut: 300ms)
 * @returns La valeur debouncée
 */
export function useDebounce<T>(value: Ref<T>, delay: number = 300): Ref<T> {
  const debouncedValue = ref(value.value) as Ref<T>
  let timeout: NodeJS.Timeout

  watch(
    value,
    (newValue) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        debouncedValue.value = newValue
      }, delay)
    },
    { immediate: false }
  )

  return debouncedValue
}

/**
 * Composable pour debouncer une fonction
 * @param fn - La fonction à debouncer
 * @param delay - Le délai en millisecondes (défaut: 300ms)
 * @returns La fonction debouncée
 */
export function useDebouncedFunction<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300
): T {
  let timeout: NodeJS.Timeout

  return ((...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      fn(...args)
    }, delay)
  }) as T
}

/**
 * Hook pour créer un état de recherche avec debounce
 * @param initialValue - Valeur initiale
 * @param delay - Délai de debounce
 * @returns { query, debouncedQuery, setQuery, clearQuery }
 */
export function useSearchDebounce(initialValue: string = '', delay: number = 300) {
  const query = ref(initialValue)
  const debouncedQuery = useDebounce(query, delay)

  const setQuery = (value: string) => {
    query.value = value
  }

  const clearQuery = () => {
    query.value = ''
  }

  return {
    query,
    debouncedQuery,
    setQuery,
    clearQuery,
  }
}
