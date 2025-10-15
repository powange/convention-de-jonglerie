import { hasIssues, isHttpError, type UserWhereInput } from '@@/server/types/prisma-helpers'
import { checkAdminMode } from '@@/server/utils/collaborator-management'
import { getEmailHash } from '@@/server/utils/email-hash'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

import { requireUserSession } from '#imports'

// GET /api/users/search?q=term ou ?email=term
// Auth requis. Retourne jusqu'à 10 utilisateurs (id, pseudo, profilePicture?, emailHash)
export default defineEventHandler(async (event) => {
  try {
    const { user } = await requireUserSession(event)
    const query = getQuery(event)
    const schema = z.object({
      q: z.string().min(2).max(50).optional(),
      email: z.string().min(2).max(50).optional(),
    })
    const parsed = schema.parse(query)
    const term = (parsed.q || parsed.email || '').trim()
    if (term.length < 2) return { users: [] }

    // Vérifier si l'utilisateur est en mode admin
    const isInAdminMode = await checkAdminMode(user.id, event)

    // NOTE: Le paramètre Prisma `mode: 'insensitive'` n'est pas supporté avec MySQL (erreur "Unknown argument mode").
    // Les collations MySQL utf8mb4_* sont déjà généralement insensibles à la casse.
    // On supprime donc `mode` et on applique un simple contains.
    const whereClause: UserWhereInput = {
      OR: [{ pseudo: { contains: term } }, { email: { contains: term } }],
    }

    // Exclure l'utilisateur courant seulement si pas en mode admin
    if (!isInAdminMode) {
      whereClause.NOT = { id: user.id }
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        pseudo: true,
        prenom: true,
        nom: true,
        profilePicture: true,
        email: true,
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
        emailHash: getEmailHash(u.email),
      })),
    }
  } catch (error: unknown) {
    if (hasIssues(error)) {
      throw createError({ statusCode: 400, message: 'Requête invalide' })
    }
    if (isHttpError(error)) throw error
    console.error('Erreur recherche utilisateurs:', error)
    throw createError({ statusCode: 500, message: 'Erreur serveur' })
  }
})
