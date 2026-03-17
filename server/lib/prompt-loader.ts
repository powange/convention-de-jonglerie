import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Cache en mémoire pour les fichiers de prompts chargés.
 * Évite de relire le disque à chaque appel.
 */
const promptCache = new Map<string, string>()

/**
 * Charge un fichier de prompt depuis server/prompts/ et remplace les placeholders.
 *
 * Les fichiers .txt sont copiés dans le container Docker via le Dockerfile
 * et lus depuis le disque avec readFileSync (synchrone, mis en cache).
 *
 * @param name - Nom du fichier sans extension (ex: 'direct-full')
 * @param vars - Variables à interpoler (ex: { RULES_FULL: '...' })
 * @returns Le contenu du prompt avec les variables remplacées
 */
export function loadPrompt(name: string, vars: Record<string, string> = {}): string {
  let template = promptCache.get(name)

  if (!template) {
    const filePath = resolve(process.cwd(), 'server', 'prompts', `${name}.txt`)
    template = readFileSync(filePath, 'utf-8')
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
