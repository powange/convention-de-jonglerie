import { z } from 'zod'

import { requireUserSession } from '#imports'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { schemaAdresseEmail } from '~~/shared/utils/adresse-email'

// GET /api/users/search?emailExact=email (recherche exacte par email)
// Auth requis. Retourne l'utilisateur correspondant (id, pseudo, profilePicture?, emailHash)
export default wrapApiHandler(
  async (event) => {
    await requireUserSession(event)
    const query = getQuery(event)
    // Le même schéma que l'interface applique avant d'appeler : sans cela, elle émettait des
    // requêtes qu'elle jugeait valables et que le serveur refusait, pour un résultat vide côté
    // utilisateur et une erreur 400 au journal.
    const schema = z.object({
      emailExact: schemaAdresseEmail,
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
        pronouns: true,
        profilePicture: true,
        email: true,
        emailHash: true,
      },
      take: 1,
    })

    return createSuccessResponse({
      users: users.map((u) => ({
        id: u.id,
        pseudo: u.pseudo,
        prenom: u.prenom,
        nom: u.nom,
        pronouns: u.pronouns,
        profilePicture: u.profilePicture,
        email: u.email,
        emailHash: u.emailHash,
      })),
    })
  },
  { operationName: 'SearchUsers' }
)
