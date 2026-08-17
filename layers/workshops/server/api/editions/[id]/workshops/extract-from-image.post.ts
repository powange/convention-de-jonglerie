import { ancrerCreneauSurJournee, estJourneeValide } from '../../../../utils/ancrage-journee'

import { getEffectiveAIConfigAsync, serveursLmStudio } from '#server/utils/ai-config'
import { createAIProvider, type ExtractedWorkshop } from '#server/utils/ai-providers'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageWorkshopLocations } from '#server/utils/permissions/workshop-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'
import { useWorkshopsPorts } from '#server/workshops/ports/registry'
import { journeesEntre } from '~~/shared/utils/fuseau-edition'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Existence + activation via le port (le layer ne lit pas Edition directement)
    const cfg = await useWorkshopsPorts().event.getConfig(editionId)
    if (!cfg.found) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }

    if (!cfg.enabled) {
      throw createError({
        status: 403,
        message: 'Les workshops ne sont pas activés pour cette édition',
      })
    }

    // Vérifier que l'utilisateur peut gérer cette édition (organisateur / admin) — via util core
    if (!(await canManageWorkshopLocations(user, editionId))) {
      throw createError({
        status: 403,
        message:
          'Seuls les organisateurs et super admins peuvent importer des workshops depuis une image',
      })
    }

    // Lire le body
    const body = await readBody(event)
    const { image, forcedDate } = body

    if (!image || typeof image !== 'string') {
      throw createError({
        status: 400,
        message: 'Image manquante ou invalide',
      })
    }

    // Journée imposée par l'organisateur, quand l'affiche n'indique pas de date. Facultative.
    let journeeImposee: string | null = null
    if (forcedDate !== undefined && forcedDate !== null && forcedDate !== '') {
      if (!estJourneeValide(forcedDate)) {
        throw createError({
          status: 400,
          message: 'Date imposée invalide, format attendu : AAAA-MM-JJ',
        })
      }
      // Bornée aux journées de l'édition : le sélecteur ne propose que celles-ci, mais l'API est
      // aussi appelable directement, et un atelier hors édition serait refusé plus loin sans que
      // l'organisateur comprenne pourquoi.
      const journeesEdition = journeesEntre(cfg.startDate, cfg.endDate, cfg.timezone)
      if (journeesEdition.length && !journeesEdition.includes(forcedDate)) {
        throw createError({
          status: 400,
          message: "La date imposée doit être une journée de l'édition",
        })
      }
      journeeImposee = forcedDate
    }

    // Vérifier que c'est bien une image base64
    const base64Match = image.match(/^data:image\/(png|jpg|jpeg|gif|webp);base64,(.+)$/)
    if (!base64Match) {
      throw createError({
        status: 400,
        message: "Format d'image invalide. Utilisez une image encodée en base64",
      })
    }

    const imageType = base64Match[1] as 'png' | 'jpeg' | 'gif' | 'webp'
    const base64Data = base64Match[2]

    // Récupérer la configuration IA depuis la BDD
    const effectiveConfig = await getEffectiveAIConfigAsync()

    const aiProvider = createAIProvider({
      provider: effectiveConfig.aiProvider as 'anthropic' | 'ollama' | 'lmstudio',
      anthropicApiKey: effectiveConfig.anthropicApiKey || undefined,
      ollamaBaseUrl: effectiveConfig.ollamaBaseUrl,
      ollamaModel: effectiveConfig.ollamaModel,
      // Les deux serveurs, chacun avec son modèle vision : l'extraction depuis une image
      // ignorait jusqu'ici l'adresse de secours, et tombait dès que la machine principale
      // s'éteignait — alors que les appels texte, eux, basculaient déjà.
      lmstudioServeurs: serveursLmStudio(effectiveConfig, 'vision'),
    })

    // Créer le prompt pour l'IA
    const prompt = `Tu es un assistant spécialisé dans l'extraction d'informations sur des workshops à partir d'images (affiches, programmes, calendriers, etc.).

Analyse cette image et extrais TOUS les workshops que tu peux identifier. Pour chaque workshop détecté, fournis les informations suivantes :
- title : Le titre du workshop (obligatoire)
- description : Une brève description si disponible (optionnel)
- startDateTime : La date et heure de début au format ISO 8601 (ex: "2024-10-23T14:00:00"). ${
      journeeImposee
        ? `Tous les ateliers de cette image se déroulent le ${journeeImposee} : utilise cette date et concentre-toi sur les heures.`
        : `Si seule l'heure est visible, utilise les dates de l'édition (${cfg.startDate?.toISOString()} à ${cfg.endDate?.toISOString()})`
    }
- endDateTime : La date et heure de fin au format ISO 8601 (optionnel). N'INVENTE JAMAIS de durée : si l'image n'annonce pas d'heure de fin, omets ce champ ou mets-le à null
- maxParticipants : Le nombre maximum de participants si mentionné (optionnel, nombre entier)
- location : Le lieu du workshop si mentionné (optionnel, texte)

IMPORTANT :
- Retourne UNIQUEMENT un objet JSON valide au format suivant : { "workshops": [...] }
- Ne retourne AUCUN texte avant ou après le JSON
- Si aucun workshop n'est détecté, retourne : { "workshops": [] }
- Pour les dates/heures partielles, utilise les dates de l'édition comme référence
- Si plusieurs workshops ont le même titre mais à des horaires différents, crée des entrées séparées

L'édition se déroule du ${cfg.startDate?.toLocaleDateString('fr-FR')} au ${cfg.endDate?.toLocaleDateString('fr-FR')}.

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
    },
    {
      "title": "Scène ouverte",
      "startDateTime": "2024-10-23T21:00:00",
      "endDateTime": null,
      "location": "Chapiteau"
    }
  ]
}`

    // Appeler le provider IA
    const parsedResponse = await aiProvider.extractWorkshopsFromImage(base64Data, imageType, prompt)

    // Valider la structure de la réponse
    if (!parsedResponse.workshops || !Array.isArray(parsedResponse.workshops)) {
      throw createError({
        status: 500,
        message: "Format de réponse invalide de l'IA",
      })
    }

    // Valider chaque workshop extrait
    const validatedWorkshops: ExtractedWorkshop[] = []
    // Les ateliers écartés étaient jusqu'ici perdus sans un mot : une affiche sans dates pouvait
    // ne rien remonter du tout. Le compte est renvoyé pour que la modale puisse le dire.
    let ignoredCount = 0

    for (const workshop of parsedResponse.workshops) {
      // Seuls le titre et l'heure de début sont indispensables : une affiche annonce souvent le
      // début d'un atelier sans dire quand il s'achève, et l'écarter pour autant ferait perdre à
      // l'organisateur une ligne pourtant lisible.
      if (!workshop.title || !workshop.startDateTime) {
        console.warn('Workshop invalide ignoré:', workshop)
        ignoredCount++
        continue
      }

      // Vérifier que les dates sont valides
      const startDate = new Date(workshop.startDateTime)

      if (isNaN(startDate.getTime())) {
        console.warn('Date de début invalide pour le workshop:', workshop.title)
        ignoredCount++
        continue
      }

      // Une heure de fin annoncée, elle, doit tenir debout : illisible ou antérieure au début,
      // elle est effacée plutôt que de faire perdre l'atelier entier.
      let finAnnoncee: string | null = workshop.endDateTime || null
      if (finAnnoncee) {
        const endDate = new Date(finAnnoncee)
        if (isNaN(endDate.getTime()) || endDate <= startDate) {
          console.warn('Heure de fin ignorée pour le workshop:', workshop.title)
          finAnnoncee = null
        }
      }

      // Journée imposée : on replace le créneau nous-mêmes plutôt que de compter sur l'IA, qui
      // suit la consigne la plupart du temps seulement. Les heures et la durée sont conservées,
      // de sorte qu'un atelier à cheval sur minuit le reste.
      let creneau: { startDateTime: string; endDateTime?: string | null } = {
        startDateTime: workshop.startDateTime,
        endDateTime: finAnnoncee,
      }
      if (journeeImposee) {
        const ancre = ancrerCreneauSurJournee(creneau, journeeImposee)
        if (!ancre) {
          console.warn('Recalage impossible pour le workshop:', workshop.title)
          ignoredCount++
          continue
        }
        creneau = ancre
      }

      validatedWorkshops.push({
        title: workshop.title.trim(),
        description: workshop.description?.trim() || undefined,
        startDateTime: creneau.startDateTime,
        endDateTime: creneau.endDateTime || undefined,
        maxParticipants: workshop.maxParticipants
          ? Math.max(1, parseInt(String(workshop.maxParticipants), 10))
          : undefined,
        location: workshop.location?.trim() || undefined,
      })
    }

    return createSuccessResponse({ workshops: validatedWorkshops, ignoredCount })
  },
  { operationName: 'ExtractWorkshopsFromImage' }
)
