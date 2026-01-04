// Mapping des noms de pays vers les codes ISO 3166-1 alpha-2 pour les drapeaux
export const countryToCode: Record<string, string> = {
  France: 'fr',
  Belgique: 'be',
  Suisse: 'ch',
  Luxembourg: 'lu',
  Canada: 'ca',
  Allemagne: 'de',
  Italie: 'it',
  Espagne: 'es',
  Portugal: 'pt',
  'Pays-Bas': 'nl',
  'Royaume-Uni': 'gb',
  Irlande: 'ie',
  Autriche: 'at',
  Danemark: 'dk',
  Suède: 'se',
  Norvège: 'no',
  Finlande: 'fi',
  Pologne: 'pl',
  'République tchèque': 'cz',
  Hongrie: 'hu',
  Slovaquie: 'sk',
  Slovénie: 'si',
  Croatie: 'hr',
  Grèce: 'gr',
  Chypre: 'cy',
  Malte: 'mt',
  Estonie: 'ee',
  Lettonie: 'lv',
  Lituanie: 'lt',
  Roumanie: 'ro',
  Bulgarie: 'bg',
  'États-Unis': 'us',
  Mexique: 'mx',
  Brésil: 'br',
  Argentine: 'ar',
  Chili: 'cl',
  Australie: 'au',
  'Nouvelle-Zélande': 'nz',
  Japon: 'jp',
  'Corée du Sud': 'kr',
  Chine: 'cn',
  Inde: 'in',
  Thaïlande: 'th',
  Singapour: 'sg',
  Malaisie: 'my',
  Indonésie: 'id',
  Philippines: 'ph',
  Vietnam: 'vn',
  Maroc: 'ma',
  Tunisie: 'tn',
  Algérie: 'dz',
  Égypte: 'eg',
  'Afrique du Sud': 'za',
  Nigeria: 'ng',
  Kenya: 'ke',
  Éthiopie: 'et',
  Ghana: 'gh',
  Sénégal: 'sn',
  "Côte d'Ivoire": 'ci',
  Cameroun: 'cm',
  Madagascar: 'mg',
  Maurice: 'mu',
  Seychelles: 'sc',
  Russie: 'ru',
  Ukraine: 'ua',
  Biélorussie: 'by',
  Moldavie: 'md',
  Géorgie: 'ge',
  Arménie: 'am',
  Azerbaïdjan: 'az',
  Kazakhstan: 'kz',
  Ouzbékistan: 'uz',
  Kirghizistan: 'kg',
  Tadjikistan: 'tj',
  Turkménistan: 'tm',
  Mongolie: 'mn',
}

/**
 * Obtient le code pays ISO pour un nom de pays
 */
export function getCountryCode(countryName: string): string {
  return countryToCode[countryName] || 'xx' // 'xx' pour un drapeau générique si non trouvé
}

/**
 * Formate une liste de pays pour le multiselect avec drapeaux
 */
export function formatCountriesForSelect(countries: string[]) {
  return countries.map((country) => ({
    label: country,
    value: country,
    flag: getCountryCode(country),
  }))
}

/**
 * Liste des noms de pays disponibles (triée alphabétiquement)
 */
export const countryNames = Object.keys(countryToCode).sort((a, b) => a.localeCompare(b, 'fr'))

/**
 * Options de pays pour les composants USelect avec icônes de drapeaux
 */
export const countrySelectOptions = countryNames.map((country) => ({
  label: country,
  value: country,
  icon: `flag:${countryToCode[country]}-4x3`,
}))
