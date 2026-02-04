import countries from 'i18n-iso-countries'

/**
 * Utilitaires client pour la gestion des noms de pays avec i18n-iso-countries.
 * Les locales sont initialisées par le plugin app/plugins/countries.client.ts
 */

// Cache pour optimiser les performances
const codeCache = new Map<string, string>()

// Locales dans lesquelles chercher les noms de pays
const SEARCH_LOCALES = [
  'fr',
  'en',
  'de',
  'es',
  'it',
  'nl',
  'pl',
  'pt',
  'ru',
  'sv',
  'uk',
  'cs',
  'da',
]

// Alias pour les noms de pays courants qui diffèrent des noms officiels ISO
// Permet la rétrocompatibilité avec les données existantes
const COUNTRY_ALIASES: Record<string, string> = {
  // Noms français courts → code ISO
  'États-Unis': 'US',
  'Etats-Unis': 'US',
  "Côte d'Ivoire": 'CI',
  "Cote d'Ivoire": 'CI',
  USA: 'US',
  Czechia: 'CZ',
  'République tchèque': 'CZ',
  // Noms anglais courants
  'United States': 'US',
  'United States of America': 'US',
  'Ivory Coast': 'CI',
  'Czech Republic': 'CZ',
  'South Korea': 'KR',
  'North Korea': 'KP',
  UK: 'GB',
  'United Kingdom': 'GB',
  'Great Britain': 'GB',
}

/**
 * Trouve le code ISO alpha-2 d'un pays à partir de son nom
 * Recherche dans toutes les locales supportées.
 *
 * @param countryName - Nom de pays dans n'importe quelle langue supportée
 * @returns Code ISO alpha-2 en minuscules, ou 'xx' si non trouvé
 */
export function getCountryCode(countryName: string): string {
  if (!countryName) return 'xx'

  // Vérifier le cache
  const cached = codeCache.get(countryName)
  if (cached) return cached

  // Vérifier d'abord les alias (noms courants non-officiels)
  const alias = COUNTRY_ALIASES[countryName]
  if (alias) {
    const result = alias.toLowerCase()
    codeCache.set(countryName, result)
    return result
  }

  // Chercher dans toutes les locales avec i18n-iso-countries
  for (const locale of SEARCH_LOCALES) {
    const code = countries.getAlpha2Code(countryName, locale)
    if (code) {
      const result = code.toLowerCase()
      codeCache.set(countryName, result)
      return result
    }
  }

  // Non trouvé
  codeCache.set(countryName, 'xx')
  return 'xx'
}

/**
 * Traduit un nom de pays vers la locale spécifiée
 *
 * @param countryName - Nom de pays dans n'importe quelle langue supportée
 * @param locale - Code de locale cible (ex: 'fr', 'en', 'de')
 * @returns Le nom traduit du pays, ou le nom original si non reconnu
 */
export function translateCountry(countryName: string, locale: string): string {
  if (!countryName) return countryName

  // Vérifier d'abord les alias
  const aliasCode = COUNTRY_ALIASES[countryName]
  if (aliasCode) {
    const translated = countries.getName(aliasCode, locale)
    if (translated) return translated
  }

  // Trouver le code ISO via i18n-iso-countries
  for (const searchLocale of SEARCH_LOCALES) {
    const code = countries.getAlpha2Code(countryName, searchLocale)
    if (code) {
      const translated = countries.getName(code, locale)
      if (translated) return translated
      break
    }
  }

  return countryName
}

/**
 * Traduit un nom de pays vers le français
 *
 * @param countryName - Nom de pays dans n'importe quelle langue supportée
 * @returns Le nom français du pays, ou le nom original si non reconnu
 */
export function translateToFrench(countryName: string): string {
  return translateCountry(countryName, 'fr')
}

/**
 * Traduit un nom de pays vers l'anglais
 *
 * @param countryName - Nom de pays dans n'importe quelle langue supportée
 * @returns Le nom anglais du pays, ou le nom original si non reconnu
 */
export function translateToEnglish(countryName: string): string {
  return translateCountry(countryName, 'en')
}

// Alias pour compatibilité
export const normalizeCountryName = translateToFrench

/**
 * Formate une liste de pays pour le multiselect avec drapeaux
 *
 * @param countryList - Liste de noms de pays
 * @returns Tableau d'options formatées avec label, value et flag
 */
export function formatCountriesForSelect(countryList: string[]) {
  return countryList.map((country) => ({
    label: country,
    value: country,
    flag: getCountryCode(country),
  }))
}

/**
 * Retourne la liste des noms de pays dans une locale donnée, triée alphabétiquement
 *
 * @param locale - Code de locale (défaut: 'fr')
 * @returns Tableau de noms de pays triés
 */
export function getCountryNames(locale: string = 'fr'): string[] {
  const names = countries.getNames(locale)
  if (!names || Object.keys(names).length === 0) {
    // Fallback vers le français si la locale n'est pas chargée
    const frNames = countries.getNames('fr')
    if (!frNames) return []
    return Object.values(frNames).sort((a, b) => a.localeCompare(b, 'fr'))
  }
  return Object.values(names).sort((a, b) => a.localeCompare(b, locale))
}

/**
 * Retourne les options de pays pour les composants USelect avec drapeaux
 *
 * @param locale - Code de locale (défaut: 'fr')
 * @returns Tableau d'options avec label, value et icon
 */
export function getCountrySelectOptions(locale: string = 'fr') {
  const names = countries.getNames(locale) || countries.getNames('fr')
  if (!names) return []

  return Object.entries(names)
    .map(([code, name]) => ({
      label: name,
      value: name,
      icon: `flag:${code.toLowerCase()}-4x3`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, locale))
}

// ============================================================================
// EXPORTS STATIQUES POUR COMPATIBILITÉ ARRIÈRE
// Ces exports sont évalués paresseusement via des getters pour fonctionner
// même si les locales ne sont pas encore chargées au moment de l'import
// ============================================================================

// Cache pour les exports statiques (évalués une seule fois)
let _countryNames: string[] | null = null
let _countrySelectOptions: ReturnType<typeof getCountrySelectOptions> | null = null
let _countryToCode: Record<string, string> | null = null

/**
 * Liste des noms de pays en français (triée alphabétiquement)
 * Compatible avec l'ancien export statique
 */
export const countryNames: string[] = new Proxy([] as string[], {
  get(target, prop) {
    // Initialisation paresseuse
    if (_countryNames === null) {
      _countryNames = getCountryNames('fr')
    }
    return Reflect.get(_countryNames, prop)
  },
  has(target, prop) {
    if (_countryNames === null) {
      _countryNames = getCountryNames('fr')
    }
    return Reflect.has(_countryNames, prop)
  },
  ownKeys() {
    if (_countryNames === null) {
      _countryNames = getCountryNames('fr')
    }
    return Reflect.ownKeys(_countryNames)
  },
  getOwnPropertyDescriptor(target, prop) {
    if (_countryNames === null) {
      _countryNames = getCountryNames('fr')
    }
    return Reflect.getOwnPropertyDescriptor(_countryNames, prop)
  },
})

/**
 * Options de pays pour les composants USelect avec icônes de drapeaux
 * Compatible avec l'ancien export statique
 */
export const countrySelectOptions = new Proxy([] as ReturnType<typeof getCountrySelectOptions>, {
  get(target, prop) {
    // Initialisation paresseuse
    if (_countrySelectOptions === null) {
      _countrySelectOptions = getCountrySelectOptions('fr')
    }
    return Reflect.get(_countrySelectOptions, prop)
  },
  has(target, prop) {
    if (_countrySelectOptions === null) {
      _countrySelectOptions = getCountrySelectOptions('fr')
    }
    return Reflect.has(_countrySelectOptions, prop)
  },
  ownKeys() {
    if (_countrySelectOptions === null) {
      _countrySelectOptions = getCountrySelectOptions('fr')
    }
    return Reflect.ownKeys(_countrySelectOptions)
  },
  getOwnPropertyDescriptor(target, prop) {
    if (_countrySelectOptions === null) {
      _countrySelectOptions = getCountrySelectOptions('fr')
    }
    return Reflect.getOwnPropertyDescriptor(_countrySelectOptions, prop)
  },
})

/**
 * Mapping nom de pays → code ISO alpha-2
 * Inclut les noms français, anglais et les alias pour compatibilité
 * Compatible avec l'ancien export statique
 */
export const countryToCode: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(target, prop: string) {
    // Initialisation paresseuse
    if (_countryToCode === null) {
      _countryToCode = {}
      // Ajouter les noms français
      const frNames = countries.getNames('fr')
      if (frNames) {
        for (const [code, name] of Object.entries(frNames)) {
          _countryToCode[name] = code.toLowerCase()
        }
      }
      // Ajouter les noms anglais
      const enNames = countries.getNames('en')
      if (enNames) {
        for (const [code, name] of Object.entries(enNames)) {
          _countryToCode[name] = code.toLowerCase()
        }
      }
      // Ajouter les alias (noms courants non-officiels)
      for (const [alias, code] of Object.entries(COUNTRY_ALIASES)) {
        _countryToCode[alias] = code.toLowerCase()
      }
    }
    return Reflect.get(_countryToCode, prop)
  },
  has(target, prop) {
    if (_countryToCode === null) {
      // Déclencher l'initialisation via get
      Reflect.get(countryToCode, '__init__')
    }
    return Reflect.has(_countryToCode!, prop)
  },
  ownKeys() {
    if (_countryToCode === null) {
      Reflect.get(countryToCode, '__init__')
    }
    return Reflect.ownKeys(_countryToCode!)
  },
  getOwnPropertyDescriptor(target, prop) {
    if (_countryToCode === null) {
      Reflect.get(countryToCode, '__init__')
    }
    return Reflect.getOwnPropertyDescriptor(_countryToCode!, prop)
  },
})
