import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { validateEditionId } from '@@/server/utils/validation-helpers'
import { showApplicationSchema } from '@@/server/utils/validation-schemas'

/**
 * Modifier sa candidature à un appel à spectacles
 * Accessible uniquement si la candidature est en attente (PENDING)
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const showCallId = Number(getRouterParam(event, 'showCallId'))

    if (isNaN(showCallId)) {
      throw createError({
        statusCode: 400,
        message: "ID de l'appel à spectacles invalide",
      })
    }

    // Récupérer l'appel à spectacles
    const showCall = await prisma.editionShowCall.findFirst({
      where: {
        id: showCallId,
        editionId,
      },
    })

    if (!showCall) {
      throw createError({
        statusCode: 404,
        message: 'Appel à spectacles non trouvé',
      })
    }

    // Récupérer la candidature existante de l'utilisateur
    const existingApplication = await prisma.showApplication.findUnique({
      where: {
        showCallId_userId: {
          showCallId: showCall.id,
          userId: user.id,
        },
      },
    })

    if (!existingApplication) {
      throw createError({
        statusCode: 404,
        message: 'Candidature non trouvée',
      })
    }

    // Vérifier que la candidature est en attente
    if (existingApplication.status !== 'PENDING') {
      throw createError({
        statusCode: 400,
        message: 'Vous ne pouvez modifier votre candidature que si elle est en attente',
      })
    }

    // Vérifier que l'appel est toujours ouvert
    if (!showCall.isOpen) {
      throw createError({
        statusCode: 400,
        message:
          "L'appel à spectacles n'est plus ouvert, vous ne pouvez plus modifier votre candidature",
      })
    }

    // Vérifier la date limite
    if (showCall.deadline && new Date() > new Date(showCall.deadline)) {
      throw createError({
        statusCode: 400,
        message: 'La date limite est dépassée, vous ne pouvez plus modifier votre candidature',
      })
    }

    // Valider les données
    const body = await readBody(event)
    const validatedData = showApplicationSchema.parse(body)

    // Mettre à jour le profil utilisateur avec les informations personnelles
    await prisma.user.update({
      where: { id: user.id },
      data: {
        nom: validatedData.lastName,
        prenom: validatedData.firstName,
        phone: validatedData.phone,
      },
    })

    // Mettre à jour la candidature
    const application = await prisma.showApplication.update({
      where: {
        id: existingApplication.id,
      },
      data: {
        // Infos artiste
        artistName: validatedData.artistName,
        artistBio: validatedData.artistBio || null,
        portfolioUrl: validatedData.portfolioUrl || null,
        videoUrl: validatedData.videoUrl || null,
        // Infos spectacle
        showTitle: validatedData.showTitle,
        showDescription: validatedData.showDescription,
        showDuration: validatedData.showDuration,
        showCategory: validatedData.showCategory || null,
        technicalNeeds: validatedData.technicalNeeds || null,
        additionalPerformersCount: validatedData.additionalPerformersCount,
        additionalPerformers: validatedData.additionalPerformers || null,
        // Logistique
        availableDates: validatedData.availableDates || null,
        accommodationNeeded: validatedData.accommodationNeeded ?? false,
        accommodationNotes: validatedData.accommodationNotes || null,
        departureCity: validatedData.departureCity || null,
      },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            emailHash: true,
            profilePicture: true,
          },
        },
      },
    })

    return {
      success: true,
      application,
    }
  },
  { operationName: 'UpdateMyShowCallApplication' }
)
