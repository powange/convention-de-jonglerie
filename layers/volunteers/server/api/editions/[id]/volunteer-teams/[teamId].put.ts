import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId, validateStringResourceId } from '#server/utils/validation-helpers'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'
import { equipeCouvreAuMoinsUnePeriode } from '~~/shared/utils/periodes-equipe'

const updateTeamSchema = z.object({
  name: z.string().min(1, "Le nom de l'équipe est requis").max(100).optional(),
  description: z.string().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'La couleur doit être un code hexadécimal valide')
    .optional(),
  maxVolunteers: z.number().int().positive().optional().nullable(),
  isRequired: z.boolean().optional(),
  isAccessControlTeam: z.boolean().optional(),
  isFloatingTeam: z.boolean().optional(),
  isAutonomousTeam: z.boolean().optional(),
  isMealValidationTeam: z.boolean().optional(),
  isVisibleToVolunteers: z.boolean().optional(),
  coversSetup: z.boolean().optional(),
  coversEvent: z.boolean().optional(),
  coversTeardown: z.boolean().optional(),
})

export default wrapApiHandler(
  async (event) => {
    // Authentification requise
    await requireAuth(event)

    // Validation des paramètres
    const editionId = validateEditionId(event)
    const teamId = validateStringResourceId(event, 'teamId', 'équipe')

    // Vérifier les permissions de gestion des bénévoles
    await useVolunteerPorts().organizers.requireManagementAccess(event, editionId)

    // Validation du body
    const body = await readValidatedBody(event, updateTeamSchema.parse)

    // Vérifier que l'équipe existe et appartient à cette édition
    const existingTeam = await prisma.volunteerTeam.findFirst({
      where: {
        id: teamId,
        eventId: editionId,
      },
    })

    if (!existingTeam) {
      throw createError({
        status: 404,
        message: "Équipe non trouvée ou n'appartient pas à cette édition",
      })
    }

    // Vérifier qu'une équipe avec ce nom n'existe pas déjà (si le nom change)
    if (body.name && body.name !== existingTeam.name) {
      const nameConflict = await prisma.volunteerTeam.findFirst({
        where: {
          eventId: editionId,
          name: body.name,
          id: { not: teamId },
        },
      })

      if (nameConflict) {
        throw createError({
          status: 400,
          message: 'Une équipe avec ce nom existe déjà pour cette édition',
        })
      }
    }

    // Mise à jour de l'équipe
    const updateData: any = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.color !== undefined) updateData.color = body.color
    if (body.maxVolunteers !== undefined) updateData.maxVolunteers = body.maxVolunteers
    if (body.isRequired !== undefined) updateData.isRequired = body.isRequired
    if (body.isAccessControlTeam !== undefined)
      updateData.isAccessControlTeam = body.isAccessControlTeam
    if (body.isFloatingTeam !== undefined) updateData.isFloatingTeam = body.isFloatingTeam
    if (body.isAutonomousTeam !== undefined) updateData.isAutonomousTeam = body.isAutonomousTeam
    if (body.isMealValidationTeam !== undefined)
      updateData.isMealValidationTeam = body.isMealValidationTeam
    if (body.isVisibleToVolunteers !== undefined)
      updateData.isVisibleToVolunteers = body.isVisibleToVolunteers
    if (body.coversSetup !== undefined) updateData.coversSetup = body.coversSetup
    if (body.coversEvent !== undefined) updateData.coversEvent = body.coversEvent
    if (body.coversTeardown !== undefined) updateData.coversTeardown = body.coversTeardown

    /*
     * Au moins une période, contrôlé APRÈS fusion avec l'équipe existante.
     *
     * Une garde dans le schéma refuserait à tort un appel qui ne touche pas aux périodes — ce point
     * d'API est une mise à jour partielle. Et décocher la seule période restante est justement le
     * geste qui mène à l'état incohérent : l'équipe ne serait plus proposée à personne.
     */
    const periodesApresMiseAJour = {
      coversSetup: body.coversSetup ?? existingTeam.coversSetup,
      coversEvent: body.coversEvent ?? existingTeam.coversEvent,
      coversTeardown: body.coversTeardown ?? existingTeam.coversTeardown,
    }
    if (!equipeCouvreAuMoinsUnePeriode(periodesApresMiseAJour)) {
      throw createError({
        status: 400,
        message: 'Une équipe doit couvrir au moins une période : montage, événement ou démontage',
      })
    }

    // Une équipe non visible ne peut pas être obligatoire
    const willBeInvisible =
      body.isVisibleToVolunteers === false ||
      (body.isVisibleToVolunteers === undefined && !existingTeam.isVisibleToVolunteers)
    if (willBeInvisible) {
      updateData.isRequired = false
    }

    const team = await prisma.volunteerTeam.update({
      where: { id: teamId },
      data: updateData,
      include: {
        _count: {
          select: {
            timeSlots: true,
          },
        },
      },
    })

    return createSuccessResponse(team)
  },
  { operationName: 'UpdateVolunteerTeam' }
)
