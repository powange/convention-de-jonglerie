import { requireUserSession } from '#imports'

/**
 * Les notifications du compte connecté, pour la cloche : les trente plus récentes et le nombre de
 * non lues. Flowvent est en français seul : les notifications portent leur texte (`titleText`,
 * `messageText`) ; une clé de traduction ne sert que de repli, telle quelle.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const userId = (user as { id: number }).id
  const [notifications, nonLues] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        type: true,
        titleText: true,
        titleKey: true,
        messageText: true,
        messageKey: true,
        actionText: true,
        actionUrl: true,
        isRead: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ])
  return {
    nonLues,
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      titre: n.titleText || n.titleKey || '',
      message: n.messageText || n.messageKey || '',
      action: n.actionText,
      url: n.actionUrl,
      lue: n.isRead,
      creeeLe: n.createdAt,
    })),
  }
})
