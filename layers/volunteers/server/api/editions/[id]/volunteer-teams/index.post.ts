import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'
import { equipeCouvreAuMoinsUnePeriode } from '~~/shared/utils/periodes-equipe'

const createTeamSchema = z
  .object({
    name: z.string().min(1, "Le nom de l'équipe est requis").max(100),
    description: z.string().optional(),
    color: z
      .string()
      .regex(/^#[0-9A-F]{6}$/i, 'La couleur doit être un code hexadécimal valide')
      .default('#6b7280'),
    maxVolunteers: z.number().int().positive().optional(),
    isRequired: z.boolean().optional().default(false),
    isAccessControlTeam: z.boolean().optional().default(false),
    isFloatingTeam: z.boolean().optional().default(false),
    isAutonomousTeam: z.boolean().optional().default(false),
    isVisibleToVolunteers: z.boolean().optional().default(true),
    /*
     * Les périodes de l'équipe, `true` par défaut sur les trois : un client qui ne les envoie pas —
     * un appel écrit à la main, ou l'écran de gestion d'avant ce lot — obtient une équipe présente
     * partout, c'est-à-dire le comportement qui existait.
     */
    coversSetup: z.boolean().optional().default(true),
    coversEvent: z.boolean().optional().default(true),
    coversTeardown: z.boolean().optional().default(true),
  })
  // Aucune période cochée est un état incohérent : l'équipe ne serait proposée à personne dans les
  // équipes préférées, sans que rien ne l'explique à l'organisateur qui l'a créée.
  .refine(equipeCouvreAuMoinsUnePeriode, {
    message: 'Une équipe doit couvrir au moins une période : montage, événement ou démontage',
    path: ['coversEvent'],
  })

export default wrapApiHandler(
  async (event) => {
    // Authentification requise
    await requireAuth(event)

    // Validation des paramètres
    const editionId = validateEditionId(event)

    // Vérifier les permissions de gestion des bénévoles
    await useVolunteerPorts().organizers.requireManagementAccess(event, editionId)

    // Validation du body
    const body = await readValidatedBody(event, createTeamSchema.parse)

    // Étape 0bis : vérif d'existence sur l'Event (id == eventId), sans dépendre d'Edition.
    const eventRecord = await prisma.event.findUnique({
      where: { id: editionId },
      select: { id: true },
    })

    if (!eventRecord) {
      throw createError({
        status: 404,
        message: 'Édition non trouvée',
      })
    }

    // Vérifier qu'une équipe avec ce nom n'existe pas déjà pour cette édition
    const existingTeam = await prisma.volunteerTeam.findFirst({
      where: {
        eventId: editionId,
        name: body.name,
      },
    })

    if (existingTeam) {
      throw createError({
        status: 400,
        message: 'Une équipe avec ce nom existe déjà pour cette édition',
      })
    }

    // Une équipe non visible ne peut pas être obligatoire
    const isRequired = body.isVisibleToVolunteers === false ? false : body.isRequired

    // Créer l'équipe
    const team = await prisma.volunteerTeam.create({
      data: {
        eventId: editionId,
        name: body.name,
        description: body.description,
        color: body.color,
        maxVolunteers: body.maxVolunteers,
        isRequired,
        isAccessControlTeam: body.isAccessControlTeam,
        isFloatingTeam: body.isFloatingTeam,
        isAutonomousTeam: body.isAutonomousTeam,
        isVisibleToVolunteers: body.isVisibleToVolunteers,
      },
      include: {
        _count: {
          select: {
            timeSlots: true,
          },
        },
      },
    })

    setResponseStatus(event, 201)
    return createSuccessResponse(team)
  },
  { operationName: 'CreateVolunteerTeam' }
)
