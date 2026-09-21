import fs from 'node:fs'
import path from 'node:path'

// Cache des traductions chargées
const translationsCache = new Map<string, any>()

/**
 * Fusionne un fichier de traductions dans l'ensemble déjà chargé, en PROFONDEUR.
 *
 * Le code faisait un `Object.assign` — un commentaire annonçait pourtant « deep merge simple ».
 * La nuance n'est pas théorique : **quatre** fichiers partagent la racine `gestion`
 * (`gestion.json`, `gestion-map`, `gestion-shows-call`, `gestion-tasks`), et une copie à plat fait
 * que le dernier lu remplace entièrement les trois autres. `shows_call` est dans le même cas,
 * réparti entre `common.json` et `shows-call.json`.
 *
 * Personne ne s'en plaignait : aucune clé de notification ne vit aujourd'hui sous ces racines, et
 * c'est le seul appelant. Le jour où l'une y passe, `translateServerSide` rend la clé brute — pas
 * d'erreur, pas de trace, juste `gestion.map.title` dans un courriel.
 *
 * Seuls les objets simples se fusionnent : un tableau ou une chaîne REMPLACE ce qu'il trouve,
 * comme le ferait `Object.assign`. Fusionner deux tableaux de traductions n'aurait pas de sens —
 * on obtiendrait une liste qui n'est écrite nulle part.
 */
export function fusionnerTraductions(cible: any, ajout: any): any {
  for (const [cle, valeur] of Object.entries(ajout ?? {})) {
    const existant = cible[cle]
    const deuxObjets =
      estUnObjetSimple(existant) && estUnObjetSimple(valeur as Record<string, unknown>)
    cible[cle] = deuxObjets ? fusionnerTraductions(existant, valeur) : valeur
  }
  return cible
}

/** Un objet de traductions, par opposition à un tableau, une chaîne ou `null`. */
function estUnObjetSimple(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur)
}

/**
 * Charge les traductions pour une langue donnée
 * Fusionne tous les fichiers JSON du dossier de la langue
 *
 * ⚠️ Ne lit que `apps/app1/i18n/locales` : les traductions portées par un LAYER
 * (`layers/volunteers/i18n/locales/…`) restent hors de portée, et l'image de production ne les
 * contient même pas — le Dockerfile ne copie que `apps/app1/i18n`. Une clé `volunteers.*` rendra
 * donc la clé elle-même. Ce n'est pas un oubli à réparer à la légère : cela change le contenu de
 * l'image livrée.
 */
function loadTranslations(lang: string): any {
  if (translationsCache.has(lang)) {
    return translationsCache.get(lang)
  }

  const localesDir = path.resolve(process.cwd(), 'i18n/locales', lang)
  const merged: any = {}

  try {
    // Lire tous les fichiers JSON du dossier de langue
    const files = fs.readdirSync(localesDir).filter((f) => f.endsWith('.json'))

    for (const file of files) {
      const filePath = path.join(localesDir, file)
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      fusionnerTraductions(merged, content)
    }

    translationsCache.set(lang, merged)
    console.log(`[Server i18n] Traductions chargées pour ${lang}: ${files.length} fichiers`)
    return merged
  } catch (error) {
    console.error(`[Server i18n] Erreur chargement langue ${lang}:`, error)
    return {}
  }
}

/**
 * Navigue dans un objet avec une clé en notation pointée
 * Ex: "notifications.carpool.title" -> obj.notifications.carpool.title
 */
function getNestedValue(obj: any, key: string): any {
  const keys = key.split('.')
  let value: any = obj

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k]
    } else {
      return undefined
    }
  }

  return value
}

/**
 * Traduit une clé avec des paramètres
 *
 * @param key - Clé de traduction en notation pointée (ex: "notifications.carpool.booking_received.title")
 * @param params - Paramètres à injecter dans la traduction (ex: { userName: "Jean", seats: 2 })
 * @param lang - Code de langue (ex: "fr", "en", "es")
 * @returns La chaîne traduite avec les paramètres injectés
 *
 * @example
 * translateServerSide(
 *   'notifications.carpool.booking_received.message',
 *   { requesterName: 'Jean', seats: 2 },
 *   'fr'
 * )
 * // Retourne: "Jean souhaite réserver 2 place(s) dans votre covoiturage"
 */
export function translateServerSide(
  key: string,
  params: Record<string, any> = {},
  lang: string = 'fr'
): string {
  const translations = loadTranslations(lang)

  // Naviguer dans l'objet avec la notation pointée
  const value = getNestedValue(translations, key)

  if (typeof value !== 'string') {
    console.warn(`[Server i18n] Clé manquante: ${key} (lang: ${lang})`)
    return key // Retourner la clé si la traduction n'existe pas
  }

  // Remplacer les paramètres {param} dans la chaîne
  let result = value
  for (const [paramKey, paramValue] of Object.entries(params)) {
    // Utiliser une regex globale pour remplacer toutes les occurrences
    const regex = new RegExp(`\\{${paramKey}\\}`, 'g')
    result = result.replace(regex, String(paramValue))
  }

  return result
}

/**
 * Invalider le cache des traductions
 * Utile en développement ou après un changement de fichiers de traduction
 */
export function clearTranslationsCache() {
  const size = translationsCache.size
  translationsCache.clear()
  console.log(`[Server i18n] Cache des traductions vidé (${size} langues)`)
}

/**
 * Vérifier si une clé de traduction existe
 */
export function hasTranslation(key: string, lang: string = 'fr'): boolean {
  const translations = loadTranslations(lang)
  const value = getNestedValue(translations, key)
  return typeof value === 'string'
}

/**
 * Obtenir les langues disponibles
 */
export function getAvailableLanguages(): string[] {
  try {
    const localesDir = path.resolve(process.cwd(), 'i18n/locales')
    return fs
      .readdirSync(localesDir)
      .filter((item) => {
        const itemPath = path.join(localesDir, item)
        return fs.statSync(itemPath).isDirectory()
      })
      .sort()
  } catch (error) {
    console.error('[Server i18n] Erreur lors de la récupération des langues:', error)
    return ['fr'] // Fallback vers français
  }
}
