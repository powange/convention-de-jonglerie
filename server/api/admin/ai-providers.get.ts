import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { getEffectiveAIConfig } from '@@/server/utils/ai-config'
import { wrapApiHandler } from '@@/server/utils/api-helpers'

/**
 * Provider IA disponible
 */
export interface AIProvider {
  id: string
  name: string
  description: string
  icon: string
  isDefault: boolean
}

/**
 * GET /api/admin/ai-providers
 * Retourne la liste des providers IA configurés et disponibles
 */
export default wrapApiHandler(
  async (event) => {
    // Vérifier que l'utilisateur est un admin
    await requireGlobalAdminWithDbCheck(event)

    const config = getEffectiveAIConfig()
    const providers: AIProvider[] = []

    // Déterminer le provider par défaut
    const defaultProvider = config.aiProvider || 'lmstudio'

    // LM Studio - disponible si l'URL est configurée
    if (config.lmstudioBaseUrl) {
      providers.push({
        id: 'lmstudio',
        name: 'LM Studio',
        description: 'Modèle local via LM Studio',
        icon: 'i-heroicons-computer-desktop',
        isDefault: defaultProvider === 'lmstudio',
      })
    }

    // Anthropic (Claude) - disponible si la clé API est configurée
    if (config.anthropicApiKey) {
      providers.push({
        id: 'anthropic',
        name: 'Claude (Anthropic)',
        description: 'Claude 3.5 Sonnet via API Anthropic',
        icon: 'i-heroicons-sparkles',
        isDefault: defaultProvider === 'anthropic',
      })
    }

    // Ollama - disponible si l'URL est configurée
    if (config.ollamaBaseUrl) {
      providers.push({
        id: 'ollama',
        name: 'Ollama',
        description: `Modèle local via Ollama (${config.ollamaModel || 'llama3'})`,
        icon: 'i-heroicons-cube',
        isDefault: defaultProvider === 'ollama',
      })
    }

    return {
      providers,
      defaultProvider: providers.find((p) => p.isDefault)?.id || providers[0]?.id || null,
    }
  },
  { operationName: 'GetAIProviders' }
)
