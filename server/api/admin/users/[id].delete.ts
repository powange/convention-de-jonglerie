import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { sendEmail, generateAccountDeletionEmailHtml } from '@@/server/utils/emailService'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { validateResourceId } from '@@/server/utils/validation-helpers'
import { readBody } from 'h3'

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

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin (mutualisé)
    const adminUser = await requireGlobalAdminWithDbCheck(event)

    // Récupérer l'ID de l'utilisateur à supprimer
    const userIdToDelete = validateResourceId(event, 'id', 'utilisateur')

    // Récupérer les données du body
    const body = await readBody(event)
    const { reason } = body

    if (!reason || !DELETION_REASONS[reason as keyof typeof DELETION_REASONS]) {
      throw createError({
        status: 400,
        message: 'Raison de suppression invalide',
      })
    }

    const deletionReason = DELETION_REASONS[reason as keyof typeof DELETION_REASONS]

    // Empêcher l'auto-suppression
    if (userIdToDelete === adminUser.id) {
      throw createError({
        status: 400,
        message: 'Impossible de supprimer son propre compte',
      })
    }

    // Récupérer l'utilisateur à supprimer
    const userToDelete = await fetchResourceOrFail(prisma.user, userIdToDelete, {
      errorMessage: 'Utilisateur non trouvé',
      select: {
        id: true,
        email: true,
        pseudo: true,
        nom: true,
        prenom: true,
        isGlobalAdmin: true,
      },
    })

    // Empêcher la suppression d'autres super admins (sécurité supplémentaire)
    if (userToDelete.isGlobalAdmin) {
      throw createError({
        status: 403,
        message: 'Impossible de supprimer un super administrateur',
      })
    }

    // Envoyer un email de notification à l'utilisateur avant suppression
    try {
      const emailHtml = await generateAccountDeletionEmailHtml(
        userToDelete.prenom || '',
        deletionReason
      )
      const emailSent = await sendEmail({
        to: userToDelete.email,
        subject: `⚠️  Suppression de votre compte - ${deletionReason.title}`,
        html: emailHtml,
        text: `Bonjour ${userToDelete.prenom}, votre compte a été supprimé. Motif: ${deletionReason.title} - ${deletionReason.message}`,
      })

      if (emailSent) {
        console.log(`✅ Email de suppression envoyé à ${userToDelete.email}`)
      } else {
        console.error(`❌ Échec envoi email de suppression à ${userToDelete.email}`)
      }
    } catch (emailError) {
      console.error('❌ Erreur envoi email de suppression:', emailError)
      // On continue la suppression même si l'email échoue
    }

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
      `[ADMIN] Utilisateur supprimé par ${adminUser.pseudo} (${adminUser.email}): ${deletedUser.pseudo} (${deletedUser.email}) - Raison: ${deletionReason.title}`
    )

    return {
      success: true,
      message: `Compte ${deletedUser.pseudo} supprimé avec succès`,
      reason: deletionReason.title,
      deletedUser: {
        id: deletedUser.id,
        pseudo: deletedUser.pseudo,
      },
    }
  },
  { operationName: 'DeleteUser' }
)

// Exporter les raisons pour utilisation dans le frontend
export { DELETION_REASONS }
