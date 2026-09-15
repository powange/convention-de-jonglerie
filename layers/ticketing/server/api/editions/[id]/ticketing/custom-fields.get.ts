import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à cette fonctionnalité',
      })

    const customFields = await prisma.ticketingTierCustomField.findMany({
      where: { editionId },
      include: {
        tiers: {
          include: {
            tier: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        quotas: {
          include: {
            quota: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        handoutItems: {
          include: {
            handoutItem: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        // D'où vient ce champ. L'écran en marque l'origine d'un logo, comme pour les tarifs et
        // les options.
        externalTicketing: { select: { provider: true } },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    /**
     * Le fournisseur, remonté à plat ; `null` pour un champ saisi à la main.
     *
     * Direct, contrairement aux options : `custom-fields.post.ts` ne renseigne PAS
     * `externalTicketingId` pour un champ créé ici, si bien que le rattachement dit bien
     * l'origine. C'est l'option qui est l'exception, pas la règle.
     */
    return createSuccessResponse({
      customFields: customFields.map((champ) => ({
        ...champ,
        provider: champ.externalTicketing?.provider ?? null,
      })),
    })
  },
  { operationName: 'GET ticketing custom fields' }
)
