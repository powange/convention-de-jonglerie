# Intégration de l'API Claude (Anthropic)

Ce document décrit comment utiliser l'API Claude d'Anthropic dans le backend de l'application.

## Configuration

### 1. Installation

Le SDK Anthropic est déjà installé dans le projet :

```bash
npm install @anthropic-ai/sdk
```

### 2. Clé API

Ajoutez votre clé API Anthropic dans le fichier `.env` :

```env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxx
```

Pour obtenir une clé API :
1. Créez un compte sur [console.anthropic.com](https://console.anthropic.com)
2. Générez une clé API dans les paramètres
3. Copiez la clé dans votre fichier `.env`

## Utilisation

L'utilitaire `server/utils/anthropic.ts` fournit plusieurs fonctions pour interagir avec Claude.

### Requête texte simple

```typescript
import { askClaude, CLAUDE_MODELS } from '~/server/utils/anthropic'

// Exemple dans un endpoint API
export default defineEventHandler(async (event) => {
  const { text } = await readBody(event)

  const response = await askClaude(
    `Résume ce texte en 3 points clés : ${text}`,
    {
      model: CLAUDE_MODELS.SONNET_3_5,
      maxTokens: 500,
      temperature: 0.7,
    }
  )

  return { summary: response }
})
```

### Conversation multi-tours

```typescript
import { conversationWithClaude, CLAUDE_MODELS } from '~/server/utils/anthropic'

export default defineEventHandler(async (event) => {
  const { messages } = await readBody(event)

  const response = await conversationWithClaude(
    [
      { role: 'user', content: 'Bonjour Claude' },
      { role: 'assistant', content: 'Bonjour ! Comment puis-je vous aider ?' },
      { role: 'user', content: 'Peux-tu m\'aider avec du TypeScript ?' },
    ],
    {
      systemPrompt: 'Tu es un expert en développement TypeScript et Nuxt.js',
    }
  )

  return { response }
})
```

### Analyse d'image (Vision)

```typescript
import { analyzeImage } from '~/server/utils/anthropic'

export default defineEventHandler(async (event) => {
  const { imageBase64, mediaType } = await readBody(event)

  const analysis = await analyzeImage(
    imageBase64,
    'Décris cette image en détail et identifie tous les éléments importants',
    mediaType,
    {
      maxTokens: 2048,
    }
  )

  return { analysis }
})
```

### Extraction de texte (OCR)

```typescript
import { extractTextFromImage } from '~/server/utils/anthropic'

export default defineEventHandler(async (event) => {
  const { imageBase64 } = await readBody(event)

  const extractedText = await extractTextFromImage(imageBase64, 'image/jpeg')

  return { text: extractedText }
})
```

### Analyse de plusieurs images

```typescript
import { analyzeMultipleImages } from '~/server/utils/anthropic'

export default defineEventHandler(async (event) => {
  const { images } = await readBody(event)

  const analysis = await analyzeMultipleImages(
    images, // [{ data: 'base64...', mediaType: 'image/jpeg' }, ...]
    'Compare ces images et identifie les différences principales',
    {
      maxTokens: 4096,
    }
  )

  return { comparison: analysis }
})
```

## Modèles disponibles

Le module exporte les modèles Claude disponibles via `CLAUDE_MODELS` :

```typescript
import { CLAUDE_MODELS } from '~/server/utils/anthropic'

// Modèles disponibles :
CLAUDE_MODELS.SONNET_4        // 'claude-sonnet-4-20250514' (le plus récent)
CLAUDE_MODELS.SONNET_3_5      // 'claude-3-5-sonnet-20241022' (recommandé, excellent rapport qualité/prix)
CLAUDE_MODELS.OPUS_3          // 'claude-3-opus-20240229' (le plus puissant)
CLAUDE_MODELS.SONNET_3        // 'claude-3-sonnet-20240229'
CLAUDE_MODELS.HAIKU_3         // 'claude-3-haiku-20240307' (le plus rapide et économique)
```

## Cas d'usage pour les conventions de jonglerie

### 1. Analyse de budget

Analyser un fichier Excel ou PDF de budget uploadé :

```typescript
// server/api/editions/[id]/analyze-budget.post.ts
import { analyzeImage } from '~/server/utils/anthropic'

export default defineEventHandler(async (event) => {
  const { imageBase64 } = await readBody(event)

  const analysis = await analyzeImage(
    imageBase64,
    'Analyse ce budget de convention de jonglerie. Extrais les catégories de dépenses, les montants, et identifie les postes les plus importants.',
    'image/jpeg',
    {
      systemPrompt:
        'Tu es un expert comptable spécialisé dans les événements culturels et artistiques.',
      maxTokens: 3000,
    }
  )

  return { analysis }
})
```

### 2. Génération de descriptions

Aider à la rédaction de descriptions d'éditions :

```typescript
// server/api/editions/generate-description.post.ts
import { askClaude, CLAUDE_MODELS } from '~/server/utils/anthropic'

export default defineEventHandler(async (event) => {
  const { editionData } = await readBody(event)

  const description = await askClaude(
    `Génère une description attrayante pour une convention de jonglerie avec ces informations :
    - Lieu : ${editionData.city}, ${editionData.country}
    - Dates : du ${editionData.startDate} au ${editionData.endDate}
    - Services : ${editionData.services.join(', ')}

    La description doit être engageante, informative et donner envie de participer.`,
    {
      model: CLAUDE_MODELS.SONNET_3_5,
      temperature: 0.8,
      maxTokens: 500,
    }
  )

  return { description }
})
```

### 3. Modération de commentaires

Détecter automatiquement le contenu inapproprié :

```typescript
// server/api/moderate-comment.post.ts
import { askClaude } from '~/server/utils/anthropic'

export default defineEventHandler(async (event) => {
  const { comment } = await readBody(event)

  const moderation = await askClaude(
    `Analyse ce commentaire et détermine s'il contient du contenu inapproprié (harcèlement, spam, langage offensant, etc.) :

    "${comment}"

    Réponds uniquement par JSON avec cette structure :
    {
      "isAppropriate": true/false,
      "reason": "explication si inapproprié",
      "severity": "low/medium/high"
    }`,
    {
      systemPrompt:
        'Tu es un modérateur de contenu expert. Analyse le texte de manière objective et bienveillante.',
      maxTokens: 200,
    }
  )

  return JSON.parse(moderation)
})
```

### 4. Traduction contextuelle

Traduire du contenu en tenant compte du contexte :

```typescript
// server/api/translate.post.ts
import { askClaude } from '~/server/utils/anthropic'

export default defineEventHandler(async (event) => {
  const { text, targetLanguage, context } = await readBody(event)

  const translation = await askClaude(
    `Traduis ce texte en ${targetLanguage} en tenant compte du contexte d'une convention de jonglerie :

    Texte : "${text}"
    Contexte : ${context}

    Fournis uniquement la traduction, sans commentaires.`,
    {
      temperature: 0.3, // Basse température pour plus de cohérence
      maxTokens: 1000,
    }
  )

  return { translation }
})
```

## Gestion des erreurs

```typescript
import { askClaude } from '~/server/utils/anthropic'

export default defineEventHandler(async (event) => {
  try {
    const response = await askClaude('Ma question')
    return { success: true, response }
  } catch (error) {
    console.error('Erreur API Claude:', error)

    if (error.status === 401) {
      throw createError({
        statusCode: 500,
        message: 'Clé API Anthropic invalide',
      })
    }

    if (error.status === 429) {
      throw createError({
        statusCode: 429,
        message: 'Limite de requêtes API dépassée',
      })
    }

    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la communication avec Claude',
    })
  }
})
```

## Limitations et bonnes pratiques

### Limites

- **Taille des images** : Maximum ~100MB, idéalement <5MB pour de bonnes performances
- **Formats d'image** : JPEG, PNG, GIF, WebP
- **Tokens** : Une image compte pour environ 1-2k tokens selon sa résolution
- **Rate limits** : Selon votre plan Anthropic (vérifier dans la console)

### Bonnes pratiques

1. **Utiliser le bon modèle** :
   - Sonnet 3.5 : Meilleur rapport qualité/prix pour la plupart des cas
   - Haiku : Pour les tâches simples et rapides
   - Opus : Pour les tâches les plus complexes nécessitant le maximum de capacités

2. **Optimiser les tokens** :
   - Réduire la taille des images avant de les envoyer
   - Utiliser `maxTokens` approprié pour limiter les coûts
   - Être précis dans les prompts pour éviter les réponses trop longues

3. **Température** :
   - 0.0-0.3 : Pour des réponses déterministes (extraction de données, traduction)
   - 0.7-1.0 : Pour des réponses créatives (génération de contenu)

4. **Caching** :
   - Mettre en cache les réponses fréquentes
   - Éviter d'appeler l'API pour les mêmes requêtes

5. **Sécurité** :
   - Ne jamais exposer la clé API côté client
   - Toujours valider les entrées utilisateur avant de les envoyer à Claude
   - Implémenter des rate limits côté serveur

## Coûts estimés

Les prix varient selon le modèle (consulter [anthropic.com/pricing](https://www.anthropic.com/pricing)) :

- **Claude 3.5 Sonnet** : ~$3 / million tokens input, ~$15 / million tokens output
- **Claude 3 Haiku** : ~$0.25 / million tokens input, ~$1.25 / million tokens output
- **Claude 3 Opus** : ~$15 / million tokens input, ~$75 / million tokens output

Pour référence : ~750 mots = 1000 tokens

## Ressources

- [Documentation officielle Anthropic](https://docs.anthropic.com)
- [Guide des modèles Claude](https://docs.anthropic.com/claude/docs/models-overview)
- [Exemples de prompts](https://docs.anthropic.com/claude/docs/prompt-library)
- [Console Anthropic](https://console.anthropic.com)
