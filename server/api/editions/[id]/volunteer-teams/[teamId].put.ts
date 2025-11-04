import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { requireVolunteerManagementAccess } from '@@/server/utils/permissions/volunteer-permissions'
import { prisma } from '@@/server/utils/prisma'
import { validateEditionId, validateResourceId } from '@@/server/utils/validation-helpers'
import { z } from 'zod'

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
  isMealValidationTeam: z.boolean().optional(),
  isVisibleToVolunteers: z.boolean().optional(),
})

export default wrapApiHandler(
  async (event) => {
    // Authentification requise
    await requireAuth(event)

    // Validation des paramètres
    const editionId = validateEditionId(event)
    const teamId = validateResourceId(event, 'teamId', 'équipe')

    // Vérifier les permissions de gestion des bénévoles
    await requireVolunteerManagementAccess(event, editionId)

    // Validation du body
    const body = await readValidatedBody(event, updateTeamSchema.parse)

    // Vérifier que l'équipe existe et appartient à cette édition
    const existingTeam = await prisma.volunteerTeam.findFirst({
      where: {
        id: teamId,
        editionId,
      },
    })

    if (!existingTeam) {
      throw createError({
        statusCode: 404,
        message: "Équipe non trouvée ou n'appartient pas à cette édition",
      })
    }

    // Vérifier qu'une équipe avec ce nom n'existe pas déjà (si le nom change)
    if (body.name && body.name !== existingTeam.name) {
      const nameConflict = await prisma.volunteerTeam.findFirst({
        where: {
          editionId,
          name: body.name,
          id: { not: teamId },
        },
      })

      if (nameConflict) {
        throw createError({
          statusCode: 400,
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
    if (body.isMealValidationTeam !== undefined)
      updateData.isMealValidationTeam = body.isMealValidationTeam
    if (body.isVisibleToVolunteers !== undefined)
      updateData.isVisibleToVolunteers = body.isVisibleToVolunteers

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

    return team
  },
  { operationName: 'UpdateVolunteerTeam' }
)
