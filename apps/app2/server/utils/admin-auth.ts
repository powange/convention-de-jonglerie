import type { EventHandlerRequest, H3Event } from 'h3'

/**
 * Exige un administrateur global, relu en base — contrat d'hôte des layers partagés (la
 * billetterie s'en sert pour ses outils d'administration). Même règle qu'app1 : la session ne
 * suffit pas, un droit retiré doit l'être tout de suite.
 */
export async function requireGlobalAdminWithDbCheck(event: H3Event<EventHandlerRequest>) {
  const { user } = await requireUserSession(event)
  const userId = (user as { id?: number } | undefined)?.id
  if (!userId) throw createError({ status: 401, message: 'Non authentifié' })
  const compte = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isGlobalAdmin: true },
  })
  if (!compte?.isGlobalAdmin) {
    throw createError({ status: 403, message: 'Accès réservé aux administrateurs' })
  }
  return compte
}
