import { z } from 'zod'

import { requireUserSession } from '#imports'

import { checkAdminMode } from '../../utils/collaborator-management'
import { getEmailHash } from '../../utils/email-hash'
import { prisma } from '../../utils/prisma'

import type { H3Error } from 'h3'

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
    const isInAdminMode = await checkAdminMode((user as any).id, event)

    // NOTE: Le paramètre Prisma `mode: 'insensitive'` n'est pas supporté avec MySQL (erreur "Unknown argument mode").
    // Les collations MySQL utf8mb4_* sont déjà généralement insensibles à la casse.
    // On supprime donc `mode` et on applique un simple contains.
    const whereClause: any = {
      OR: [{ pseudo: { contains: term } }, { email: { contains: term } }],
    }

    // Exclure l'utilisateur courant seulement si pas en mode admin
    if (!isInAdminMode) {
      whereClause.NOT = { id: (user as any).id }
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
    if ((error as any)?.issues) {
      throw createError({ statusCode: 400, message: 'Requête invalide' })
    }
    if ((error as H3Error)?.statusCode) throw error
    console.error('Erreur recherche utilisateurs:', error)
    throw createError({ statusCode: 500, message: 'Erreur serveur' })
  }
})
