import { z } from 'zod'

// Met à jour les catégories de l'utilisateur (bénévole / artiste / organisateur).
// Appelé par la page de complétion de profil du layer d'auth (/auth/complete-profile).
const schema = z.object({
  isVolunteer: z.boolean().optional(),
  isArtist: z.boolean().optional(),
  isOrganizer: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const { isVolunteer, isArtist, isOrganizer } = schema.parse(await readBody(event))

  const updated = await prisma.user.update({
    where: { id: (user as { id: number }).id },
    data: {
      ...(isVolunteer !== undefined ? { isVolunteer } : {}),
      ...(isArtist !== undefined ? { isArtist } : {}),
      ...(isOrganizer !== undefined ? { isOrganizer } : {}),
    },
    select: {
      id: true,
      email: true,
      pseudo: true,
      nom: true,
      prenom: true,
      profilePicture: true,
      isVolunteer: true,
      isArtist: true,
      isOrganizer: true,
    },
  })

  return createSuccessResponse(updated)
})
