import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { NotificationHelpers, safeNotify } from '#server/utils/notification-service'
import { validateEditionId } from '#server/utils/validation-helpers'
import {
  createShowApplicationSchema,
  handleValidationError,
} from '#server/utils/validation-schemas'
import { editionAccueilleDesCandidatures } from '~~/shared/utils/candidature-spectacle'

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

    // Vérifier que l'appel est ouvert (PRIVATE ou PUBLIC)
    if (showCall.visibility !== 'PRIVATE' && showCall.visibility !== 'PUBLIC') {
      throw createError({
        status: 400,
        message: "L'appel à spectacles n'est pas ouvert",
      })
    }

    /*
     * ⚠️ ET QUE L'ÉDITION N'EST PAS ANNULÉE. Seule la visibilité de l'APPEL était contrôlée : une
     * édition `CANCELLED` dont un appel restait `PUBLIC` continuait de recevoir des candidatures et
     * d'envoyer des notifications aux organisateurs — pour un événement qui n'aura pas lieu.
     * L'artiste préparait un dossier, remplissait ses besoins techniques, et postulait dans le vide.
     *
     * ⚠️⚠️ `OFFLINE` N'EST VOLONTAIREMENT PAS REFUSÉ, et c'est une CORRECTION À L'ÉNONCÉ du constat,
     * qui demandait de rejeter les deux. LE FAIT QUI L'INTERDIT : toute édition NAÎT `OFFLINE`
     * (`editions/index.post.ts`, et le défaut du schéma). Ce statut ne veut donc pas seulement dire
     * « retirée de la vue du public » — il veut surtout dire « PAS ENCORE PUBLIÉE ».
     *
     * Or ouvrir un appel à spectacles AVANT de publier son édition est le parcours NORMAL : on
     * réserve ses artistes des mois à l'avance, et l'on publie quand le programme tient. Refuser
     * là aurait cassé ce parcours — trois spécifications Playwright l'exercent, et ce sont elles
     * qui ont attrapé l'erreur.
     *
     * La vraie barrière de l'organisateur est la VISIBILITÉ DE L'APPEL, vérifiée juste au-dessus :
     * c'est le drapeau qu'il pose délibérément.
     *
     * La liste vit dans `shared/utils/candidature-spectacle.ts`, avec le reste de la règle : la
     * liste publique des appels ouverts pose la MÊME question, et elle y répondait autrement
     * (`status: 'PUBLISHED'` en dur, donc sans les éditions `PLANNED`). Deux réponses à une même
     * question sont la cause de la moitié des défauts de ce module.
     */
    if (!editionAccueilleDesCandidatures(edition.status)) {
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

    // Valider les données — schéma adapté au réglage requirePhone du show call,
    // handleValidationError formate les erreurs Zod sous { path: message }
    const applicationSchema = createShowApplicationSchema({
      phoneRequired: showCall.requirePhone,
    })
    const body = await readBody(event)
    let validatedData: z.infer<typeof applicationSchema>
    try {
      validatedData = applicationSchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        handleValidationError(error)
      }
      throw error
    }

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
        stageSetup: validatedData.stageSetup || null,
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

    // Notifier les organisateurs ayant le droit de gérer les artistes
    const convention = await prisma.convention.findFirst({
      where: { editions: { some: { id: editionId } } },
      select: {
        authorId: true,
        organizers: {
          where: { canManageArtists: true },
          select: { userId: true },
        },
      },
    })

    const organizerIds = new Set<number>()
    if (convention) {
      organizerIds.add(convention.authorId)
      convention.organizers.forEach((o) => organizerIds.add(o.userId))
    }

    // Vérifier aussi les permissions per-edition
    const editionPerms = await prisma.editionOrganizerPermission.findMany({
      where: { editionId, canManageArtists: true },
      select: { organizer: { select: { userId: true } } },
    })
    editionPerms.forEach((p) => organizerIds.add(p.organizer.userId))

    const editionName = edition.name || ''

    for (const orgId of organizerIds) {
      if (orgId === user.id) continue
      await safeNotify(
        () =>
          NotificationHelpers.showApplicationSubmitted(
            orgId,
            validatedData.artistName,
            validatedData.showTitle,
            editionName,
            editionId,
            showCallId
          ),
        'notification candidature artiste soumise'
      )
    }

    return createSuccessResponse({ application })
  },
  { operationName: 'SubmitShowCallApplication' }
)
