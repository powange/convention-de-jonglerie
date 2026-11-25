import type { H3Event } from 'h3'

/**
 * Garde des points d'administration de Flowvent : un compte connecté ET administrateur global.
 *
 * Le statut est relu EN BASE, pas dans la session : la session en garde une copie qui peut dater
 * d'avant un retrait du statut. Un non-administrateur reçoit 404 — l'administration ne s'annonce
 * pas.
 */
export async function exigerAdministrateur(event: H3Event): Promise<number> {
  const { user } = await requireUserSession(event)
  const userId = (user as { id: number }).id
  const compte = await prisma.user.findUnique({
    where: { id: userId },
    select: { isGlobalAdmin: true },
  })
  if (!compte?.isGlobalAdmin) throw createError({ status: 404, message: 'Page introuvable' })
  return userId
}
