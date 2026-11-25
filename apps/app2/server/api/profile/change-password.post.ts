import bcrypt from 'bcryptjs'
import { z } from 'zod'

import { schemaMotDePasse } from '#auth/shared/utils/regles-mot-de-passe'

/**
 * Change le mot de passe — ou en DÉFINIT un, pour un compte créé via Google ou Facebook.
 *
 * Mêmes règles qu'app1 (server/api/profile/change-password.post.ts) : le mot de passe actuel est
 * exigé dès qu'il en existe un, et le nouveau suit les règles partagées du layer d'auth, celles
 * que l'interface affiche.
 */
const schema = z.object({
  currentPassword: z.string().optional(),
  newPassword: schemaMotDePasse(),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const id = (user as { id: number }).id

  const resultat = schema.safeParse(await readBody(event))
  if (!resultat.success) {
    throw createError({
      status: 400,
      message: resultat.error.issues[0]?.message ?? 'Données invalides',
    })
  }
  const currentPassword = resultat.data.currentPassword || undefined
  const { newPassword } = resultat.data

  const compte = await prisma.user.findUnique({ where: { id }, select: { password: true } })
  if (!compte) throw createError({ status: 404, message: 'Utilisateur introuvable' })

  if (compte.password) {
    if (!currentPassword) {
      throw createError({ status: 400, message: 'Mot de passe actuel requis' })
    }
    if (!(await bcrypt.compare(currentPassword, compte.password))) {
      throw createError({ status: 400, message: 'Mot de passe actuel incorrect' })
    }
  }

  await prisma.user.update({
    where: { id },
    data: { password: await bcrypt.hash(newPassword, 12) },
  })

  return createSuccessResponse(
    { hasPassword: true },
    compte.password ? 'Mot de passe modifié' : 'Mot de passe défini'
  )
})
