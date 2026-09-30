import countries from 'i18n-iso-countries'

/**
 * Enregistre les langues de `i18n-iso-countries`, hors du paquet d'entrée.
 *
 * ⚠️ POURQUOI PAS « SEULEMENT LA LANGUE COURANTE », qui serait le réflexe. Parce que la base stocke
 * les pays en TEXTE LIBRE ET EN LANGUES MÊLÉES : on y trouve « Suisse » et « Switzerland »,
 * « Italie » et « Italia », relevé sur les données de développement. `getCountryCode` et
 * `translateCountry` (app/utils/countries.ts) résolvent donc un nom en parcourant les TREIZE
 * langues jusqu'à trouver le code ISO — c'est cette recherche croisée qui permet d'afficher
 * « Italie » et le bon drapeau pour une édition saisie en italien.
 *
 * N'enregistrer que la langue du lecteur casserait cela : une convention créée en allemand
 * perdrait son drapeau et resterait affichée en allemand pour un lecteur français, sans qu'aucune
 * erreur ne le signale. La charge des treize langues est le prix de données hétérogènes.
 *
 * ⚠️ CE QUI CHANGE ICI : les imports étaient STATIQUES, donc les 116 Ko entraient dans le paquet
 * d'entrée de TOUTES les pages, y compris celles qui n'affichent aucun pays. En `import()` à chemin
 * littéral, Vite les sort en fragments séparés — le commentaire d'origine (« pour éviter les
 * problèmes d'import dynamique avec Vite ») désignait un contournement : `translation-loaders.ts`
 * fait exactement cela dans ce même dépôt.
 *
 * Le greffon reste ATTENDU (pas de `parallel: true`) : les enregistrer en arrière-plan ferait
 * afficher un instant les noms bruts, puis leur traduction. Un scintillement sur la page d'accueil
 * coûterait plus cher que les quelques dizaines de millisecondes gagnées.
 */
const LANGUES = {
  cs: () => import('i18n-iso-countries/langs/cs.json'),
  da: () => import('i18n-iso-countries/langs/da.json'),
  de: () => import('i18n-iso-countries/langs/de.json'),
  en: () => import('i18n-iso-countries/langs/en.json'),
  es: () => import('i18n-iso-countries/langs/es.json'),
  fr: () => import('i18n-iso-countries/langs/fr.json'),
  it: () => import('i18n-iso-countries/langs/it.json'),
  nl: () => import('i18n-iso-countries/langs/nl.json'),
  pl: () => import('i18n-iso-countries/langs/pl.json'),
  pt: () => import('i18n-iso-countries/langs/pt.json'),
  ru: () => import('i18n-iso-countries/langs/ru.json'),
  sv: () => import('i18n-iso-countries/langs/sv.json'),
  uk: () => import('i18n-iso-countries/langs/uk.json'),
} as const

export default defineNuxtPlugin(async () => {
  /*
   * En parallèle : treize fragments qui ne dépendent pas les uns des autres. À la file, on
   * additionnerait treize allers-retours.
   *
   * `allSettled` et non `all` : une langue qui ne se charge pas — réseau coupé en cours de route —
   * ne doit pas priver le site des douze autres. Les noms de cette langue-là resteront simplement
   * non résolus, ce qui est déjà ce qui se passe pour une langue non gérée.
   */
  const resultats = await Promise.allSettled(
    Object.values(LANGUES).map((charger) => charger().then((module) => module.default ?? module))
  )

  for (const resultat of resultats) {
    if (resultat.status === 'fulfilled') {
      countries.registerLocale(resultat.value as never)
    } else {
      console.error('[pays] langue non chargée :', resultat.reason)
    }
  }
})
