import { readBody } from 'h3'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { oublierSessionDuCompte } from '#server/utils/cache-session'
import { sendEmail, generateAccountDeletionEmailHtml } from '#server/utils/emailService'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { validateResourceId } from '#server/utils/validation-helpers'

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

    /*
     * ⚠️ LA SUPPRESSION D'ABORD, LE COURRIEL ENSUITE. L'ordre inverse — celui d'origine — envoyait
     * « votre compte a été supprimé », définitif et motivé, AVANT de supprimer quoi que ce soit.
     *
     * Toute défaillance de la suppression laissait donc un compte VIVANT dont le titulaire venait
     * d'apprendre qu'il n'existait plus : une clé étrangère en RESTRICT, une coupure de base, un
     * conteneur qui tombe entre les deux. La personne écrit alors pour contester une suppression
     * qui n'a pas eu lieu, et l'administrateur ne trouve rien dans les journaux qui explique
     * l'écart — puisque le courriel, lui, est bien parti.
     *
     * Le `console.log` d'audit annonçait « Compte supprimé » au même endroit, donc lui aussi avant
     * les faits. Il descend avec le reste.
     *
     * ⚠️ Le risque s'inverse et c'est assumé : si l'envoi échoue APRÈS la suppression, le compte
     * est bien supprimé et son titulaire n'en est pas averti. C'est le moindre des deux maux —
     * le silence se rattrape, l'annonce d'un fait qui n'a pas eu lieu non. Et l'échec d'envoi
     * était DÉJÀ toléré auparavant (le `catch` ci-dessous ne l'a jamais interrompu) : ce lot ne
     * change donc rien sur ce point, il change seulement ce qui est vrai quand le courriel part.
     */
    // Comme pour la suppression de son propre compte : sans cet oubli, la session de la personne
    // resterait acceptée par le middleware le temps du cache, alors que son compte n'existe plus.
    oublierSessionDuCompte(userIdToDelete)

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

    console.log(
      `[DELETION] Compte supprimé - Email: ${deletedUser.email}, Raison: ${deletionReason.title}`
    )

    /*
     * Le courriel se compose sur `deletedUser`, ce que la suppression vient de rendre, et non sur
     * `userToDelete` lu plus haut : c'est la seule forme qui ne peut pas décrire un compte que
     * l'on n'a pas supprimé.
     */
    try {
      const emailHtml = await generateAccountDeletionEmailHtml(
        deletedUser.prenom || '',
        deletionReason
      )
      const emailSent = await sendEmail({
        to: deletedUser.email,
        subject: `⚠️  Suppression de votre compte - ${deletionReason.title}`,
        html: emailHtml,
        text: `Bonjour ${deletedUser.prenom}, votre compte a été supprimé. Motif: ${deletionReason.title} - ${deletionReason.message}`,
      })

      if (emailSent) {
        console.log(`✅ Email de suppression envoyé à ${deletedUser.email}`)
      } else {
        console.error(`❌ Échec envoi email de suppression à ${deletedUser.email}`)
      }
    } catch (emailError) {
      // La suppression a eu lieu : un échec d'envoi ne doit pas la faire paraître ratée à
      // l'administrateur, qui la relancerait sur un compte qui n'existe plus.
      console.error('❌ Erreur envoi email de suppression:', emailError)
    }

    // Log de l'action admin pour audit
    console.log(
      `[ADMIN] Utilisateur supprimé par ${adminUser.pseudo} (${adminUser.email}): ${deletedUser.pseudo} (${deletedUser.email}) - Raison: ${deletionReason.title}`
    )

    return createSuccessResponse(
      {
        reason: deletionReason.title,
        deletedUser: {
          id: deletedUser.id,
          pseudo: deletedUser.pseudo,
        },
      },
      `Compte ${deletedUser.pseudo} supprimé avec succès`
    )
  },
  { operationName: 'DeleteUser' }
)

// Exporter les raisons pour utilisation dans le frontend
export { DELETION_REASONS }
