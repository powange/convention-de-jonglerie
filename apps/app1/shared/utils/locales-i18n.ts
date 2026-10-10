/**
 * Les treize langues de l'application, et les domaines de traduction embarqués au démarrage.
 *
 * ## ⚠️ POURQUOI CETTE LISTE EXISTE
 *
 * `nuxt.config.ts` décrivait les treize langues en treize blocs recopiés à la main, chacun
 * répétant la même liste de six fichiers préfixée du code de langue. Rien ne vérifiait qu'ils
 * disaient la même chose — et ils ne le disaient pas : **le français en listait un septième**,
 * `fr/gestion.json`, soit 1 195 clés et 84 Ko embarqués sur chaque page française, l'accueil
 * public compris, où rien ne s'en sert.
 *
 * Le coût n'était pas le pire. Ce fichier préchargé **masquait les défauts de chargement du
 * domaine `gestion` au seul lecteur capable de les voir** : une clé `gestion.*` employée hors des
 * routes `/gestion` s'affichait correctement en français et sortait brute dans les douze autres
 * langues. Celui qui développe, en français, ne pouvait pas s'en apercevoir.
 *
 * Les deux faits tiennent à la même cause : une règle appliquée treize fois à la main finit par
 * ne plus l'être. Les treize entrées sont donc dérivées d'**une** liste de domaines.
 *
 * ## Ce que « socle » veut dire
 *
 * Ces domaines sont dans le paquet initial, pour toutes les langues et sur toutes les pages. Tout
 * le reste est chargé à la navigation par `getTranslationsToLoad` (voir
 * `app/utils/translation-loaders.ts`), domaine par domaine selon la route.
 *
 * Y ajouter un domaine alourdit **chaque** page de l'application : la bonne réponse à une clé qui
 * sort brute est presque toujours une règle de route, ou un `useLazyI18n` dans le composant qui
 * l'emploie — pas une entrée de plus ici. Les six qui y sont le sont parce qu'ils servent
 * partout : libellés communs et de navigation, notifications, composants, coquille de
 * l'application, pages publiques, formulaire de retour.
 */

/** Les domaines embarqués au démarrage, identiques pour les treize langues. */
export const DOMAINES_DU_SOCLE = [
  'common',
  'notifications',
  'components',
  'app',
  'public',
  'feedback',
] as const

/** Le code de chaque langue et son nom, tel qu'il s'affiche dans le sélecteur. */
export const LANGUES = [
  { code: 'cs', name: 'Čeština' },
  { code: 'da', name: 'Dansk' },
  { code: 'de', name: 'Deutsch' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'it', name: 'Italiano' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'pl', name: 'Polski' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'sv', name: 'Svenska' },
  { code: 'uk', name: 'Українська' },
] as const

/**
 * Les locales telles que `@nuxtjs/i18n` les attend : `language` vaut le code, et `files` liste les
 * fichiers du socle préfixés du dossier de la langue.
 */
export const LOCALES = LANGUES.map(({ code, name }) => ({
  code,
  language: code,
  name,
  files: DOMAINES_DU_SOCLE.map((domaine) => `${code}/${domaine}.json`),
}))
