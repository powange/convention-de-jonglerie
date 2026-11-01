import { CLAUDE_MODELS } from './anthropic'

/**
 * Un appel de TEXTE au modèle configuré, quel que soit le fournisseur.
 *
 * ## Pourquoi ce fichier existe
 *
 * Le même aiguillage — LM Studio / Anthropic / Ollama — vivait déjà dans
 * `edition-features-extractor.ts`, enfermé dans ses fonctions privées. La veille des conventions
 * en a besoin aussi. Le copier aurait créé deux chemins d'appel à tenir en parallèle, qui
 * divergeraient au premier correctif porté sur un seul des deux — et rien ne le signalerait.
 *
 * ⚠️ DETTE ASSUMÉE : `edition-features-extractor.ts` n'est PAS rebranché sur cet util dans ce lot.
 * Il est sur le chemin critique de l'import d'édition, et le réécrire mérite son propre lot avec
 * ses propres tests, plutôt que d'être emporté par une fonctionnalité voisine. La duplication est
 * donc réelle et connue, pas oubliée.
 */

/**
 * La configuration telle que `getEffectiveAIConfigAsync()` la rend, réduite à ce qu'un appel texte
 * lit.
 *
 * ⚠️ `| null` sur chaque champ, et ce n'est pas de la permissivité : la configuration vient de la
 * base, où une valeur non renseignée est `null` et non `undefined`. Déclarer `string | undefined`
 * rendait cette interface INCOMPATIBLE avec sa propre source — un TS2345 que le typage de la CI a
 * attrapé, et que ni le lint ni les tests ne voyaient puisque `null` se comporte comme `undefined`
 * devant les `||` ci-dessous.
 */
export interface ConfigAppelTexte {
  aiProvider?: string | null
  lmstudioBaseUrl?: string | null
  lmstudioTextModel?: string | null
  lmstudioModel?: string | null
  anthropicApiKey?: string | null
  /** Pour fixer le modèle au point d'appel ; voir le défaut ci-dessous. */
  anthropicModel?: string | null
  ollamaBaseUrl?: string | null
  ollamaModel?: string | null
  llmMaxTokens?: number | null
}

/**
 * Le modèle Anthropic par défaut.
 *
 * 📍 `SONNET_4` et non `SONNET_3_5`, que l'extracteur de caractéristiques code en dur : la table
 * `CLAUDE_MODELS` du dépôt le déclare, il est donc présumé accessible avec la clé du projet. Un
 * modèle plus récent encore serait un arbitrage à part — coût et qualité —, et l'essayer à
 * l'aveugle ferait échouer *tous* les appels si la clé n'y avait pas droit.
 */
const MODELE_ANTHROPIC_DEFAUT = CLAUDE_MODELS.SONNET_4

/** Plancher de jetons. Un modèle qui raisonne avant de répondre épuise un budget trop court en
 * réflexion et se fait couper AVANT d'écrire : la réponse est alors vide, sans erreur. */
const JETONS_PLANCHER = 512

/**
 * Pose une question au modèle configuré et rend sa réponse BRUTE.
 *
 * Ne fait aucun parsing : c'est à l'appelant de décider ce qu'il attend. Lève si le fournisseur
 * n'est pas joignable ou n'est pas supporté — un appelant qui traite plusieurs éléments doit donc
 * attraper par élément, sous peine de perdre tout un lot sur un seul échec.
 */
export async function demanderAuModele(
  systemPrompt: string,
  userPrompt: string,
  config: ConfigAppelTexte
): Promise<string> {
  const fournisseur = config.aiProvider || 'anthropic'
  const jetons = Math.max(config.llmMaxTokens ?? JETONS_PLANCHER, JETONS_PLANCHER)

  if (fournisseur === 'lmstudio') {
    return appelerLmStudio(
      config.lmstudioBaseUrl || 'http://localhost:1234',
      config.lmstudioTextModel || config.lmstudioModel || 'auto',
      systemPrompt,
      userPrompt,
      jetons
    )
  }

  if (fournisseur === 'anthropic') {
    if (!config.anthropicApiKey) {
      throw new Error('Clé API Anthropic absente de la configuration')
    }
    return appelerAnthropic(
      config.anthropicApiKey,
      config.anthropicModel || MODELE_ANTHROPIC_DEFAUT,
      systemPrompt,
      userPrompt,
      jetons
    )
  }

  if (fournisseur === 'ollama') {
    return appelerOllama(
      config.ollamaBaseUrl || 'http://localhost:11434',
      config.ollamaModel || 'llama3',
      systemPrompt,
      userPrompt
    )
  }

  // Lever, et non rendre une chaîne vide : une chaîne vide se lirait comme « le modèle n'a rien
  // trouvé », alors que le modèle n'a jamais été appelé.
  throw new Error(`Fournisseur IA non supporté : ${fournisseur}`)
}

/**
 * Extrait le premier objet JSON d'une réponse de modèle.
 *
 * ⚠️ Les modèles encadrent volontiers leur JSON de prose — « Voici le résultat : … » — ou de
 * balises de bloc de code. Un `JSON.parse` direct échoue alors sur une réponse pourtant correcte.
 *
 * Rend `null` plutôt que de lever : une réponse illisible est un cas ordinaire, pas une anomalie
 * du programme, et l'appelant doit pouvoir la compter sans se faire interrompre.
 */
export function extraireJson<T = unknown>(reponse: string): T | null {
  const bloc = reponse.match(/\{[\s\S]*\}/)
  if (!bloc) return null
  try {
    return JSON.parse(bloc[0]) as T
  } catch {
    return null
  }
}

async function appelerLmStudio(
  baseUrl: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  const reponse = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      // Très bas : on veut une classification reproductible, pas de la créativité.
      temperature: 0.1,
      max_tokens: maxTokens,
    }),
  })

  if (!reponse.ok) throw new Error(`LM Studio a répondu ${reponse.status}`)

  const données = await reponse.json()
  return données.choices?.[0]?.message?.content || ''
}

async function appelerAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey, timeout: 30000 })

  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  return message.content
    .filter((bloc) => bloc.type === 'text')
    .map((bloc) => (bloc as { type: 'text'; text: string }).text)
    .join('')
}

async function appelerOllama(
  baseUrl: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const reponse = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: `${systemPrompt}\n\n${userPrompt}`,
      stream: false,
    }),
  })

  if (!reponse.ok) throw new Error(`Ollama a répondu ${reponse.status}`)

  const données = await reponse.json()
  return données.response || ''
}
