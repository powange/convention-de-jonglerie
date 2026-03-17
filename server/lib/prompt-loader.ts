/**
 * Cache en mémoire pour les fichiers de prompts chargés.
 * Évite de relire le stockage à chaque appel.
 */
const promptCache = new Map<string, string>()

/**
 * Charge un fichier de prompt depuis server/prompts/ et remplace les placeholders.
 * Utilise le storage Nitro (serverAssets) pour fonctionner en dev et en production.
 *
 * @param name - Nom du fichier sans extension (ex: 'direct-full')
 * @param vars - Variables à interpoler (ex: { RULES_FULL: '...' })
 * @returns Le contenu du prompt avec les variables remplacées
 *
 * @example
 * ```ts
 * const prompt = await loadPrompt('direct-full', {
 *   RULES_FULL: rulesContent,
 *   FEATURES_DESCRIPTION: featuresContent,
 *   JSON_EXAMPLE: jsonExample,
 * })
 * ```
 */
export async function loadPrompt(name: string, vars: Record<string, string> = {}): Promise<string> {
  let template = promptCache.get(name)

  if (!template) {
    const storage = useStorage('assets:prompts')
    template = (await storage.getItem<string>(`${name}.txt`)) || ''

    if (!template) {
      throw new Error(`Prompt "${name}.txt" introuvable dans server/prompts/`)
    }

    promptCache.set(name, template)
  }

  // Remplacer les {{VARIABLE}} par les valeurs fournies
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value)
  }

  return result
}

/**
 * Vide le cache des prompts (utile pour les tests ou le rechargement à chaud).
 */
export function clearPromptCache(): void {
  promptCache.clear()
}
