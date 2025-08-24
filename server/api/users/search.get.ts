import { z } from 'zod'

import { requireUserSession } from '#imports'

import { getEmailHash } from '../../utils/email-hash'
import { prisma } from '../../utils/prisma'

import type { H3Error } from 'h3'

// GET /api/users/search?q=term
// Auth requis. Retourne jusqu'à 10 utilisateurs (id, pseudo, profilePicture?, emailHash)
export default defineEventHandler(async (event) => {
  try {
    const { user } = await requireUserSession(event)
    const schema = z.object({ q: z.string().min(2).max(50) })
    const { q } = schema.parse(getQuery(event))
    const term = q.trim()
    if (term.length < 2) return []

    // NOTE: Le paramètre Prisma `mode: 'insensitive'` n'est pas supporté avec MySQL (erreur "Unknown argument mode").
    // Les collations MySQL utf8mb4_* sont déjà généralement insensibles à la casse.
    // On supprime donc `mode` et on applique un simple contains.
    const users = await prisma.user.findMany({
      where: {
        OR: [{ pseudo: { contains: term } }, { email: { contains: term } }],
        // Exclure l'utilisateur courant
        NOT: { id: (user as any).id },
      },
      select: { id: true, pseudo: true, profilePicture: true, email: true },
      take: 10,
      orderBy: { pseudo: 'asc' },
    })

    return users.map((u) => ({
      id: u.id,
      pseudo: u.pseudo,
      profilePicture: u.profilePicture,
      emailHash: getEmailHash(u.email),
    }))
  } catch (error: unknown) {
    if ((error as any)?.issues) {
      throw createError({ statusCode: 400, statusMessage: 'Requête invalide' })
    }
    if ((error as H3Error)?.statusCode) throw error
    console.error('Erreur recherche utilisateurs:', error)
    throw createError({ statusCode: 500, statusMessage: 'Erreur serveur' })
  }
})
