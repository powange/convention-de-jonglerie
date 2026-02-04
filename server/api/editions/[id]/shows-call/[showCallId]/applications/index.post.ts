import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { validateEditionId } from '@@/server/utils/validation-helpers'
import { showApplicationSchema } from '@@/server/utils/validation-schemas'

/**
 * Soumettre une candidature à un appel à spectacles
 * Accessible par les utilisateurs avec la catégorie "artiste" si l'appel est ouvert
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const showCallId = Number(getRouterParam(event, 'showCallId'))

    if (isNaN(showCallId)) {
      throw createError({
        status: 400,
        message: "ID de l'appel à spectacles invalide",
      })
    }

    // Vérifier que l'utilisateur a la catégorie artiste
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isArtist: true },
    })

    if (!userData?.isArtist) {
      throw createError({
        status: 403,
        message:
          'Vous devez avoir la catégorie "Artiste" activée dans votre profil pour candidater',
      })
    }

    // Récupérer l'édition
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
    })

    if (!edition) {
      throw createError({
        status: 404,
        message: 'Édition non trouvée',
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
        status: 404,
        message: 'Appel à spectacles non trouvé',
      })
    }

    // Vérifier que l'appel est ouvert
    if (!showCall.isOpen) {
      throw createError({
        status: 400,
        message: "L'appel à spectacles n'est pas ouvert",
      })
    }

    // Vérifier le mode
    if (showCall.mode === 'EXTERNAL') {
      throw createError({
        status: 400,
        message:
          "Les candidatures se font via un formulaire externe. Veuillez utiliser l'URL fournie.",
        data: {
          externalUrl: showCall.externalUrl,
        },
      })
    }

    // Vérifier la date limite
    if (showCall.deadline && new Date() > new Date(showCall.deadline)) {
      throw createError({
        status: 400,
        message: 'La date limite de candidature est dépassée',
      })
    }

    // Vérifier que l'utilisateur n'a pas déjà candidaté pour cet appel
    const existingApplication = await prisma.showApplication.findUnique({
      where: {
        showCallId_userId: {
          showCallId: showCall.id,
          userId: user.id,
        },
      },
    })

    if (existingApplication) {
      throw createError({
        status: 400,
        message: 'Vous avez déjà soumis une candidature pour cet appel à spectacles',
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

    // Créer la candidature
    const application = await prisma.showApplication.create({
      data: {
        showCallId: showCall.id,
        userId: user.id,
        status: 'PENDING',
        // Infos artiste
        artistName: validatedData.artistName,
        artistBio: validatedData.artistBio || null,
        portfolioUrl: validatedData.portfolioUrl || null,
        videoUrl: validatedData.videoUrl || null,
        socialLinks: validatedData.socialLinks || null,
        // Infos spectacle
        showTitle: validatedData.showTitle,
        showDescription: validatedData.showDescription,
        showDuration: validatedData.showDuration,
        showCategory: validatedData.showCategory || null,
        technicalNeeds: validatedData.technicalNeeds || null,
        additionalPerformersCount: validatedData.additionalPerformersCount,
        additionalPerformers: validatedData.additionalPerformers || null,
        // Logistique
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
  { operationName: 'SubmitShowCallApplication' }
)
