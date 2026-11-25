/**
 * Données de l'espace « Mon profil » : identité, comptes liés, et un résumé d'activité.
 *
 * Lu en base et non dans la session : la session est un cookie scellé qui emporte une COPIE du
 * compte, figée à la connexion — la photo de profil n'y est d'ailleurs pas.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const id = (user as { id: number }).id

  const compte = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      pseudo: true,
      prenom: true,
      nom: true,
      profilePicture: true,
      createdAt: true,
      password: true,
      googleId: true,
      facebookId: true,
      _count: { select: { events: true } },
      subscription: { select: { plan: true, status: true, currentPeriodEnd: true } },
    },
  })
  if (!compte) throw createError({ status: 404, message: 'Utilisateur introuvable' })

  const { password, googleId, facebookId, _count, ...identite } = compte
  return createSuccessResponse({
    ...identite,
    // Jamais le hachage lui-même : seulement s'il existe (un compte Google/Facebook peut ne pas en avoir).
    hasPassword: password !== null,
    googleLinked: googleId !== null,
    facebookLinked: facebookId !== null,
    eventsCount: _count.events,
  })
})
