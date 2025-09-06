import { PrismaClient } from '@prisma/client'
import { readBody } from 'h3'

import { requireUserSession } from '#imports'

import { getEmailHash } from '../../../utils/email-hash'

const prisma = new PrismaClient()

// Raisons prédéfinies pour la suppression de comptes
const DELETION_REASONS = {
  NOT_PHYSICAL_PERSON: {
    code: 'NOT_PHYSICAL_PERSON',
    title: 'Compte non-personnel',
    message:
      'Votre compte a été supprimé car il ne correspond pas à une personne physique. Notre plateforme est réservée aux utilisateurs individuels.',
  },
  SPAM_ACTIVITY: {
    code: 'SPAM_ACTIVITY',
    title: 'Activité de spam détectée',
    message:
      "Votre compte a été supprimé en raison d'activités de spam ou de comportement abusif sur notre plateforme.",
  },
  INACTIVE_ACCOUNT: {
    code: 'INACTIVE_ACCOUNT',
    title: 'Compte inactif',
    message:
      "Votre compte a été supprimé en raison d'une inactivité prolongée conformément à notre politique de rétention des données.",
  },
  POLICY_VIOLATION: {
    code: 'POLICY_VIOLATION',
    title: "Violation des conditions d'utilisation",
    message:
      "Votre compte a été supprimé pour violation de nos conditions d'utilisation ou de notre politique communautaire.",
  },
} as const

export default defineEventHandler(async (event) => {
  try {
    // Vérifier l'authentification
    const { user } = await requireUserSession(event)
    const adminUserId = user.id

    if (!adminUserId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Token invalide',
      })
    }

    // Vérifier que l'utilisateur est un super administrateur
    const currentUser = await prisma.user.findUnique({
      where: { id: adminUserId },
      select: { isGlobalAdmin: true, email: true, pseudo: true },
    })

    if (!currentUser?.isGlobalAdmin) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Accès refusé - Droits super administrateur requis',
      })
    }

    // Récupérer l'ID de l'utilisateur à supprimer
    const userIdToDelete = parseInt(event.context.params?.id as string)

    if (isNaN(userIdToDelete)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID utilisateur invalide',
      })
    }

    // Récupérer les données du body
    const body = await readBody(event)
    const { reason } = body

    if (!reason || !DELETION_REASONS[reason as keyof typeof DELETION_REASONS]) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Raison de suppression invalide',
      })
    }

    const deletionReason = DELETION_REASONS[reason as keyof typeof DELETION_REASONS]

    // Empêcher l'auto-suppression
    if (userIdToDelete === adminUserId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Impossible de supprimer son propre compte',
      })
    }

    // Récupérer l'utilisateur à supprimer
    const userToDelete = await prisma.user.findUnique({
      where: { id: userIdToDelete },
      select: {
        id: true,
        email: true,
        pseudo: true,
        nom: true,
        prenom: true,
        isGlobalAdmin: true,
      },
    })

    if (!userToDelete) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Utilisateur non trouvé',
      })
    }

    // Empêcher la suppression d'autres super admins (sécurité supplémentaire)
    if (userToDelete.isGlobalAdmin) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Impossible de supprimer un super administrateur',
      })
    }

    // TODO: Envoyer un email de notification à l'utilisateur supprimé
    // Cette partie sera implémentée quand le système d'email sera configuré
    console.log(
      `[DELETION] Compte supprimé - Email: ${userToDelete.email}, Raison: ${deletionReason.title}`
    )

    // Supprimer l'utilisateur (suppression réelle pour l'instant)
    // Note: En production, on pourrait implémenter une suppression "soft" avec un champ `deletedAt`
    const deletedUser = await prisma.user.delete({
      where: { id: userIdToDelete },
      select: {
        id: true,
        email: true,
        pseudo: true,
        nom: true,
        prenom: true,
      },
    })

    // Log de l'action admin pour audit
    console.log(
      `[ADMIN] Utilisateur supprimé par ${currentUser.pseudo} (${currentUser.email}): ${deletedUser.pseudo} (${deletedUser.email}) - Raison: ${deletionReason.title}`
    )

    return {
      success: true,
      message: `Compte ${deletedUser.pseudo} supprimé avec succès`,
      reason: deletionReason.title,
      deletedUser: {
        id: deletedUser.id,
        pseudo: deletedUser.pseudo,
        emailHash: getEmailHash(deletedUser.email),
      },
    }
  } catch (error: unknown) {
    console.error('Erreur lors de la suppression utilisateur:', error)
    const err = error as { message?: string; stack?: string; statusCode?: number }

    if (err.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: `Erreur interne du serveur: ${err.message}`,
    })
  }
})

// Exporter les raisons pour utilisation dans le frontend
export { DELETION_REASONS }
