import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { z } from 'zod'

import { requireUserSession } from '#imports'

import type { UserWhereInput } from '@@/server/types/prisma-helpers'

// GET /api/users/search?q=term ou ?email=term (recherche partielle) ou ?emailExact=email (recherche exacte)
// Auth requis. Retourne jusqu'à 10 utilisateurs (id, pseudo, profilePicture?, emailHash)
export default wrapApiHandler(
  async (event) => {
    await requireUserSession(event)
    const query = getQuery(event)
    const schema = z.object({
      q: z.string().min(2).max(50).optional(),
      email: z.string().min(2).max(50).optional(),
      emailExact: z.string().email().optional(),
    })
    const parsed = schema.parse(query)

    // Recherche exacte par email si emailExact est fourni
    if (parsed.emailExact) {
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
    }

    // Recherche partielle par pseudo ou email (comportement existant)
    const term = (parsed.q || parsed.email || '').trim()
    if (term.length < 2) return { users: [] }

    // NOTE: Le paramètre Prisma `mode: 'insensitive'` n'est pas supporté avec MySQL (erreur "Unknown argument mode").
    // Les collations MySQL utf8mb4_* sont déjà généralement insensibles à la casse.
    // On supprime donc `mode` et on applique un simple contains.
    const whereClause: UserWhereInput = {
      OR: [{ pseudo: { contains: term } }, { email: { contains: term } }],
    }

    // Note: On n'exclut plus l'utilisateur courant pour permettre de s'ajouter soi-même comme artiste

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        pseudo: true,
        prenom: true,
        nom: true,
        profilePicture: true,
        email: true,
        emailHash: true,
      },
      take: 10,
      orderBy: { pseudo: 'asc' },
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
