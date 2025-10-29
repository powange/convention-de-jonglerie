import { createAIProvider, type ExtractedWorkshop } from '@@/server/utils/ai-providers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id')!)

  if (isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      message: "ID d'édition invalide",
    })
  }

  try {
    // Vérifier que l'édition existe et que les workshops sont activés
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: {
        id: true,
        name: true,
        workshopsEnabled: true,
        startDate: true,
        endDate: true,
        convention: {
          select: {
            collaborators: {
              select: {
                userId: true,
              },
            },
          },
        },
        creatorId: true,
      },
    })

    if (!edition) {
      throw createError({
        statusCode: 404,
        message: 'Édition non trouvée',
      })
    }

    if (!edition.workshopsEnabled) {
      throw createError({
        statusCode: 403,
        message: 'Les workshops ne sont pas activés pour cette édition',
      })
    }

    // Vérifier que l'utilisateur est organisateur, collaborateur ou super admin
    const isCreator = edition.creatorId === user.id
    const isCollaborator = edition.convention?.collaborators?.some(
      (collab) => collab.userId === user.id
    )
    const isSuperAdmin = user.isGlobalAdmin || false

    if (!isCreator && !isCollaborator && !isSuperAdmin) {
      throw createError({
        statusCode: 403,
        message:
          'Seuls les organisateurs et super admins peuvent importer des workshops depuis une image',
      })
    }

    // Lire le body
    const body = await readBody(event)
    const { image } = body

    if (!image || typeof image !== 'string') {
      throw createError({
        statusCode: 400,
        message: 'Image manquante ou invalide',
      })
    }

    // Vérifier que c'est bien une image base64
    const base64Match = image.match(/^data:image\/(png|jpg|jpeg|gif|webp);base64,(.+)$/)
    if (!base64Match) {
      throw createError({
        statusCode: 400,
        message: "Format d'image invalide. Utilisez une image encodée en base64",
      })
    }

    const imageType = base64Match[1] as 'png' | 'jpeg' | 'gif' | 'webp'
    const base64Data = base64Match[2]

    // Récupérer la configuration
    const config = useRuntimeConfig()

    // Lire directement depuis process.env au runtime (plus fiable en production)
    const aiProvider = createAIProvider({
      provider: (process.env.AI_PROVIDER as 'anthropic' | 'ollama' | 'lmstudio') || config.aiProvider as 'anthropic' | 'ollama' | 'lmstudio' || 'anthropic',
      anthropicApiKey: process.env.ANTHROPIC_API_KEY || config.anthropicApiKey,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL || config.ollamaBaseUrl,
      ollamaModel: process.env.OLLAMA_MODEL || config.ollamaModel,
      lmstudioBaseUrl: process.env.LMSTUDIO_BASE_URL || config.lmstudioBaseUrl,
      lmstudioModel: process.env.LMSTUDIO_MODEL || config.lmstudioModel,
    })

    // Créer le prompt pour l'IA
    const prompt = `Tu es un assistant spécialisé dans l'extraction d'informations sur des workshops à partir d'images (affiches, programmes, calendriers, etc.).

Analyse cette image et extrais TOUS les workshops que tu peux identifier. Pour chaque workshop détecté, fournis les informations suivantes :
- title : Le titre du workshop (obligatoire)
- description : Une brève description si disponible (optionnel)
- startDateTime : La date et heure de début au format ISO 8601 (ex: "2024-10-23T14:00:00"). Si seule l'heure est visible, utilise les dates de l'édition (${edition.startDate.toISOString()} à ${edition.endDate.toISOString()})
- endDateTime : La date et heure de fin au format ISO 8601. Si non spécifiée, estime une durée raisonnable (généralement 1-2h)
- maxParticipants : Le nombre maximum de participants si mentionné (optionnel, nombre entier)
- location : Le lieu du workshop si mentionné (optionnel, texte)

IMPORTANT :
- Retourne UNIQUEMENT un objet JSON valide au format suivant : { "workshops": [...] }
- Ne retourne AUCUN texte avant ou après le JSON
- Si aucun workshop n'est détecté, retourne : { "workshops": [] }
- Pour les dates/heures partielles, utilise les dates de l'édition comme référence
- Si plusieurs workshops ont le même titre mais à des horaires différents, crée des entrées séparées

L'édition se déroule du ${edition.startDate.toLocaleDateString('fr-FR')} au ${edition.endDate.toLocaleDateString('fr-FR')}.

Exemple de réponse attendue :
{
  "workshops": [
    {
      "title": "Initiation au jonglage",
      "description": "Découverte des bases du jonglage pour débutants",
      "startDateTime": "2024-10-23T14:00:00",
      "endDateTime": "2024-10-23T16:00:00",
      "maxParticipants": 15,
      "location": "Salle A"
    }
  ]
}`

    // Appeler le provider IA
    const parsedResponse = await aiProvider.extractWorkshopsFromImage(base64Data, imageType, prompt)

    // Valider la structure de la réponse
    if (!parsedResponse.workshops || !Array.isArray(parsedResponse.workshops)) {
      throw createError({
        statusCode: 500,
        message: "Format de réponse invalide de l'IA",
      })
    }

    // Valider chaque workshop extrait
    const validatedWorkshops: ExtractedWorkshop[] = []

    for (const workshop of parsedResponse.workshops) {
      // Vérifier les champs obligatoires
      if (!workshop.title || !workshop.startDateTime || !workshop.endDateTime) {
        console.warn('Workshop invalide ignoré:', workshop)
        continue
      }

      // Vérifier que les dates sont valides
      const startDate = new Date(workshop.startDateTime)
      const endDate = new Date(workshop.endDateTime)

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.warn('Dates invalides pour le workshop:', workshop.title)
        continue
      }

      // Vérifier que la date de fin est après la date de début
      if (endDate <= startDate) {
        console.warn('Date de fin invalide pour le workshop:', workshop.title)
        continue
      }

      validatedWorkshops.push({
        title: workshop.title.trim(),
        description: workshop.description?.trim() || undefined,
        startDateTime: workshop.startDateTime,
        endDateTime: workshop.endDateTime,
        maxParticipants: workshop.maxParticipants
          ? Math.max(1, parseInt(String(workshop.maxParticipants), 10))
          : undefined,
        location: workshop.location?.trim() || undefined,
      })
    }

    return {
      workshops: validatedWorkshops,
    }
  } catch (error: unknown) {
    if ((error as any).statusCode) {
      throw error
    }

    console.error("Erreur lors de l'extraction des workshops:", error)
    throw createError({
      statusCode: 500,
      message: "Erreur lors de l'extraction des workshops depuis l'image",
    })
  }
})
