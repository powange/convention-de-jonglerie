import { z } from 'zod'

import { utilisateurDeSession } from '#auth/shared/utils/utilisateur-de-session'
import { photoAEnregistrer } from '#server/utils/photo-de-profil'
import { pseudoSchema } from '#server/utils/validation-schemas'

/**
 * Modifie l'identité affichée : pseudo, prénom, nom, et la photo de profil (cf. photo-de-profil.ts).
 *
 * L'adresse e-mail n'est PAS modifiable ici : app1 exige le mot de passe et un code reçu par
 * courriel, et app2 n'envoie encore aucun courriel. La changer sans confirmation permettrait de
 * détourner un compte vers une adresse non vérifiée.
 */
const schema = z.object({
  pseudo: pseudoSchema.trim(),
  prenom: z.string().trim().min(1, 'Le prénom est requis').max(100),
  nom: z.string().trim().min(1, 'Le nom est requis').max(100),
  // Absent : inchangée ; `null` : retirée ; sinon l'URL temporaire d'un dépôt, ou la valeur en base.
  profilePicture: z.string().max(500).nullable().optional(),
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
  const { pseudo, prenom, nom, profilePicture } = resultat.data

  const pris = await prisma.user.findFirst({
    where: { pseudo, NOT: { id } },
    select: { id: true },
  })
  if (pris) throw createError({ status: 409, message: 'Ce pseudo est déjà utilisé' })

  // La photo d'abord : un dépôt introuvable refuse tout l'enregistrement, et rien n'est modifié.
  const actuelle =
    (await prisma.user.findUnique({ where: { id }, select: { profilePicture: true } }))
      ?.profilePicture ?? null
  const photo = await photoAEnregistrer(profilePicture, actuelle, id)

  const compte = await prisma.user.update({
    where: { id },
    data: { pseudo, prenom, nom, ...(photo !== undefined && { profilePicture: photo }) },
  })

  // La session porte une copie du compte : sans cette mise à jour, le menu afficherait l'ancien
  // pseudo jusqu'à la prochaine connexion.
  await setUserSession(event, { user: utilisateurDeSession(compte) })

  return createSuccessResponse(
    { pseudo, prenom, nom, profilePicture: compte.profilePicture },
    'Profil mis à jour'
  )
})
