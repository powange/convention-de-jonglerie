import { z } from 'zod'

import { utilisateurDeSession } from '#auth/shared/utils/utilisateur-de-session'
import { pseudoSchema } from '#server/utils/validation-schemas'

/**
 * Modifie l'identité affichée : pseudo, prénom, nom.
 *
 * L'adresse e-mail n'est PAS modifiable ici : app1 exige le mot de passe et un code reçu par
 * courriel, et app2 n'envoie encore aucun courriel. La changer sans confirmation permettrait de
 * détourner un compte vers une adresse non vérifiée.
 */
const schema = z.object({
  pseudo: pseudoSchema.trim(),
  prenom: z.string().trim().min(1, 'Le prénom est requis').max(100),
  nom: z.string().trim().min(1, 'Le nom est requis').max(100),
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
  const { pseudo, prenom, nom } = resultat.data

  const pris = await prisma.user.findFirst({
    where: { pseudo, NOT: { id } },
    select: { id: true },
  })
  if (pris) throw createError({ status: 409, message: 'Ce pseudo est déjà utilisé' })

  const compte = await prisma.user.update({ where: { id }, data: { pseudo, prenom, nom } })

  // La session porte une copie du compte : sans cette mise à jour, le menu afficherait l'ancien
  // pseudo jusqu'à la prochaine connexion.
  await setUserSession(event, { user: utilisateurDeSession(compte) })

  return createSuccessResponse({ pseudo, prenom, nom }, 'Profil mis à jour')
})
