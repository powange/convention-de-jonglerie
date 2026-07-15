import { useRoute } from 'vue-router'

/**
 * Lecture typée et défensive des filtres depuis la query string.
 *
 * Sert à initialiser des filtres depuis une URL partagée : chaque valeur est validée, donc une URL
 * trafiquée ou obsolète retombe sur le défaut au lieu de casser la page.
 *
 * À utiliser dans `setup()` uniquement (lecture ponctuelle à l'initialisation, pas de réactivité).
 * Le sens inverse — écrire les filtres dans l'URL — reste à la charge de la page, car ce qui compte
 * comme « valeur par défaut » (donc omise de l'URL) lui est propre.
 *
 * @returns { queryValue, queryEnum, queryBool, queryNumber, queryList }
 */
export function useQueryFilters() {
  const route = useRoute()

  /**
   * Valeur brute d'un paramètre. `?a=1&a=2` renvoie la première occurrence,
   * `?a` (sans valeur) renvoie undefined.
   * @param key - Nom du paramètre
   */
  const queryValue = (key: string): string | undefined => {
    const value = Array.isArray(route.query[key]) ? route.query[key][0] : route.query[key]
    return typeof value === 'string' ? value : undefined
  }

  /**
   * Valeur restreinte à une liste d'options connues.
   * @param key - Nom du paramètre
   * @param options - Options autorisées, sous la forme utilisée par les USelect du projet
   * @param fallback - Valeur retenue si le paramètre est absent ou invalide
   */
  const queryEnum = <T extends string>(
    key: string,
    options: readonly { value: T }[],
    fallback: T
  ): T => {
    const value = queryValue(key)
    return options.some((option) => option.value === value) ? (value as T) : fallback
  }

  /**
   * Booléen. Seul `?key=true` vaut vrai, `?key=false` vaut faux ; absent ou vide (`?key=`)
   * retombe sur le défaut.
   * @param key - Nom du paramètre
   * @param fallback - Valeur retenue si le paramètre est absent ou vide
   */
  const queryBool = (key: string, fallback: boolean = false): boolean => {
    const value = queryValue(key)
    if (!value) return fallback
    return value === 'true'
  }

  /**
   * Entier borné par le bas. `?page=abc`, `?page=0` ou `?page=-5` retombent sur `min`.
   * @param key - Nom du paramètre
   * @param fallback - Valeur retenue si le paramètre est absent ou invalide
   * @param min - Borne inférieure appliquée au résultat
   */
  const queryNumber = (key: string, fallback: number, min: number = fallback): number => {
    const parsed = Number.parseInt(queryValue(key) || '', 10)
    return Number.isNaN(parsed) ? fallback : Math.max(min, parsed)
  }

  /**
   * Liste séparée par des virgules (`?categories=volunteer,artist`), plus lisible dans une URL
   * partagée qu'un tableau JSON encodé.
   * @param key - Nom du paramètre
   */
  const queryList = (key: string): string[] => {
    return (queryValue(key) || '').split(',').filter(Boolean)
  }

  return { queryValue, queryEnum, queryBool, queryNumber, queryList }
}
