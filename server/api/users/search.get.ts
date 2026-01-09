import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { z } from 'zod'

import { requireUserSession } from '#imports'

// GET /api/users/search?emailExact=email (recherche exacte par email)
// Auth requis. Retourne l'utilisateur correspondant (id, pseudo, profilePicture?, emailHash)
export default wrapApiHandler(
  async (event) => {
    await requireUserSession(event)
    const query = getQuery(event)
    const schema = z.object({
      emailExact: z.string().email(),
    })
    const parsed = schema.parse(query)

    const emailLower = parsed.emailExact.toLowerCase().trim()
    const users = await prisma.user.findMany({
      where: { email: emailLower },
      select: {
        id: true,
        pseudo: true,
        prenom: true,
        nom: true,
        profilePicture: true,
        email: true,
        emailHash: true,
      },
      take: 1,
    })

    return {
      users: users.map((u) => ({
        id: u.id,
        pseudo: u.pseudo,
        prenom: u.prenom,
        nom: u.nom,
        profilePicture: u.profilePicture,
        email: u.email,
        emailHash: u.emailHash,
      })),
    }
  },
  { operationName: 'SearchUsers' }
)
